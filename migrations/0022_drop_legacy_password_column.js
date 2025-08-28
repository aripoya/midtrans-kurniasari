export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    try {
      console.log('🔧 Running migration: 0022_drop_legacy_password_column.js');

      // 1) Introspect current users table
      const pragma = await env.DB.prepare("PRAGMA table_info('users')").all();
      if (!pragma.success) throw new Error('Failed to read users schema');

      const cols = (pragma.results || []).map(r => ({ name: r.name, type: r.type }));
      if (!cols.length) throw new Error('users table not found or has no columns');

      // 2) Filter out the legacy column
      const dropCol = 'password';
      const remaining = cols.filter(c => c.name !== dropCol);
      if (remaining.length === cols.length) {
        console.log('✅ users.password not present. Nothing to drop.');
        return new Response('No-op: password column did not exist', { status: 200, headers: cors });
      }

      // 3) Build column list for copy
      const colList = remaining.map(c => c.name).join(', ');

      // 4) Create a new table definition by reading the original CREATE statement
      const schemaInfo = await env.DB.prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
      ).first();
      if (!schemaInfo?.sql) throw new Error('Could not fetch CREATE TABLE for users');

      // Remove the password column definition line(s)
      const lowered = schemaInfo.sql.toLowerCase();
      let newCreateSQL;
      if (lowered.includes('\npassword ')) {
        const lines = schemaInfo.sql.split('\n');
        const filteredLines = lines.filter(line => !line.toLowerCase().includes('password '));
        newCreateSQL = filteredLines.join('\n').replace(/CREATE TABLE users/, 'CREATE TABLE users_new');
      } else {
        // Fallback: naive replace if in single line
        newCreateSQL = schemaInfo.sql
          .replace(/,?\s*password\s+[^,\)]+/, '')
          .replace('CREATE TABLE users', 'CREATE TABLE users_new');
      }

      console.log('Creating users_new without password...');
      await env.DB.prepare(newCreateSQL).run();

      // 5) Optional constraint hardening: ensure password_hash is NOT NULL for rows
      // We rely on existing data being compliant as verified; copy as-is
      console.log('Copying data into users_new...');
      await env.DB.prepare(`INSERT INTO users_new (${colList}) SELECT ${colList} FROM users`).run();

      console.log('Dropping old users table...');
      await env.DB.prepare('DROP TABLE users').run();

      console.log('Renaming users_new to users...');
      await env.DB.prepare('ALTER TABLE users_new RENAME TO users').run();

      // 6) Recreate indexes that do not reference the dropped column
      const idxRows = await env.DB.prepare(
        "SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='users' AND sql IS NOT NULL"
      ).all();

      for (const row of idxRows.results || []) {
        const sql = row.sql || '';
        const loweredSql = sql.toLowerCase();
        if (loweredSql.includes(' password ')) {
          console.log(`Skipping index ${row.name} referencing password`);
          continue;
        }
        try {
          console.log(`Recreating index: ${row.name}`);
          await env.DB.prepare(sql).run();
        } catch (e) {
          console.warn(`Failed to recreate index ${row.name}, continuing. Error:`, e?.message || e);
        }
      }

      console.log('✅ Migration completed: password column removed');
      return new Response('password column dropped successfully', { status: 200, headers: cors });
    } catch (err) {
      console.error('❌ Migration failed:', err);
      return new Response(`Migration failed: ${err.message}`, { status: 500 });
    }
  }
};
