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
    
    // Parse options (query or JSON body)
    const url = new URL(request.url);
    let force = url.searchParams.get('force') === 'true';
    let dryRun = url.searchParams.get('dryRun') === 'true';
    // Backups are enabled by default; disable via backup=false
    let backup = true;
    const qpBackup = url.searchParams.get('backup');
    if (qpBackup === 'false') backup = false;
    if (qpBackup === 'true') backup = true;
    try {
      const body = await request.json();
      if (body && typeof body === 'object') {
        if (body.force === true) force = true;
        if (body.dryRun === true) dryRun = true;
        if (typeof body.backup === 'boolean') backup = body.backup;
      }
    } catch (e) {
      // ignore non-JSON bodies
    }
    console.log('⚙️ Options:', { force, dryRun, backup });

    // Step 0: Ensure required columns exist (orders.outlet_id, users.outlet_id)
    console.log('🧱 Step 0: Ensuring required columns exist...');
    try {
      // Check orders table has outlet_id
      const ordersColumns = await env.DB.prepare("PRAGMA table_info('orders')").all();
      const hasOrdersOutletId = (ordersColumns.results || []).some(col => col.name === 'outlet_id');
      if (!hasOrdersOutletId) {
        if (dryRun) {
          console.log('⏭️ Dry run: would add outlet_id TEXT column to orders');
        } else {
          console.log('➕ Adding outlet_id column to orders');
          await env.DB.prepare("ALTER TABLE orders ADD COLUMN outlet_id TEXT").run();
        }
      } else {
        console.log('✅ orders.outlet_id already exists');
      }

      // Check users table has outlet_id
      const usersColumns = await env.DB.prepare("PRAGMA table_info('users')").all();
      const hasUsersOutletId = (usersColumns.results || []).some(col => col.name === 'outlet_id');
      if (!hasUsersOutletId) {
        if (dryRun) {
          console.log('⏭️ Dry run: would add outlet_id TEXT column to users');
        } else {
          console.log('➕ Adding outlet_id column to users');
          await env.DB.prepare("ALTER TABLE users ADD COLUMN outlet_id TEXT").run();
        }
      } else {
        console.log('✅ users.outlet_id already exists');
      }
    } catch (schemaErr) {
      console.warn('⚠️ Schema check warning (non-fatal):', schemaErr?.message || schemaErr);
    }

    // Check unified table existence to allow idempotent runs
    const unifiedTableCheck = await env.DB.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='outlets_unified'
    `).first();
    const unifiedTableExists = !!unifiedTableCheck;

    // Step 1: Backup existing data first
    console.log('💾 Step 1: Backing up existing data...');
    let backupsCreated = 0;
    
    let existingOutlets = { results: [] };
    let existingLocations = { results: [] };
    try {
      existingOutlets = await env.DB.prepare('SELECT * FROM outlets').all();
    } catch (e) {
      console.warn('⚠️ outlets table not found, continuing without outlets backup');
    }
    try {
      existingLocations = await env.DB.prepare('SELECT * FROM locations').all();
    } catch (e) {
      console.warn('⚠️ locations table not found, continuing without locations backup');
    }
    
    console.log(`Backing up ${existingOutlets.results?.length || 0} outlets and ${existingLocations.results?.length || 0} locations`);
    try {
      if (backup) {
        if (dryRun) {
          console.log(`⏭️ Dry run: would create JSON backups for outlets=${existingOutlets.results?.length || 0}, locations=${existingLocations.results?.length || 0}`);
        } else {
          // Create backup table and store JSON snapshots
          await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS migration_backups (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              source_table TEXT NOT NULL,
              rows_count INTEGER,
              data_json TEXT NOT NULL
            )
          `).run();

          if ((existingOutlets.results || []).length > 0) {
            await env.DB.prepare(`
              INSERT INTO migration_backups (source_table, rows_count, data_json)
              VALUES (?, ?, ?)
            `).bind(
              'outlets',
              existingOutlets.results.length,
              JSON.stringify(existingOutlets.results)
            ).run();
            backupsCreated += 1;
          }

          if ((existingLocations.results || []).length > 0) {
            await env.DB.prepare(`
              INSERT INTO migration_backups (source_table, rows_count, data_json)
              VALUES (?, ?, ?)
            `).bind(
              'locations',
              existingLocations.results.length,
              JSON.stringify(existingLocations.results)
            ).run();
            backupsCreated += 1;
          }
          console.log(`✅ JSON backups stored (entries created: ${backupsCreated})`);
        }
      } else {
        console.log('ℹ️ Backups disabled by option; skipping data snapshot');
      }
    } catch (backupErr) {
      console.warn('⚠️ Backup step warning (non-fatal):', backupErr?.message || backupErr);
    }

    // Step 2: Create outlets_unified table (fresh, no constraints initially)
    const recreateUnified = (!unifiedTableExists || force);
    if (dryRun) {
      console.log('⏭️ Dry run: skipping outlets_unified drop/create and population');
    } else if (recreateUnified) {
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

      // Helpful indexes for faster lookups
      await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_outlets_unified_name ON outlets_unified(name)').run();
      await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_outlets_unified_location_alias ON outlets_unified(location_alias)').run();
      await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_outlets_unified_manager_username ON outlets_unified(manager_username)').run();
      
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
    } else {
      console.log('⏭️ Step 2-4 skipped: outlets_unified exists and force=false');
    }

    // Step 5: Update orders table to use proper outlet_id (safe & fast bulk approach)
    console.log('📋 Step 5: Updating orders with outlet assignments (bulk)...');
    
    let ordersUpdated = 0;
    // Build WHERE clause depending on force mode
    const ordersWhereClause = force
      ? `(outlet_id IS NULL OR outlet_id NOT IN (SELECT id FROM outlets_unified))`
      : `outlet_id IS NULL`;
    const bulkOrdersUpdateQuery = `
        UPDATE orders SET 
          outlet_id = (
            SELECT ou.id 
            FROM outlets_unified ou 
            WHERE 
              (orders.lokasi_pengiriman IS NOT NULL AND (
                LOWER(orders.lokasi_pengiriman) LIKE LOWER('%' || ou.name || '%') OR
                LOWER(orders.lokasi_pengiriman) LIKE LOWER('%' || ou.location_alias || '%')
              ))
              OR (orders.lokasi_pengambilan IS NOT NULL AND (
                LOWER(orders.lokasi_pengambilan) LIKE LOWER('%' || ou.name || '%') OR
                LOWER(orders.lokasi_pengambilan) LIKE LOWER('%' || ou.location_alias || '%')
              ))
              OR (orders.shipping_area IS NOT NULL AND (
                LOWER(orders.shipping_area) LIKE LOWER('%' || ou.name || '%') OR
                LOWER(orders.shipping_area) LIKE LOWER('%' || ou.location_alias || '%')
              ))
            LIMIT 1
          )
        WHERE ${ordersWhereClause}
          AND (lokasi_pengiriman IS NOT NULL OR lokasi_pengambilan IS NOT NULL OR shipping_area IS NOT NULL)
          AND EXISTS (
            SELECT 1 FROM outlets_unified ou2
            WHERE 
              (orders.lokasi_pengiriman IS NOT NULL AND (
                LOWER(orders.lokasi_pengiriman) LIKE LOWER('%' || ou2.name || '%') OR
                LOWER(orders.lokasi_pengiriman) LIKE LOWER('%' || ou2.location_alias || '%')
              ))
              OR (orders.lokasi_pengambilan IS NOT NULL AND (
                LOWER(orders.lokasi_pengambilan) LIKE LOWER('%' || ou2.name || '%') OR
                LOWER(orders.lokasi_pengambilan) LIKE LOWER('%' || ou2.location_alias || '%')
              ))
              OR (orders.shipping_area IS NOT NULL AND (
                LOWER(orders.shipping_area) LIKE LOWER('%' || ou2.name || '%') OR
                LOWER(orders.shipping_area) LIKE LOWER('%' || ou2.location_alias || '%')
              ))
          )
      `;
    if (!dryRun) {
      const bulkOrdersUpdateResult = await env.DB.prepare(bulkOrdersUpdateQuery).run();
      ordersUpdated = bulkOrdersUpdateResult?.changes || 0;
    } else {
      try {
        const previewOrdersCountQuery = `
          SELECT COUNT(*) as count FROM orders
          WHERE ${ordersWhereClause}
            AND (lokasi_pengiriman IS NOT NULL OR lokasi_pengambilan IS NOT NULL OR shipping_area IS NOT NULL)
            AND EXISTS (
              SELECT 1 FROM outlets_unified ou2
              WHERE 
                (orders.lokasi_pengiriman IS NOT NULL AND (
                  LOWER(orders.lokasi_pengiriman) LIKE LOWER('%' || ou2.name || '%') OR
                  LOWER(orders.lokasi_pengiriman) LIKE LOWER('%' || ou2.location_alias || '%')
                ))
                OR (orders.lokasi_pengambilan IS NOT NULL AND (
                  LOWER(orders.lokasi_pengambilan) LIKE LOWER('%' || ou2.name || '%') OR
                  LOWER(orders.lokasi_pengambilan) LIKE LOWER('%' || ou2.location_alias || '%')
                ))
                OR (orders.shipping_area IS NOT NULL AND (
                  LOWER(orders.shipping_area) LIKE LOWER('%' || ou2.name || '%') OR
                  LOWER(orders.shipping_area) LIKE LOWER('%' || ou2.location_alias || '%')
                ))
            )
        `;
        const previewOrders = await env.DB.prepare(previewOrdersCountQuery).first();
        ordersUpdated = previewOrders?.count || 0;
        console.log(`⏭️ Dry run: would update approximately ${ordersUpdated} orders`);
      } catch (previewErr) {
        console.log('⚠️ Dry run preview failed for orders:', previewErr?.message || previewErr);
      }
    }
    
    console.log(`✅ Updated ${ordersUpdated} orders with outlet assignments`);

    // Step 6: Update users table outlet_id (safe & fast bulk approach)  
    console.log('📋 Step 6: Updating users with outlet assignments (bulk)...');
    
    let usersUpdated = 0;
    const usersWhereClause = force
      ? `role = 'outlet_manager'`
      : `role = 'outlet_manager' AND (outlet_id IS NULL OR outlet_id NOT IN (SELECT id FROM outlets_unified))`;
    const bulkUsersUpdateQuery = `
        UPDATE users SET 
          outlet_id = (
            SELECT id FROM outlets_unified 
            WHERE LOWER(manager_username) = LOWER(users.username)
               OR LOWER(name) LIKE LOWER('%' || users.username || '%')
               OR LOWER(location_alias) LIKE LOWER('%' || users.username || '%')
            LIMIT 1
          )
        WHERE ${usersWhereClause}
          AND EXISTS (
            SELECT 1 FROM outlets_unified 
            WHERE LOWER(manager_username) = LOWER(users.username)
               OR LOWER(name) LIKE LOWER('%' || users.username || '%')
               OR LOWER(location_alias) LIKE LOWER('%' || users.username || '%')
          )
      `;
    if (!dryRun) {
      const bulkUsersUpdateResult = await env.DB.prepare(bulkUsersUpdateQuery).run();
      usersUpdated = bulkUsersUpdateResult?.changes || 0;
    } else {
      try {
        const previewUsersCountQuery = `
          SELECT COUNT(*) as count FROM users
          WHERE ${usersWhereClause}
            AND EXISTS (
              SELECT 1 FROM outlets_unified 
              WHERE LOWER(manager_username) = LOWER(users.username)
                 OR LOWER(name) LIKE LOWER('%' || users.username || '%')
                 OR LOWER(location_alias) LIKE LOWER('%' || users.username || '%')
            )
        `;
        const previewUsers = await env.DB.prepare(previewUsersCountQuery).first();
        usersUpdated = previewUsers?.count || 0;
        console.log(`⏭️ Dry run: would update approximately ${usersUpdated} users`);
      } catch (previewErr) {
        console.log('⚠️ Dry run preview failed for users:', previewErr?.message || previewErr);
      }
    }
    
    console.log(`✅ Updated ${usersUpdated} users with outlet assignments`);

    // Step 6.5: Ensure helpful indexes on lookup columns
    console.log('🧭 Step 6.5: Ensuring indexes for performance...');
    if (dryRun) {
      console.log('⏭️ Dry run: would create indexes idx_orders_outlet_id and idx_users_outlet_id');
    } else {
      try {
        await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_orders_outlet_id ON orders(outlet_id)').run();
      } catch (idxErr1) {
        console.warn('⚠️ Could not create idx_orders_outlet_id:', idxErr1?.message || idxErr1);
      }
      try {
        await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_users_outlet_id ON users(outlet_id)').run();
      } catch (idxErr2) {
        console.warn('⚠️ Could not create idx_users_outlet_id:', idxErr2?.message || idxErr2);
      }
    }

    // Step 7: Get final statistics
    let finalStats = { count: 0 };
    try {
      const unifiedTableNow = await env.DB.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='outlets_unified'
      `).first();
      if (unifiedTableNow) {
        finalStats = await env.DB.prepare('SELECT COUNT(*) as count FROM outlets_unified').first();
      }
    } catch (_) {
      finalStats = { count: 0 };
    }
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
      skippedRecreate: dryRun ? true : !recreateUnified,
      options: { force, dryRun, backup },
      backupsCreated,
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
