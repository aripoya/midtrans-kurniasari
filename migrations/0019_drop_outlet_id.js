export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    try {
      console.log('🔧 Running migration: 0019_drop_outlet_id.js');

      // 1) Introspect current orders table
      const pragma = await env.DB.prepare("PRAGMA table_info('orders')").all();
      if (!pragma.success) throw new Error('Failed to read orders schema');

      const cols = (pragma.results || []).map(r => ({ name: r.name, type: r.type }));
      if (!cols.length) throw new Error('orders table not found or has no columns');

      // 2) Filter out the legacy column
      const dropCol = 'outlet_id';
      const remaining = cols.filter(c => c.name !== dropCol);
      if (remaining.length === cols.length) {
        console.log('✅ orders.outlet_id not present. Nothing to drop.');
        return new Response('No-op: outlet_id did not exist', { status: 200, headers: cors });
      }

      // 3) Build column list for copy
      const colList = remaining.map(c => c.name).join(', ');

      // 4) Create a new table definition by reading the original CREATE statement
      const schemaInfo = await env.DB.prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'"
      ).first();
      if (!schemaInfo?.sql) throw new Error('Could not fetch CREATE TABLE for orders');

      // Remove the outlet_id column definition line(s)
      const lowered = schemaInfo.sql.toLowerCase();
      let newCreateSQL;
      if (lowered.includes('\noutlet_id ')) {
        const lines = schemaInfo.sql.split('\n');
        const filteredLines = lines.filter(line => !line.toLowerCase().includes('outlet_id'));
        newCreateSQL = filteredLines.join('\n').replace(/CREATE TABLE orders/,'CREATE TABLE orders_new');
      } else {
        // Fallback: naive replace if in single line
        newCreateSQL = schemaInfo.sql.replace(/,?\s*outlet_id\s+[^,\)]+/, '').replace('CREATE TABLE orders','CREATE TABLE orders_new');
      }

      console.log('Creating orders_new without outlet_id...');
      await env.DB.prepare(newCreateSQL).run();

      console.log('Copying data into orders_new...');
      await env.DB.prepare(`INSERT INTO orders_new (${colList}) SELECT ${colList} FROM orders`).run();

      console.log('Dropping old orders table...');
      await env.DB.prepare('DROP TABLE orders').run();

      console.log('Renaming orders_new to orders...');
      await env.DB.prepare('ALTER TABLE orders_new RENAME TO orders').run();

      // 5) Recreate indexes excluding any referencing outlet_id
      const idxRows = await env.DB.prepare(
        "SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='orders' AND sql IS NOT NULL"
      ).all();

      for (const row of idxRows.results || []) {
        const sql = row.sql || '';
        if (sql.toLowerCase().includes('outlet_id')) {
          console.log(`Skipping index ${row.name} referencing outlet_id`);
          continue;
        }
        console.log(`Recreating index: ${row.name}`);
        await env.DB.prepare(sql).run();
      }

      console.log('✅ Migration completed: outlet_id removed');
      return new Response('outlet_id dropped successfully', { status: 200, headers: cors });
    } catch (err) {
      console.error('❌ Migration failed:', err);
      return new Response(`Migration failed: ${err.message}`, { status: 500 });
    }
  }
};
