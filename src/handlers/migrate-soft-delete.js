/**
 * Migration to add soft delete columns to orders table
 * Adds deleted_at and deleted_by columns
 */

export async function migrateSoftDelete(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!env.DB) {
      throw new Error('Database binding not found');
    }

    const steps = [];
    
    // Step 1: Check if columns already exist
    try {
      const checkQuery = await env.DB.prepare(
        `SELECT deleted_at, deleted_by FROM orders LIMIT 1`
      ).all();
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Soft delete columns already exist',
        alreadyMigrated: true,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    } catch (e) {
      // Columns don't exist, proceed with migration
      steps.push('Columns do not exist, proceeding with migration');
    }

    // Step 2: Add deleted_at column
    try {
      await env.DB.prepare(`
        ALTER TABLE orders ADD COLUMN deleted_at TEXT
      `).run();
      steps.push('✅ Added deleted_at column');
    } catch (e) {
      if (!e.message.includes('duplicate column name')) {
        throw e;
      }
      steps.push('⚠️ deleted_at column already exists');
    }

    // Step 3: Add deleted_by column
    try {
      await env.DB.prepare(`
        ALTER TABLE orders ADD COLUMN deleted_by TEXT
      `).run();
      steps.push('✅ Added deleted_by column');
    } catch (e) {
      if (!e.message.includes('duplicate column name')) {
        throw e;
      }
      steps.push('⚠️ deleted_by column already exists');
    }

    // Step 4: Verify the migration
    const verifyQuery = await env.DB.prepare(
      `SELECT deleted_at, deleted_by FROM orders LIMIT 1`
    ).all();
    
    steps.push('✅ Migration verified successfully');

    return new Response(JSON.stringify({
      success: true,
      message: 'Soft delete migration completed successfully',
      steps,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Soft Delete Migration Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Migration failed',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

export async function getSoftDeleteMigrationStatus(request, env) {
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
      throw new Error('Database binding not found');
    }

    // Check if columns exist
    let migrated = false;
    let deletedCount = 0;
    
    try {
      const checkQuery = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM orders WHERE deleted_at IS NOT NULL`
      ).first();
      
      migrated = true;
      deletedCount = checkQuery.count || 0;
    } catch (e) {
      migrated = false;
    }

    return new Response(JSON.stringify({
      success: true,
      migrated,
      deletedOrdersCount: deletedCount,
      message: migrated 
        ? `Soft delete is active. ${deletedCount} deleted orders.`
        : 'Soft delete not yet migrated'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Get Migration Status Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get migration status',
      details: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
