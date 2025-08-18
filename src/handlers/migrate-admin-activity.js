// Migration handler for admin activity logging system
export async function migrateAdminActivity(request, env) {
  console.log('🔄 Starting admin activity migration...');
  
  try {
    // Create admin_activity_logs table
    const createActivityLogsTable = `
      CREATE TABLE IF NOT EXISTS admin_activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id TEXT NOT NULL,
        admin_name TEXT NOT NULL,
        admin_email TEXT NOT NULL,
        activity_type TEXT NOT NULL, -- 'login', 'logout', 'order_created', 'order_updated', 'order_deleted'
        description TEXT,
        order_id TEXT, -- NULL for login/logout, order ID for order activities
        ip_address TEXT,
        user_agent TEXT,
        session_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `;
    
    // Create index for better query performance
    const createIndexes = [
      `CREATE INDEX IF NOT EXISTS idx_admin_activity_admin_id ON admin_activity_logs(admin_id)`,
      `CREATE INDEX IF NOT EXISTS idx_admin_activity_type ON admin_activity_logs(activity_type)`,
      `CREATE INDEX IF NOT EXISTS idx_admin_activity_created_at ON admin_activity_logs(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_admin_activity_order_id ON admin_activity_logs(order_id)`
    ];
    
    // Add created_by_admin_id column to orders table if it doesn't exist
    const addCreatedByColumn = `
      ALTER TABLE orders ADD COLUMN created_by_admin_id TEXT
    `;
    
    const addCreatedByNameColumn = `
      ALTER TABLE orders ADD COLUMN created_by_admin_name TEXT
    `;
    
    console.log('📋 Creating admin_activity_logs table...');
    await env.DB.prepare(createActivityLogsTable).run();
    
    console.log('📋 Creating indexes...');
    for (const indexQuery of createIndexes) {
      await env.DB.prepare(indexQuery).run();
    }
    
    // Check if columns already exist before adding them
    console.log('📋 Checking orders table structure...');
    const ordersTableInfo = await env.DB.prepare(`PRAGMA table_info(orders)`).all();
    const columnNames = ordersTableInfo.results.map(col => col.name);
    
    if (!columnNames.includes('created_by_admin_id')) {
      console.log('📋 Adding created_by_admin_id column to orders table...');
      await env.DB.prepare(addCreatedByColumn).run();
    } else {
      console.log('✅ created_by_admin_id column already exists');
    }
    
    if (!columnNames.includes('created_by_admin_name')) {
      console.log('📋 Adding created_by_admin_name column to orders table...');
      await env.DB.prepare(addCreatedByNameColumn).run();
    } else {
      console.log('✅ created_by_admin_name column already exists');
    }
    
    // Create admin_sessions table for session management
    const createSessionsTable = `
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        admin_id TEXT NOT NULL,
        admin_name TEXT NOT NULL,
        admin_email TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        login_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_activity TEXT NOT NULL DEFAULT (datetime('now')),
        is_active INTEGER DEFAULT 1,
        logout_at TEXT
      )
    `;
    
    console.log('📋 Creating admin_sessions table...');
    await env.DB.prepare(createSessionsTable).run();
    
    // Create session indexes
    const sessionIndexes = [
      `CREATE INDEX IF NOT EXISTS idx_admin_sessions_session_id ON admin_sessions(session_id)`,
      `CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON admin_sessions(admin_id)`,
      `CREATE INDEX IF NOT EXISTS idx_admin_sessions_is_active ON admin_sessions(is_active)`
    ];
    
    for (const indexQuery of sessionIndexes) {
      await env.DB.prepare(indexQuery).run();
    }
    
    // Test insert to verify everything works
    console.log('🧪 Testing admin activity log insertion...');
    const testLogId = `test-${Date.now()}`;
    await env.DB.prepare(`
      INSERT INTO admin_activity_logs 
      (admin_id, admin_name, admin_email, activity_type, description, ip_address) 
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      testLogId,
      'Test Admin',
      'test@kurniasari.com',
      'login',
      'Migration test login',
      '127.0.0.1'
    ).run();
    
    // Clean up test data
    await env.DB.prepare(`DELETE FROM admin_activity_logs WHERE admin_id = ?`).bind(testLogId).run();
    
    console.log('✅ Admin activity migration completed successfully!');
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Admin activity migration completed successfully',
      tables_created: [
        'admin_activity_logs',
        'admin_sessions'
      ],
      columns_added: [
        'orders.created_by_admin_id',
        'orders.created_by_admin_name'
      ]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Admin activity migration failed:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
