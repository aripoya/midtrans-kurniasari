import { createNotification } from './notifications.js';

export async function resetOutletPassword(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash('outlet123', 10);
    
    const result = await env.DB.prepare(
      `UPDATE users SET password = ? WHERE username = ?`
    ).bind(hashedPassword, 'outlet').run();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Outlet password reset successfully',
      changes: result.changes,
      hashedPassword: hashedPassword
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to reset outlet password',
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function checkDatabaseSchema(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    // Get all tables
    const tables = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Database schema retrieved successfully',
      tables: tables.results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to retrieve database schema',
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function createCustomersTable(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    // Create customers table based on orders table structure
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        first_name TEXT,
        last_name TEXT,
        phone TEXT,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    const result = await env.DB.prepare(createTableQuery).run();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Customers table created successfully',
      result: result
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to create customers table',
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function createOrderUpdateLogsTable(env) {
  try {
    // Create order_update_logs table for audit trail
    const result = await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS order_update_logs (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        user_id TEXT,
        update_type TEXT NOT NULL, -- status, shipping, payment, etc.
        old_value TEXT,
        new_value TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_role TEXT, -- admin, outlet_manager, deliveryman
        notes TEXT,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `).run();
    
    // Create index on order_id for faster lookups
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_order_update_logs_order_id ON order_update_logs(order_id);
    `).run();
    
    return { success: true, message: 'order_update_logs table created successfully' };
  } catch (error) {
    console.error('Error creating order_update_logs table:', error);
    return { 
      success: false, 
      error: error.message,
      details: error.toString() 
    };
  }
}

export async function debugCreateOrderUpdateLogsTable(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const result = await createOrderUpdateLogsTable(env);
    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      details: error.toString() 
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}

export async function testLogin(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const bcrypt = await import('bcryptjs');
    const jwt = await import('jsonwebtoken');

    // Test database connection
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE username = ?'
    ).bind('outlet').first();

    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        message: 'User not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Test password comparison
    const isPasswordValid = await bcrypt.compare('outlet123', user.password);
    
    if (!isPasswordValid) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Invalid password',
        userPassword: user.password,
        testPassword: 'outlet123'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Test JWT creation
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        outlet_id: user.outlet_id 
      },
      'your-secret-key',
      { expiresIn: '24h' }
    );

    return new Response(JSON.stringify({
      success: true,
      message: 'Login test successful',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        outlet_id: user.outlet_id
      },
      token: token
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Login test failed',
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function addUpdatedAtColumnToUsers(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    // Check if updated_at column already exists
    const checkColumnQuery = `PRAGMA table_info(users)`;
    const columns = await env.DB.prepare(checkColumnQuery).all();
    
    let updatedAtColumnExists = false;
    if (columns && columns.results) {
      updatedAtColumnExists = columns.results.some(col => col.name === 'updated_at');
    }
    
    if (updatedAtColumnExists) {
      return new Response(JSON.stringify({
        success: true,
        message: 'updated_at column already exists in users table',
        existingColumns: columns.results.map(col => col.name)
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Add updated_at column to users table
    const addColumnQuery = `ALTER TABLE users ADD COLUMN updated_at TEXT DEFAULT NULL`;
    const result = await env.DB.prepare(addColumnQuery).run();
    
    // Initialize updated_at with the same value as created_at for existing records
    const updateExistingRecords = `UPDATE users SET updated_at = created_at WHERE updated_at IS NULL`;
    const updateResult = await env.DB.prepare(updateExistingRecords).run();
    
    // Verify column was added
    const verifyColumns = await env.DB.prepare(checkColumnQuery).all();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'updated_at column added to users table successfully',
      result: result,
      updateResult: updateResult,
      currentColumns: verifyColumns.results.map(col => col.name)
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to add updated_at column to users table',
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function addEmailColumnToUsers(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    // Check if email column already exists
    const checkColumnQuery = `PRAGMA table_info(users)`;
    const columns = await env.DB.prepare(checkColumnQuery).all();
    
    let emailColumnExists = false;
    if (columns && columns.results) {
      emailColumnExists = columns.results.some(col => col.name === 'email');
    }
    
    if (emailColumnExists) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Email column already exists in users table',
        existingColumns: columns.results.map(col => col.name)
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Add email column to users table
    const addColumnQuery = `ALTER TABLE users ADD COLUMN email TEXT`;
    const result = await env.DB.prepare(addColumnQuery).run();
    
    // Verify column was added
    const verifyColumns = await env.DB.prepare(checkColumnQuery).all();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Email column added to users table successfully',
      result: result,
      currentColumns: verifyColumns.results.map(col => col.name)
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to add email column to users table',
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function getTableSchema(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const url = new URL(request.url);
    const tableName = url.searchParams.get('table') || 'orders';
    
    // Get table schema
    const schema = await env.DB.prepare(
      `PRAGMA table_info(${tableName})`
    ).all();
    
    // Get foreign key constraints for the table
    let foreignKeys = { results: [] };
    try {
      foreignKeys = await env.DB.prepare(
        `PRAGMA foreign_key_list(${tableName})`
      ).all();
    } catch (e) {
      // Swallow errors to keep endpoint resilient across environments
      console.log(`[DEBUG] Failed to read foreign_key_list for table ${tableName}:`, String(e));
    }
    
    // Get sample data
    const sampleData = await env.DB.prepare(
      `SELECT * FROM ${tableName} LIMIT 2`
    ).all();
    
    return new Response(JSON.stringify({
      success: true,
      message: `Schema for table ${tableName} retrieved successfully`,
      tableName: tableName,
      schema: schema.results,
      foreignKeys: foreignKeys.results,
      sampleData: sampleData.results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to retrieve table schema',
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function analyzeOutletLocations(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    // Get all unique lokasi_pengiriman values
    const pengiriman = await env.DB.prepare(
      `SELECT DISTINCT lokasi_pengiriman FROM orders WHERE lokasi_pengiriman IS NOT NULL AND lokasi_pengiriman != ''`
    ).all();
    
    // Get all unique lokasi_pengambilan values
    const pengambilan = await env.DB.prepare(
      `SELECT DISTINCT lokasi_pengambilan FROM orders WHERE lokasi_pengambilan IS NOT NULL AND lokasi_pengambilan != ''`
    ).all();
    
    // Combine and deduplicate all locations
    const allLocations = new Set();
    pengiriman.results.forEach(row => allLocations.add(row.lokasi_pengiriman));
    pengambilan.results.forEach(row => allLocations.add(row.lokasi_pengambilan));
    
    const uniqueLocations = Array.from(allLocations);
    
    // Get sample orders for each location to understand the data
    const locationSamples = {};
    for (const location of uniqueLocations) {
      const samples = await env.DB.prepare(
        `SELECT id, lokasi_pengiriman, lokasi_pengambilan, tipe_pesanan, outlet_id 
         FROM orders 
         WHERE lokasi_pengiriman = ? OR lokasi_pengambilan = ? 
         LIMIT 2`
      ).bind(location, location).all();
      locationSamples[location] = samples.results;
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Outlet locations analysis completed',
      uniqueLocations: uniqueLocations,
      totalLocations: uniqueLocations.length,
      pengirimanLocations: pengiriman.results.map(r => r.lokasi_pengiriman),
      pengambilanLocations: pengambilan.results.map(r => r.lokasi_pengambilan),
      locationSamples: locationSamples
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to analyze outlet locations',
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function createRealOutlets(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const bcrypt = await import('bcryptjs');
    
    // Define real outlet locations based on analysis
    const realOutlets = [
      {
        id: 'outlet_bonbin',
        name: 'Outlet Bonbin',
        location: 'Outlet Bonbin',
        address: 'Bonbin, Yogyakarta',
        username: 'bonbin',
        password: 'bonbin123'
      },
      {
        id: 'outlet_jakal_km14', 
        name: 'Outlet Jakal KM14',
        location: 'Outlet Jakal KM14',
        address: 'Jl. Jakal KM14, Yogyakarta',
        username: 'jakal',
        password: 'jakal123'
      },
      {
        id: 'outlet_glagahsari',
        name: 'Outlet Glagahsari 91C',
        location: 'Outlet Glagahsari 91C', 
        address: 'Glagahsari 91C, Yogyakarta',
        username: 'glagahsari',
        password: 'glagahsari123'
      }
    ];

    const results = [];
    
    for (const outlet of realOutlets) {
      try {
        // Create outlet entry (without location column)
        await env.DB.prepare(
          `INSERT OR REPLACE INTO outlets (id, name, address, created_at) VALUES (?, ?, ?, datetime('now'))`
        ).bind(outlet.id, outlet.name, outlet.address).run();
        
        // Hash password
        const hashedPassword = await bcrypt.hash(outlet.password, 10);
        
        // Create user for outlet
        const userId = `${outlet.id}_manager`;
        await env.DB.prepare(
          `INSERT OR REPLACE INTO users (id, username, password, role, outlet_id, name, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
        ).bind(userId, outlet.username, hashedPassword, 'outlet_manager', outlet.id, `${outlet.name} Manager`).run();
        
        results.push({
          outlet: outlet,
          userId: userId,
          status: 'created'
        });
        
      } catch (err) {
        results.push({
          outlet: outlet,
          status: 'error',
          error: err.message
        });
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Real outlets and users created successfully',
      results: results,
      totalCreated: results.filter(r => r.status === 'created').length
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to create real outlets',
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function resetAdminPasswordForDebug(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const bcrypt = await import('bcryptjs');
    const newPassword = 'password123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const result = await env.DB.prepare(
      `UPDATE users SET password = ? WHERE username = ?`
    ).bind(hashedPassword, 'admin').run();

    if (result.changes === 0) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Admin user not found. No password was reset.',
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Admin password reset successfully to "password123"',
      changes: result.changes,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to reset admin password',
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function debugDeliveryAssignments(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle OPTIONS request for CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Check all deliverymen
    const deliverymen = await env.DB.prepare(`
      SELECT * FROM users WHERE role = 'deliveryman'
    `).all();

    // 2. Check all orders with assigned deliveryman
    const assignedOrders = await env.DB.prepare(`
      SELECT id, customer_name, customer_phone, shipping_status, assigned_deliveryman_id 
      FROM orders 
      WHERE assigned_deliveryman_id IS NOT NULL
    `).all();

    // 3. Check schema for assigned_deliveryman_id column
    const tableInfo = await env.DB.prepare(`
      PRAGMA table_info(orders)
    `).all();
    
    // 4. Count total orders for statistics
    const totalOrders = await env.DB.prepare(`SELECT COUNT(*) as total FROM orders`).first();

    // 5. Check if there are any orders with assigned_deliveryman_id = 'delivery' (username not ID)
    const badAssignments = await env.DB.prepare(`
      SELECT id, customer_name, assigned_deliveryman_id FROM orders
      WHERE assigned_deliveryman_id = 'delivery'
    `).all();

    // Return all debugging information
    return new Response(JSON.stringify({
      success: true,
      deliverymen: deliverymen.results || [],
      assignedOrders: assignedOrders.results || [],
      ordersTableSchema: tableInfo.results || [],
      badAssignments: badAssignments.results || [],
      totalOrdersCount: totalOrders.total,
      user: request.user || null
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Debug Delivery Assignments Error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Error debugging delivery assignments',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

export async function mapOrdersToOutlets(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    // Define location to outlet_id mapping
    const locationMap = {
      'Outlet Bonbin': 'outlet_bonbin',
      'Outlet Jakal KM14': 'outlet_jakal_km14',
      'Outlet Glagahsari 91C': 'outlet_glagahsari'
    };
    
    const results = [];
    
    // Update orders based on lokasi_pengiriman (shipping destination) - FORCE UPDATE ALL
    for (const [location, outletId] of Object.entries(locationMap)) {
      try {
        const result = await env.DB.prepare(
          `UPDATE orders SET outlet_id = ? WHERE lokasi_pengiriman = ?`
        ).bind(outletId, location).run();
        
        results.push({
          location: location,
          outletId: outletId,
          type: 'pengiriman',
          updatedCount: result.changes || 0
        });
      } catch (err) {
        results.push({
          location: location,
          type: 'pengiriman', 
          status: 'error',
          error: err.message
        });
      }
    }
    
    // Update orders based on lokasi_pengambilan (pickup location) as fallback
    for (const [location, outletId] of Object.entries(locationMap)) {
      try {
        const result = await env.DB.prepare(
          `UPDATE orders SET outlet_id = ? WHERE lokasi_pengambilan = ? AND lokasi_pengiriman != ?`
        ).bind(outletId, location, location).run();
        
        results.push({
          location: location,
          outletId: outletId,
          type: 'pengambilan',
          updatedCount: result.changes || 0 
        });
      } catch (err) {
        results.push({
          location: location,
          type: 'pengambilan',
          status: 'error', 
          error: err.message
        });
      }
    }
    
    // Get updated order counts per outlet
    const outletCounts = {};
    for (const outletId of Object.values(locationMap)) {
      const count = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM orders WHERE outlet_id = ?`
      ).bind(outletId).first();
      outletCounts[outletId] = count.count;
    }
    
    const totalUpdated = results.reduce((sum, r) => sum + (r.updatedCount || 0), 0);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Orders mapped to outlets successfully',
      results: results,
      outletCounts: outletCounts,
      totalUpdated: totalUpdated
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to map orders to outlets',
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Modified version of updateOrderStatus that doesn't require order_update_logs table
 * This is a temporary solution until the table is properly migrated to production
 */
export async function modifyUpdateOrderStatus(request, env) {
  const corsHeaders = request.corsHeaders || {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const orderId = url.pathname.split('/')[3]; // Assuming URL is /api/orders/:id/status
    const { status } = await request.json();

    if (!orderId || !status) {
      return new Response(JSON.stringify({ success: false, error: 'Order ID and status are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Updated to match frontend utility normalization
    const allowedStatuses = [
      'menunggu diproses', 'pending', // backward compatibility
      'dikemas', 'diproses',
      'siap kirim', 'siap diambil', 'siap di ambil',
      'dalam pengiriman', 'sedang dikirim', 'dikirim',
      'diterima', 'received', 'sudah di terima',
      'sudah diambil', 'sudah di ambil' // NEW STATUS for pickup_sendiri orders
    ];
    if (!allowedStatuses.includes(status.toLowerCase())) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid status value', 
        allowedValues: ['menunggu diproses', 'pending', 'dikemas', 'siap kirim', 'siap di ambil', 'sedang dikirim', 'diterima', 'received', 'sudah diambil', 'sudah di ambil'] 
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!env.DB) {
      throw new Error("Database binding not found.");
    }

    // Get current order status and related information before updating
    const currentOrder = await env.DB.prepare(`
      SELECT o.shipping_status, o.outlet_id, o.assigned_deliveryman_id, 
             ou.name as outlet_name
      FROM orders o
      LEFT JOIN outlets_unified ou ON o.outlet_id = ou.id
      WHERE o.id = ?
    `).bind(orderId).first();

    if (!currentOrder) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Order not found' 
      }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const oldStatus = currentOrder.shipping_status;

    // Only update if status has changed
    if (oldStatus === status) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Status is unchanged' 
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Update the order status
    const updateResult = await env.DB.prepare(
      'UPDATE orders SET shipping_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(status, orderId).run();

    if (updateResult.meta.changes === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Order not found or status unchanged' 
      }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // Skip the audit log entry that depends on order_update_logs table
    console.log(`[TEMPORARY VERSION] Order ${orderId} status updated from ${oldStatus || 'not set'} to ${status}`);
    console.log('[WARNING] Audit log entry NOT created due to missing table. Please run /api/debug/create-order-update-logs-table');
    
    // Extract user info for log purposes only (not saved to DB)
    let userId = null;
    let userRole = 'anonymous';
    
    if (request.user) {
      userId = request.user.id;
      userRole = request.user.role;
    }
    
    console.log(`[DEBUG] Status update by user: ${userId || 'unknown'} (${userRole}). Old status: ${oldStatus}, New status: ${status}`);
    
    // Create notifications
    try {
      // Extract outlet and deliveryman info if available
      const outletId = currentOrder.outlet_id;
      const deliverymanId = currentOrder.assigned_deliveryman_id;
      const outletName = currentOrder.outlet_name || 'the outlet';
      
      // Determine notification title and message based on status
      let title = `Order Status Updated`;
      let message = `Order #${orderId} status updated to "${status}"`;
      
      // Create different notification messages based on status and user role
      if (status.toLowerCase() === 'dalam pengiriman' || 
          status.toLowerCase() === 'sedang dikirim' || 
          status.toLowerCase() === 'dikirim') {
        title = 'Order In Transit';
        message = `Order #${orderId} is now being delivered to the customer.`;
      } else if (status.toLowerCase() === 'diterima' || 
                status.toLowerCase() === 'received' || 
                status.toLowerCase() === 'sudah di terima') {
        title = 'Order Delivered';
        message = `Order #${orderId} has been successfully delivered and received by the customer.`;
      } else if (status.toLowerCase() === 'siap kirim' || 
                status.toLowerCase() === 'siap diambil' || 
                status.toLowerCase() === 'siap di ambil') {
        title = 'Order Ready';
        message = `Order #${orderId} is packed and ready for pickup/delivery.`;
      }
      
      // Send notifications based on user role
      if (userRole === 'admin') {
        // If admin updates, notify outlet and deliveryman
        if (outletId) {
          await createNotification({
            user_id: outletId,
            user_type: 'outlet',
            title: title,
            message: `${message} (Updated by Admin)`
          }, env);
        }
        
        if (deliverymanId) {
          await createNotification({
            user_id: deliverymanId,
            user_type: 'deliveryman',
            title: title,
            message: `${message} (Updated by Admin)`
          }, env);
        }
      } else if (userRole === 'outlet_manager') {
        // If outlet updates, notify admin and deliveryman
        await createNotification({
          user_id: 'admin', // special ID for admin
          user_type: 'admin',
          title: title,
          message: `${message} (Updated by ${outletName})`
        }, env);
        
        if (deliverymanId) {
          await createNotification({
            user_id: deliverymanId,
            user_type: 'deliveryman',
            title: title,
            message: `${message} (Updated by ${outletName})`
          }, env);
        }
      } else if (userRole === 'deliveryman') {
        // If deliveryman updates, notify admin and outlet
        await createNotification({
          user_id: 'admin',
          user_type: 'admin',
          title: title,
          message: `${message} (Updated by Delivery personnel)`
        }, env);
        
        if (outletId) {
          await createNotification({
            user_id: outletId,
            user_type: 'outlet',
            title: title,
            message: `${message} (Updated by Delivery personnel)`
          }, env);
        }
      }
      
      console.log(`Notifications sent for order ${orderId} status update to ${status}`);
      
    } catch (notifError) {
      console.error('Failed to send notifications:', notifError);
      // Don't fail the status update if notifications fail
    }
    
    // Return success response
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Order status updated successfully',
      data: { 
        orderId, 
        newStatus: status,
        oldStatus: oldStatus || 'not set',
        auditLog: 'skipped due to missing table'  // Indicate audit logging was skipped
      }
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    
  } catch (error) {
    console.error('Error updating order status:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to update order status', 
      details: error.message 
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

/**
 * Debug endpoint to investigate outlet bonbin synchronization issue by simulating the exact query that would be run
 */
export async function debugOutletSync(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Get outlet bonbin user data
    const outletUser = await env.DB.prepare(
      'SELECT * FROM users WHERE username = ?'
    ).bind('bonbin').first();

    console.log('Outlet Bonbin User Data:', outletUser);

    // Simulate the query that would be run for outlet bonbin
    const outletId = outletUser?.outlet_id || '';
    const outletName = 'Outlet Bonbin'; // Based on user
    
    // Build the same query as getOutletOrders would build
    let testQuery = `
      SELECT o.*, ou.name AS outlet_name
      FROM orders o
      LEFT JOIN outlets_unified ou ON o.outlet_id = ou.id
      WHERE 1=1
    `;
    
    // Apply the same outlet matching logic as the fix
    let outletCondition = '';
    
    if (outletName) {
      // Primary matching: lokasi_pengiriman contains outlet name
      outletCondition += `LOWER(o.lokasi_pengiriman) LIKE LOWER('%${outletName}%')`;
      
      // Special matching for bonbin
      if (outletName.toLowerCase().includes('bonbin')) {
        outletCondition += ` OR LOWER(o.lokasi_pengiriman) LIKE LOWER('%bonbin%')`;
      }
    }
    
    // Secondary matching: outlet_id
    if (outletId) {
      if (outletCondition) outletCondition += ' OR ';
      outletCondition += `o.outlet_id = '${outletId}'`;
    }
    
    testQuery += ` AND (${outletCondition})`;
    
    console.log('Test Query for Outlet Bonbin:', testQuery);
    
    // Execute the test query
    const testResult = await env.DB.prepare(testQuery).all();
    
    // Get all orders with assigned_deliveryman_id for comparison
    const deliveryOrders = await env.DB.prepare(
      'SELECT * FROM orders WHERE assigned_deliveryman_id IS NOT NULL'
    ).all();

    return new Response(JSON.stringify({
      success: true,
      debug_info: {
        outlet_user: outletUser,
        outlet_name: outletName,
        outlet_id: outletId,
        test_query: testQuery,
        outlet_condition: outletCondition,
        outlet_orders_found: testResult.results?.length || 0,
        outlet_orders: testResult.results || [],
        delivery_orders_total: deliveryOrders.results?.length || 0,
        delivery_orders: deliveryOrders.results || []
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Debug Outlet Sync Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Debug endpoint to get order details and outlet matching analysis
 */
export async function debugOrderDetails(request, env) {
  // Add CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle OPTIONS request for CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    const orderId = 'ORDER-1752037059362-FLO3E';
    
    // Cari detail order
    const orderQuery = `SELECT * FROM orders WHERE id = ?`;
    const order = await env.DB.prepare(orderQuery).bind(orderId).first();
    
    if (!order) {
      return new Response(JSON.stringify({
        success: false,
        message: `Order dengan ID ${orderId} tidak ditemukan`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      });
    }
    
    // Cari semua outlet untuk perbandingan
    const outletsQuery = `SELECT id, name, location FROM outlets`;
    const outlets = await env.DB.prepare(outletsQuery).all();
    
    // Cek kecocokan dengan outlet
    const matches = [];
    
    // Format nilai untuk pencarian
    const lokasi_pengiriman = (order.lokasi_pengiriman || '').toLowerCase();
    const shipping_area = (order.shipping_area || '').toLowerCase();
    
    outlets.results.forEach(outlet => {
      const outletName = (outlet.name || '').toLowerCase();
      const outletLocation = (outlet.location || '').toLowerCase();
      
      const matched = 
        (order.outlet_id === outlet.id) || 
        lokasi_pengiriman.includes(outletName) || 
        shipping_area.includes(outletName) ||
        lokasi_pengiriman.includes(outletLocation) || 
        shipping_area.includes(outletLocation) ||
        lokasi_pengiriman.includes('bonbin') || 
        shipping_area.includes('bonbin');
      
      matches.push({
        outlet_id: outlet.id,
        outlet_name: outlet.name,
        outlet_location: outlet.location,
        matched: matched,
        match_reason: matched ? [
          order.outlet_id === outlet.id ? 'outlet_id match' : null,
          lokasi_pengiriman.includes(outletName) ? 'lokasi_pengiriman contains outlet name' : null,
          shipping_area.includes(outletName) ? 'shipping_area contains outlet name' : null,
          lokasi_pengiriman.includes(outletLocation) ? 'lokasi_pengiriman contains outlet location' : null,
          shipping_area.includes(outletLocation) ? 'shipping_area contains outlet location' : null,
          lokasi_pengiriman.includes('bonbin') ? 'lokasi_pengiriman contains bonbin' : null,
          shipping_area.includes('bonbin') ? 'shipping_area contains bonbin' : null
        ].filter(Boolean) : []
      });
    });
    
    return new Response(JSON.stringify({
      success: true,
      order: {
        id: order.id,
        customer_name: order.customer_name,
        lokasi_pengiriman: order.lokasi_pengiriman,
        shipping_area: order.shipping_area,
        outlet_id: order.outlet_id
      },
      outlets_match_analysis: matches,
      all_order_props: order
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Error saat debug order',
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
}
