/**
 * Database Migration: Add Shipping Info Fields to Orders Table
 * Adds pickup_method, courier_service, and shipping_notes columns
 */

export async function migrateShippingInfoFields(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚚 Starting shipping info fields migration...');
    
    if (!env.DB) {
      throw new Error('Database not available');
    }

    // Step 1: Check if columns already exist
    console.log('🔍 Step 1: Checking existing orders table schema...');
    
    const tableInfo = await env.DB.prepare('PRAGMA table_info(orders)').all();
    const existingColumns = tableInfo.results.map(col => col.name);
    
    console.log('Existing columns:', existingColumns);

    // Step 2: Add missing shipping info columns
    const requiredColumns = [
      { name: 'pickup_method', type: 'TEXT' },
      { name: 'courier_service', type: 'TEXT' },
      { name: 'shipping_notes', type: 'TEXT' }
    ];

    let addedColumns = [];
    
    for (const column of requiredColumns) {
      if (!existingColumns.includes(column.name)) {
        console.log(`➕ Adding column: ${column.name} (${column.type})`);
        
        await env.DB.prepare(`
          ALTER TABLE orders ADD COLUMN ${column.name} ${column.type}
        `).run();
        
        addedColumns.push(column.name);
      } else {
        console.log(`✅ Column ${column.name} already exists`);
      }
    }

    // Step 3: Verify migration success
    console.log('🔍 Step 3: Verifying migration...');
    
    const updatedTableInfo = await env.DB.prepare('PRAGMA table_info(orders)').all();
    const updatedColumns = updatedTableInfo.results.map(col => col.name);
    
    console.log('Updated columns:', updatedColumns);

    // Step 4: Test insert with new fields
    console.log('🧪 Step 4: Testing insert with new fields...');
    
    const testOrderId = `TEST-${Date.now()}`;
    
    try {
      await env.DB.prepare(`
        INSERT INTO orders (id, customer_name, customer_email, customer_phone, total_amount, shipping_status, pickup_method, courier_service, shipping_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        testOrderId,
        'Test Customer',
        'test@example.com',
        '081234567890',
        10000,
        'pending',
        'delivery',
        'travel',
        'Test shipping notes'
      ).run();

      console.log('✅ Test insert successful');

      // Clean up test record
      await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(testOrderId).run();
      console.log('🧹 Test record cleaned up');

    } catch (testError) {
      console.error('❌ Test insert failed:', testError.message);
      throw new Error(`Test insert failed: ${testError.message}`);
    }

    const migrationResult = {
      success: true,
      message: 'Shipping info fields migration completed successfully',
      details: {
        addedColumns: addedColumns,
        existingColumns: existingColumns.filter(col => requiredColumns.some(req => req.name === col)),
        totalShippingColumns: requiredColumns.length,
        testInsertSuccess: true
      }
    };

    console.log('🎉 Migration completed successfully:', migrationResult);

    return new Response(JSON.stringify(migrationResult), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Shipping info fields migration failed',
      error: error.message,
      details: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Get current orders table schema for debugging
 */
export async function getOrdersTableSchema(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!env.DB) {
      throw new Error('Database not available');
    }

    const tableInfo = await env.DB.prepare('PRAGMA table_info(orders)').all();
    
    return new Response(JSON.stringify({
      success: true,
      schema: tableInfo.results,
      columnNames: tableInfo.results.map(col => col.name),
      totalColumns: tableInfo.results.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error getting table schema:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
