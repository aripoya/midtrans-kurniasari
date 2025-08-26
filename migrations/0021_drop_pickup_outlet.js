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
      const pragma = await env.DB.prepare("PRAGMA table_info('orders')").all();
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
      const schemaInfo = await env.DB.prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'"
      ).first();
      if (!schemaInfo?.sql) throw new Error('Could not fetch CREATE TABLE for orders');

      // Remove the pickup_outlet column definition line(s)
      const lowered = schemaInfo.sql.toLowerCase();
      let newCreateSQL;
      if (lowered.includes('\npickup_outlet ')) {
        const lines = schemaInfo.sql.split('\n');
        const filteredLines = lines.filter(line => !line.toLowerCase().includes('pickup_outlet'));
        newCreateSQL = filteredLines.join('\n').replace(/CREATE TABLE orders/,'CREATE TABLE orders_new');
      } else {
        // Fallback: naive replace if in single line
        newCreateSQL = schemaInfo.sql.replace(/,?\s*pickup_outlet\s+[^,\)]+/, '').replace('CREATE TABLE orders','CREATE TABLE orders_new');
      }

      console.log('Creating orders_new without pickup_outlet...');
      await env.DB.prepare(newCreateSQL).run();

      console.log('Copying data into orders_new...');
      await env.DB.prepare(`INSERT INTO orders_new (${colList}) SELECT ${colList} FROM orders`).run();

      console.log('Dropping old orders table...');
      await env.DB.prepare('DROP TABLE orders').run();

      console.log('Renaming orders_new to orders...');
      await env.DB.prepare('ALTER TABLE orders_new RENAME TO orders').run();

      // 5) Recreate indexes excluding any referencing pickup_outlet
      const idxRows = await env.DB.prepare(
        "SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='orders' AND sql IS NOT NULL"
      ).all();

      for (const row of idxRows.results || []) {
        const sql = row.sql || '';
        const loweredSql = sql.toLowerCase();
        if (loweredSql.includes('pickup_outlet')) {
          console.log(`Skipping index ${row.name} referencing pickup_outlet`);
          continue;
        }
        try {
          console.log(`Recreating index: ${row.name}`);
          await env.DB.prepare(sql).run();
        } catch (e) {
          console.warn(`Failed to recreate index ${row.name}, continuing. Error:`, e?.message || e);
        }
      }

      console.log('✅ Migration completed: pickup_outlet removed');
      return new Response('pickup_outlet dropped successfully', { status: 200, headers: cors });
    } catch (err) {
      console.error('❌ Migration failed:', err);
      return new Response(`Migration failed: ${err.message}`, { status: 500 });
    }
  }
};
