/**
 * SAFE Migration handler for creating relational database structure
 * Using DROP/CREATE approach to avoid constraint issues completely
 */

/**
 * Safe migration that drops and recreates tables to avoid constraints
 */
export async function migrateSafeRelationalDB(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🛡️ Starting SAFE relational database migration...');
    
    if (!env.DB) {
      throw new Error('Database not available');
    }

    // Step 1: Backup existing data first
    console.log('💾 Step 1: Backing up existing data...');
    
    const existingOutlets = await env.DB.prepare('SELECT * FROM outlets').all();
    const existingLocations = await env.DB.prepare('SELECT * FROM locations').all();
    
    console.log(`Backing up ${existingOutlets.results?.length || 0} outlets and ${existingLocations.results?.length || 0} locations`);

    // Step 2: Create outlets_unified table (fresh, no constraints initially)
    console.log('🏗️ Step 2: Creating fresh outlets_unified table...');
    
    // Drop if exists to start fresh
    await env.DB.prepare('DROP TABLE IF EXISTS outlets_unified').run();
    
    await env.DB.prepare(`
      CREATE TABLE outlets_unified (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        location_alias TEXT,
        address TEXT,
        city TEXT DEFAULT 'Yogyakarta',
        status TEXT DEFAULT 'active',
        manager_username TEXT,
        phone TEXT,
        coordinates TEXT,
        operating_hours TEXT DEFAULT '08:00-20:30',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    console.log('✅ outlets_unified table created successfully');

    // Step 3: Populate outlets_unified with existing outlet data
    console.log('📋 Step 3: Populating with existing outlets...');
    
    for (const outlet of (existingOutlets.results || [])) {
      const locationAlias = outlet.name.toLowerCase().replace(/outlet\s+/i, '').trim();
      
      await env.DB.prepare(`
        INSERT INTO outlets_unified 
        (id, name, location_alias, address, manager_username, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        outlet.id,
        outlet.name,
        locationAlias,
        outlet.address || '',
        outlet.name.toLowerCase(),
        outlet.created_at
      ).run();
    }
    
    console.log(`✅ Migrated ${existingOutlets.results?.length || 0} outlets`);

    // Step 4: Add location data as outlets if not already present
    console.log('📋 Step 4: Adding locations as outlets...');
    
    for (const location of (existingLocations.results || [])) {
      const locationName = location.nama_lokasi;
      const normalizedName = locationName.toLowerCase();
      
      // Create outlet mapping
      let outletId = null;
      let outletName = locationName;
      
      if (normalizedName.includes('bonbin')) {
        outletId = 'outlet_bonbin';
        outletName = 'Outlet Bonbin';
      } else if (normalizedName.includes('glagahsari')) {
        outletId = 'outlet_glagahsari';
        outletName = 'Outlet Glagahsari 91C';
      } else if (normalizedName.includes('malioboro') || normalizedName.includes('monjali')) {
        outletId = 'outlet_malioboro';
        outletName = 'Outlet Monjali';
      } else if (normalizedName.includes('jakal')) {
        outletId = 'outlet_jakal_km14';
        outletName = 'Outlet Jakal KM14';
      } else if (normalizedName.includes('pogung')) {
        outletId = 'outlet_pogung';
        outletName = 'Outlet Pogung';
      } else if (normalizedName.includes('godean')) {
        outletId = 'outlet_godean';
        outletName = 'Outlet Godean';
      } else if (normalizedName.includes('wates')) {
        outletId = 'outlet_wates';
        outletName = 'Outlet Jalan Wates';
      } else if (normalizedName.includes('wonosari')) {
        outletId = 'outlet_wonosari';
        outletName = 'Outlet Jalan Wonosari';
      } else if (normalizedName.includes('ahmad') || normalizedName.includes('dahlan')) {
        outletId = 'outlet_ahmad_dahlan';
        outletName = 'Outlet Ahmad Dahlan';
      } else {
        // Create new outlet for unmapped locations
        outletId = `outlet_${normalizedName.replace(/[^a-z0-9]/g, '_')}`;
        outletName = `Outlet ${locationName}`;
      }

      // Insert or replace - use INSERT OR REPLACE to avoid duplicates
      await env.DB.prepare(`
        INSERT OR REPLACE INTO outlets_unified 
        (id, name, location_alias, address, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        outletId,
        outletName,
        locationName,
        locationName, // Use as address for now
        location.created_at
      ).run();
    }
    
    console.log(`✅ Processed ${existingLocations.results?.length || 0} locations`);

    // Step 5: Update orders table to use proper outlet_id (safe approach)
    console.log('📋 Step 5: Updating orders with outlet assignments...');
    
    // Update orders one by one to avoid bulk constraint issues
    const ordersToUpdate = await env.DB.prepare(`
      SELECT id, lokasi_pengiriman, lokasi_pengambilan, shipping_area, outlet_id
      FROM orders 
      WHERE outlet_id IS NULL 
      AND (lokasi_pengiriman IS NOT NULL OR lokasi_pengambilan IS NOT NULL)
      LIMIT 100
    `).all();
    
    let ordersUpdated = 0;
    
    for (const order of (ordersToUpdate.results || [])) {
      // Find matching outlet
      const matchingOutlet = await env.DB.prepare(`
        SELECT id FROM outlets_unified 
        WHERE (LOWER(?) LIKE LOWER('%' || location_alias || '%')
        OR LOWER(?) LIKE LOWER('%' || name || '%'))
        LIMIT 1
      `).bind(
        order.lokasi_pengiriman || '',
        order.lokasi_pengiriman || ''
      ).first();
      
      if (matchingOutlet) {
        await env.DB.prepare(`
          UPDATE orders SET outlet_id = ? WHERE id = ?
        `).bind(matchingOutlet.id, order.id).run();
        ordersUpdated++;
      }
    }
    
    console.log(`✅ Updated ${ordersUpdated} orders with outlet assignments`);

    // Step 6: Update users table outlet_id (safe approach)  
    console.log('📋 Step 6: Updating users with outlet assignments...');
    
    const usersToUpdate = await env.DB.prepare(`
      SELECT id, username, outlet_id 
      FROM users 
      WHERE role = 'outlet_manager' 
      AND (outlet_id IS NULL OR outlet_id NOT IN (SELECT id FROM outlets_unified))
    `).all();
    
    let usersUpdated = 0;
    
    for (const user of (usersToUpdate.results || [])) {
      // Find matching outlet by username
      const matchingOutlet = await env.DB.prepare(`
        SELECT id FROM outlets_unified 
        WHERE LOWER(manager_username) = LOWER(?)
        OR LOWER(name) LIKE LOWER('%' || ? || '%')
        LIMIT 1
      `).bind(user.username, user.username).first();
      
      if (matchingOutlet) {
        await env.DB.prepare(`
          UPDATE users SET outlet_id = ? WHERE id = ?
        `).bind(matchingOutlet.id, user.id).run();
        usersUpdated++;
      }
    }
    
    console.log(`✅ Updated ${usersUpdated} users with outlet assignments`);

    // Step 7: Get final statistics
    const finalStats = await env.DB.prepare('SELECT COUNT(*) as count FROM outlets_unified').first();
    const ordersLinked = await env.DB.prepare('SELECT COUNT(*) as count FROM orders WHERE outlet_id IS NOT NULL').first();
    const usersLinked = await env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE outlet_id IS NOT NULL AND role = "outlet_manager"').first();

    const migrationResult = {
      success: true,
      statistics: {
        unifiedOutlets: finalStats?.count || 0,
        ordersLinked: ordersLinked?.count || 0,
        usersLinked: usersLinked?.count || 0,
        ordersUpdated,
        usersUpdated
      },
      tablesCreated: ['outlets_unified'],
      message: 'Safe relational database migration completed successfully'
    };

    console.log('🎉 Safe relational database migration completed:', migrationResult);

    return new Response(JSON.stringify({
      success: true,
      data: migrationResult
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('❌ Safe migration failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Safe migration failed',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Get safe migration status
 */
export async function getSafeMigrationStatus(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    if (!env.DB) {
      throw new Error('Database not available');
    }

    // Check if outlets_unified exists
    const unifiedTable = await env.DB.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='outlets_unified'
    `).first();

    const hasUnifiedStructure = !!unifiedTable;

    // Get current statistics
    let statistics = {};
    
    if (hasUnifiedStructure) {
      const outlets = await env.DB.prepare('SELECT COUNT(*) as count FROM outlets_unified').first();
      const orders = await env.DB.prepare('SELECT COUNT(*) as count FROM orders WHERE outlet_id IS NOT NULL').first();
      const users = await env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE outlet_id IS NOT NULL AND role = "outlet_manager"').first();
      
      statistics = {
        unifiedOutlets: outlets?.count || 0,
        ordersLinked: orders?.count || 0,
        usersLinked: users?.count || 0
      };
    }

    // Get sample outlets
    const sampleOutlets = hasUnifiedStructure ? 
      (await env.DB.prepare(`
        SELECT id, name, location_alias, address 
        FROM outlets_unified 
        ORDER BY created_at DESC 
        LIMIT 5
      `).all()).results : [];

    return new Response(JSON.stringify({
      success: true,
      data: {
        hasUnifiedStructure,
        statistics,
        sampleOutlets,
        migrationMethod: 'safe_drop_create'
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error getting safe migration status:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to get migration status',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
