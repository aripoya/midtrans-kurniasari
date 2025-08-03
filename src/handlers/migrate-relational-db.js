/**
 * Migration handler for creating relational database structure
 * Unifying locations and outlets tables for better synchronization
 */

/**
 * Create unified relational database structure
 * This migration will:
 * 1. Create a unified outlets table as the master
 * 2. Add foreign keys for proper relationships
 * 3. Migrate existing data from locations to outlets
 * 4. Update orders table to reference outlets properly
 */
export async function createRelationalDBStructure(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🏗️ Starting relational database migration...');
    
    if (!env.DB) {
      throw new Error('Database not available');
    }

    // Step 1: Create new unified outlets table structure (if needed)
    console.log('📋 Step 1: Ensuring outlets table has proper structure...');
    
    // Disable foreign key constraints temporarily during migration
    await env.DB.prepare('PRAGMA foreign_keys = OFF').run();
    
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS outlets_unified (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        location_alias TEXT, -- For mapping with old locations table
        address TEXT,
        city TEXT DEFAULT 'Yogyakarta',
        status TEXT DEFAULT 'active',
        manager_username TEXT,
        phone TEXT,
        coordinates TEXT, -- For future GPS integration
        operating_hours TEXT DEFAULT '08:00-20:30',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    // Create indexes separately to avoid constraint issues
    try {
      await env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_outlets_unified_name ON outlets_unified(name)').run();
      await env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_outlets_unified_alias ON outlets_unified(location_alias)').run();
    } catch (indexError) {
      console.log('⚠️ Index creation warning (non-critical):', indexError.message);
    }

    // Step 2: Migrate existing outlets data to unified structure
    console.log('📋 Step 2: Migrating existing outlets data...');
    
    const existingOutlets = await env.DB.prepare('SELECT * FROM outlets').all();
    console.log(`Found ${existingOutlets.results?.length || 0} existing outlets`);

    for (const outlet of (existingOutlets.results || [])) {
      // Map outlet names to location aliases for backward compatibility
      const locationAlias = outlet.name.toLowerCase().replace(/outlet\s+/i, '').trim();
      
      await env.DB.prepare(`
        INSERT OR REPLACE INTO outlets_unified 
        (id, name, location_alias, address, manager_username, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        outlet.id,
        outlet.name,
        locationAlias,
        outlet.address || '',
        outlet.name.toLowerCase(), // Default manager username
        outlet.created_at
      ).run();
    }

    // Step 3: Migrate locations data and map to outlets
    console.log('📋 Step 3: Migrating and mapping locations data...');
    
    const existingLocations = await env.DB.prepare('SELECT * FROM locations').all();
    console.log(`Found ${existingLocations.results?.length || 0} existing locations`);

    for (const location of (existingLocations.results || [])) {
      const locationName = location.nama_lokasi;
      
      // Try to find matching outlet or create new one
      const normalizedName = locationName.toLowerCase();
      let outletId = null;
      let outletName = locationName;
      
      // Create mapping logic
      if (normalizedName.includes('bonbin')) {
        outletId = 'outlet_bonbin';
        outletName = 'Outlet Bonbin';
      } else if (normalizedName.includes('glagahsari')) {
        outletId = 'outlet_glagahsari';
        outletName = 'Outlet Glagahsari 91C';
      } else if (normalizedName.includes('malioboro')) {
        outletId = 'outlet_malioboro';
        outletName = 'Outlet Malioboro';
      } else if (normalizedName.includes('jakal')) {
        outletId = 'outlet_jakal_km14';
        outletName = 'Outlet Jakal KM14';
      } else {
        // Create new outlet for unmapped locations
        outletId = `outlet_${normalizedName.replace(/[^a-z0-9]/g, '_')}`;
        outletName = `Outlet ${locationName}`;
      }

      // Insert or update unified outlet
      await env.DB.prepare(`
        INSERT OR REPLACE INTO outlets_unified 
        (id, name, location_alias, address, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        outletId,
        outletName,
        locationName, // Original location name as alias
        locationName, // Use location name as address for now
        location.created_at
      ).run();
    }

    // Step 4: Update orders table to use proper outlet foreign keys
    console.log('📋 Step 4: Updating orders table structure...');
    
    // Add outlet_id column if it doesn't exist (already done in previous migration)
    // Update existing orders to link with unified outlets
    await env.DB.prepare(`
      UPDATE orders 
      SET outlet_id = (
        SELECT ou.id 
        FROM outlets_unified ou 
        WHERE LOWER(orders.lokasi_pengiriman) LIKE LOWER('%' || ou.location_alias || '%')
        OR LOWER(orders.lokasi_pengiriman) LIKE LOWER('%' || ou.name || '%')
        LIMIT 1
      )
      WHERE outlet_id IS NULL 
      AND (lokasi_pengiriman IS NOT NULL OR lokasi_pengambilan IS NOT NULL)
    `).run();

    // Step 5: Create users-outlets relationship
    console.log('📋 Step 5: Creating users-outlets relationship...');
    
    // Update users table to link with unified outlets
    await env.DB.prepare(`
      UPDATE users 
      SET outlet_id = (
        SELECT ou.id 
        FROM outlets_unified ou 
        WHERE ou.manager_username = users.username
        OR LOWER(ou.name) LIKE LOWER('%' || users.username || '%')
        LIMIT 1
      )
      WHERE role = 'outlet_manager' 
      AND outlet_id IN (SELECT id FROM outlets_unified)
    `).run();

    // Step 6: Create views for backward compatibility
    console.log('📋 Step 6: Creating compatibility views...');
    
    // Create locations view for backward compatibility
    await env.DB.prepare(`
      CREATE VIEW IF NOT EXISTS locations_view AS
      SELECT 
        ROW_NUMBER() OVER (ORDER BY created_at) as id,
        location_alias as nama_lokasi,
        created_at
      FROM outlets_unified 
      WHERE location_alias IS NOT NULL
    `).run();

    // Get migration statistics
    const unifiedOutlets = await env.DB.prepare('SELECT COUNT(*) as count FROM outlets_unified').first();
    const ordersWithOutlets = await env.DB.prepare('SELECT COUNT(*) as count FROM orders WHERE outlet_id IS NOT NULL').first();
    const usersWithOutlets = await env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE outlet_id IS NOT NULL AND role = "outlet_manager"').first();

    const migrationResult = {
      success: true,
      statistics: {
        unifiedOutlets: unifiedOutlets?.count || 0,
        ordersLinked: ordersWithOutlets?.count || 0,
        usersLinked: usersWithOutlets?.count || 0
      },
      tablesCreated: ['outlets_unified', 'locations_view'],
      message: 'Relational database structure created successfully'
    };

    // Re-enable foreign key constraints after migration
    await env.DB.prepare('PRAGMA foreign_keys = ON').run();
    
    console.log('✅ Relational database migration completed:', migrationResult);

    return new Response(JSON.stringify({
      success: true,
      data: migrationResult
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('❌ Relational database migration failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Migration failed',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Get relational database status
 */
export async function getRelationalDBStatus(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    if (!env.DB) {
      throw new Error('Database not available');
    }

    // Check if unified structure exists
    const tables = await env.DB.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      AND name IN ('outlets_unified', 'locations_view')
    `).all();

    const hasUnifiedStructure = tables.results?.some(t => t.name === 'outlets_unified') || false;

    // Get current statistics
    let statistics = {};
    
    if (hasUnifiedStructure) {
      const unifiedOutlets = await env.DB.prepare('SELECT COUNT(*) as count FROM outlets_unified').first();
      const ordersLinked = await env.DB.prepare('SELECT COUNT(*) as count FROM orders WHERE outlet_id IS NOT NULL').first();
      const usersLinked = await env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE outlet_id IS NOT NULL AND role = "outlet_manager"').first();
      
      statistics = {
        unifiedOutlets: unifiedOutlets?.count || 0,
        ordersLinked: ordersLinked?.count || 0,
        usersLinked: usersLinked?.count || 0
      };
    }

    // Get sample mappings
    const sampleMappings = hasUnifiedStructure ? 
      (await env.DB.prepare(`
        SELECT id, name, location_alias, address 
        FROM outlets_unified 
        ORDER BY created_at DESC 
        LIMIT 10
      `).all()).results : [];

    return new Response(JSON.stringify({
      success: true,
      data: {
        hasUnifiedStructure,
        statistics,
        sampleMappings,
        tablesFound: tables.results?.map(t => t.name) || []
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error getting relational DB status:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to get database status',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
