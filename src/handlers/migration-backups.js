/**
 * Handlers for listing and safely restoring JSON backups created by the safe migration
 * Backups are stored in the `migration_backups` table with JSON payload.
 *
 * Endpoints (registered in worker.js):
 * - GET  /api/admin/migration-backups                -> listMigrationBackups
 * - GET  /api/admin/migration-backups/:id            -> getMigrationBackup (optionally include data)
 * - POST /api/admin/migration-backups/:id/restore    -> restoreMigrationBackup (safe, non-destructive)
 */

function getCorsHeaders(request) {
  return request.corsHeaders || {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function sanitizeIdentifier(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'restored_table';
}

async function tableExists(env, tableName) {
  const row = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
  ).bind(tableName).first();
  return !!row;
}

async function uniqueTableName(env, baseName) {
  let name = baseName;
  let idx = 2;
  while (await tableExists(env, name)) {
    name = `${baseName}_v${idx}`;
    idx += 1;
  }
  return name;
}

export async function listMigrationBackups(request, env) {
  try {
    const headers = getCorsHeaders(request);
    if (!env.DB) throw new Error('Database not available');

    const url = new URL(request.url);
    const source = url.searchParams.get('source');
    const limitParam = parseInt(url.searchParams.get('limit') || '50', 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 50;

    let query = `SELECT id, created_at, source_table, rows_count FROM migration_backups`;
    const conditions = [];
    const binds = [];

    if (source) {
      conditions.push(`source_table = ?`);
      binds.push(source);
    }
    if (conditions.length) {
      query += ` WHERE ` + conditions.join(' AND ');
    }
    query += ` ORDER BY id DESC LIMIT ${limit}`; // safe: limit already sanitized as number

    let results = [];
    try {
      const res = await env.DB.prepare(query).bind(...binds).all();
      results = res.results || [];
    } catch (e) {
      // If table doesn't exist yet, return empty list
      if (!/no such table/i.test(e.message || '')) {
        throw e;
      }
    }

    return new Response(JSON.stringify({ success: true, data: results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...headers },
    });
  } catch (error) {
    console.error('Error fetching migration backups:', error.message, error.stack);
    return new Response(JSON.stringify({ success: false, message: 'Failed to fetch migration backups' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) },
    });
  }
}

export async function getMigrationBackup(request, env) {
  try {
    const headers = getCorsHeaders(request);
    if (!env.DB) throw new Error('Database not available');

    const url = new URL(request.url);
    const includeData = url.searchParams.get('includeData') === 'true';
    const { id } = request.params || {};
    const backupId = parseInt(id, 10);
    if (!Number.isFinite(backupId)) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid backup id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...headers },
      });
    }

    const row = await env.DB.prepare(
      includeData
        ? `SELECT id, created_at, source_table, rows_count, data_json FROM migration_backups WHERE id = ?`
        : `SELECT id, created_at, source_table, rows_count FROM migration_backups WHERE id = ?`
    ).bind(backupId).first();

    if (!row) {
      return new Response(JSON.stringify({ success: false, message: 'Backup not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...headers },
      });
    }

    return new Response(JSON.stringify({ success: true, data: row }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...headers },
    });
  } catch (error) {
    console.error('Error fetching migration backup:', error.message, error.stack);
    return new Response(JSON.stringify({ success: false, message: 'Failed to fetch migration backup' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) },
    });
  }
}

export async function restoreMigrationBackup(request, env) {
  const headers = getCorsHeaders(request);
  try {
    if (!env.DB) throw new Error('Database not available');

    const url = new URL(request.url);
    const { id } = request.params || {};
    const backupId = parseInt(id, 10);
    if (!Number.isFinite(backupId)) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid backup id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...headers },
      });
    }

    let body = {};
    try { body = await request.json(); } catch (_) {}
    const dryRun = url.searchParams.get('dryRun') === 'true' || body.dryRun === true;
    let desiredTarget = body.targetTable || url.searchParams.get('targetTable') || '';

    // Fetch backup with data
    const backup = await env.DB.prepare(
      `SELECT id, created_at, source_table, rows_count, data_json FROM migration_backups WHERE id = ?`
    ).bind(backupId).first();

    if (!backup) {
      return new Response(JSON.stringify({ success: false, message: 'Backup not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...headers },
      });
    }

    // Parse JSON array
    let rows = [];
    try {
      rows = JSON.parse(backup.data_json || '[]');
      if (!Array.isArray(rows)) rows = [];
    } catch (e) {
      return new Response(JSON.stringify({ success: false, message: 'Corrupted backup JSON' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...headers },
      });
    }

    // Determine target table name (non-destructive)
    const baseTarget = sanitizeIdentifier(
      desiredTarget || `restored_${backup.source_table}_${backup.id}`
    );
    const targetTable = await uniqueTableName(env, baseTarget);

    // Determine column names (union of keys)
    const keySet = new Set();
    for (const r of rows) {
      if (r && typeof r === 'object' && !Array.isArray(r)) {
        for (const k of Object.keys(r)) {
          keySet.add(sanitizeIdentifier(k));
        }
      }
    }
    const columns = Array.from(keySet);

    if (dryRun) {
      return new Response(JSON.stringify({
        success: true,
        preview: true,
        targetTable,
        sourceTable: backup.source_table,
        rowCount: rows.length,
        columnCount: columns.length,
        columns: columns.slice(0, 50),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...headers },
      });
    }

    // Create table with TEXT affinity for all columns (SQLite is flexible)
    const columnDDL = columns.length
      ? columns.map(c => `"${c}" TEXT`).join(', ')
      : '"__raw_json" TEXT';

    await env.DB.prepare(`CREATE TABLE ${targetTable} (${columnDDL})`).run();

    // If we created a table with no derived columns, insert raw JSON in one column
    if (columns.length === 0) {
      const stmt = await env.DB.prepare(`INSERT INTO ${targetTable} (__raw_json) VALUES (?)`);
      for (const r of rows) {
        await stmt.bind(JSON.stringify(r)).run();
      }
    } else {
      const placeholders = columns.map(() => '?').join(', ');
      const insertSQL = `INSERT INTO ${targetTable} (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`;
      const stmt = await env.DB.prepare(insertSQL);

      for (const r of rows) {
        const values = columns.map(c => {
          // Use original key mapping if possible by reverse lookup
          // Here we assume sanitized key matches original key sans non-alnum chars
          // Try direct, then a relaxed match
          if (r[c] !== undefined) return normalizeValue(r[c]);
          const foundKey = Object.keys(r).find(k => sanitizeIdentifier(k) === c);
          return normalizeValue(foundKey ? r[foundKey] : null);
        });
        await stmt.bind(...values).run();
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Backup restored into new table successfully',
      data: {
        backupId: backup.id,
        sourceTable: backup.source_table,
        targetTable,
        rowsInserted: rows.length,
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...headers },
    });
  } catch (error) {
    console.error('Error restoring migration backup:', error.message, error.stack);
    return new Response(JSON.stringify({ success: false, message: 'Failed to restore migration backup' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...headers },
    });
  }
}

function normalizeValue(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
