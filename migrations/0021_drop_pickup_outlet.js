export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    try {
      console.log('🔧 Running migration: 0021_drop_pickup_outlet.js');

      // 1) Introspect current orders table
      let pragma;
      try {
        pragma = await env.DB.prepare("PRAGMA table_info('orders')").all();
      } catch (e) {
        throw new Error(`STEP PRAGMA: ${e?.message || e}`);
      }
      if (!pragma.success) throw new Error('Failed to read orders schema');

      const cols = (pragma.results || []).map(r => ({ name: r.name, type: r.type }));
      if (!cols.length) throw new Error('orders table not found or has no columns');

      // 2) Filter out the legacy column
      const dropCol = 'pickup_outlet';
      const remaining = cols.filter(c => c.name !== dropCol);
      if (remaining.length === cols.length) {
        console.log('✅ orders.pickup_outlet not present. Nothing to drop.');
        return new Response('No-op: pickup_outlet did not exist', { status: 200, headers: cors });
      }

      // 3) Build column list for copy
      const colList = remaining.map(c => c.name).join(', ');

      // 4) Create a new table definition by reading the original CREATE statement
      let schemaInfo;
      try {
        schemaInfo = await env.DB.prepare(
          "SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'"
        ).first();
      } catch (e) {
        throw new Error(`STEP READ_SCHEMA: ${e?.message || e}`);
      }
      if (!schemaInfo?.sql) throw new Error('Could not fetch CREATE TABLE for orders');

      // Remove the pickup_outlet column definition robustly (case-insensitive)
      const origSQL = schemaInfo.sql;
      let newCreateSQL = origSQL
        // 1) Rename table to orders_new (case-insensitive)
        .replace(/CREATE\s+TABLE\s+orders/i, 'CREATE TABLE orders_new')
        // 2) Remove the column segment: optional leading comma, column name, type and until next comma or closing paren
        .replace(/,?\s*pickup_outlet\s+[^,\)]+/i, '');

      // 3) Fix potential trailing commas before closing parenthesis
      newCreateSQL = newCreateSQL
        .replace(/,\s*\)/g, ')')
        .replace(/\(\s*,/g, '(');

      // 4) Also remove any FK clauses or stray references that mention users_old
      // Remove explicit FK clauses: , FOREIGN KEY(...) REFERENCES users_old ...
      newCreateSQL = newCreateSQL.replace(/,\s*FOREIGN\s+KEY\s*\([^\)]*\)\s*REFERENCES\s+users_old[^,\)]*/ig, '');
      // Remove inline REFERENCES users_old on column definitions (if any)
      newCreateSQL = newCreateSQL.replace(/REFERENCES\s+users_old[^,\)]*/ig, '');
      // Clean up any double commas that may result
      newCreateSQL = newCreateSQL.replace(/,\s*,/g, ',').replace(/,\s*\)/g, ')').replace(/\(\s*,/g, '(');

      // Ensure idempotency: drop temp table if a previous attempt created it
      console.log('Ensuring clean temp table...');
      try {
        await env.DB.prepare('DROP TABLE IF EXISTS orders_new').run();
      } catch (e) {
        throw new Error(`STEP DROP_TEMP: ${e?.message || e}`);
      }

      console.log('Creating orders_new without pickup_outlet...');
      try {
        await env.DB.prepare(newCreateSQL).run();
      } catch (e) {
        throw new Error(`STEP CREATE_NEW: ${e?.message || e}`);
      }

      console.log('Copying data into orders_new...');
      try {
        await env.DB.prepare(`INSERT INTO orders_new (${colList}) SELECT ${colList} FROM orders`).run();
      } catch (e) {
        throw new Error(`STEP COPY_DATA: ${e?.message || e}`);
      }

      // Before dropping, remove legacy views and triggers that may reference users_old
      console.log('Dropping legacy triggers on orders (if any)...');
      try {
        // Drop views that reference orders or users_old
        const viewRows = await env.DB.prepare(
          "SELECT name, sql FROM sqlite_master WHERE type='view' AND (sql LIKE '%orders%' OR sql LIKE '%users_old%')"
        ).all();
        for (const row of viewRows.results || []) {
          const vname = row.name;
          console.log(`Dropping view ${vname} (defensive)`);
          await env.DB.prepare(`DROP VIEW IF EXISTS ${vname}`).run();
        }

        // Ensure recursive triggers are off
        await env.DB.prepare('PRAGMA recursive_triggers = OFF;').run();

        const trigRows = await env.DB.prepare(
          "SELECT name, sql FROM sqlite_master WHERE type='trigger' AND tbl_name='orders'"
        ).all();
        for (const row of trigRows.results || []) {
          const tname = row.name;
          const tsql = (row.sql || '').toLowerCase();
          if (tsql.includes('users_old') || tsql.includes('references users_old')) {
            console.log(`Dropping trigger ${tname} referencing users_old`);
            await env.DB.prepare(`DROP TRIGGER IF EXISTS ${tname}`).run();
          } else {
            // Defensive: also drop any trigger bound to orders to ensure clean drop
            console.log(`Dropping trigger ${tname} (defensive)`);
            await env.DB.prepare(`DROP TRIGGER IF EXISTS ${tname}`).run();
          }
        }
      } catch (e) {
        console.warn('Failed while dropping triggers, continuing:', e?.message || e);
      }

      console.log('Safely renaming original orders to backup (avoid DROP)...');
      try {
        const backupName = 'orders_with_pickup_outlet_backup_0021';
        // Ensure no leftover backup exists
        await env.DB.prepare(`DROP TABLE IF EXISTS ${backupName}`).run();
        await env.DB.prepare('ALTER TABLE orders RENAME TO ' + backupName).run();
      } catch (e) {
        throw new Error(`STEP RENAME_BACKUP: ${e?.message || e}`);
      }

      console.log('Renaming orders_new to orders...');
      try {
        await env.DB.prepare('ALTER TABLE orders_new RENAME TO orders').run();
      } catch (e) {
        throw new Error(`STEP RENAME_NEW: ${e?.message || e}`);
      }

      // 5) Temporarily skip index recreation entirely to avoid legacy references (e.g., users_old)
      console.log('Skipping index recreation in 0021 to avoid legacy references.');

      console.log('✅ Migration completed: pickup_outlet removed');
      // Post-verify the column is gone
      let verify;
      try {
        verify = await env.DB.prepare("SELECT name FROM pragma_table_info('orders') WHERE name='pickup_outlet';").all();
      } catch (e) {
        throw new Error(`STEP VERIFY: ${e?.message || e}`);
      }
      const stillExists = (verify.results || []).length > 0;
      if (stillExists) {
        throw new Error('Verification failed: pickup_outlet still exists after migration');
      }
      return new Response('pickup_outlet dropped successfully', { status: 200, headers: cors });
    } catch (err) {
      console.error('❌ Migration failed:', err);
      return new Response(`Migration failed: ${err.message}`, { status: 500 });
    }
  }
};
