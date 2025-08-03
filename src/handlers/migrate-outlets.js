/**
 * Migration handler for assigning outlets to existing orders
 * This endpoint will process existing orders that don't have outlet_id assigned
 */

import { autoAssignOutletsToExistingOrders } from './outlet-assignment.js';

/**
 * Migrate existing orders to assign outlet_id based on location data
 */
export async function migrateExistingOrdersToOutlets(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle OPTIONS request for CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting migration of existing orders to outlets...');
    
    // Run the auto-assignment function
    const migrationResult = await autoAssignOutletsToExistingOrders(env);
    
    console.log('✅ Migration completed successfully:', migrationResult);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Migration completed successfully',
      data: migrationResult
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    
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
 * Get migration status and statistics
 */
export async function getMigrationStatus(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    if (!env.DB) {
      throw new Error('Database not available');
    }

    // Get statistics about outlet assignments
    const totalOrders = await env.DB.prepare(
      'SELECT COUNT(*) as total FROM orders'
    ).first();

    const ordersWithOutlet = await env.DB.prepare(
      'SELECT COUNT(*) as total FROM orders WHERE outlet_id IS NOT NULL AND outlet_id != ""'
    ).first();

    const ordersWithoutOutlet = await env.DB.prepare(
      'SELECT COUNT(*) as total FROM orders WHERE outlet_id IS NULL OR outlet_id = ""'
    ).first();

    // Get breakdown by outlet
    const outletBreakdown = await env.DB.prepare(`
      SELECT 
        outlet_id,
        COUNT(*) as order_count
      FROM orders 
      WHERE outlet_id IS NOT NULL AND outlet_id != ""
      GROUP BY outlet_id
      ORDER BY order_count DESC
    `).all();

    // Get sample unmigrated orders
    const sampleUnmigrated = await env.DB.prepare(`
      SELECT 
        id, 
        lokasi_pengiriman, 
        lokasi_pengambilan, 
        shipping_area,
        created_at
      FROM orders 
      WHERE outlet_id IS NULL OR outlet_id = ""
      ORDER BY created_at DESC
      LIMIT 10
    `).all();

    const migrationStatus = {
      statistics: {
        totalOrders: totalOrders?.total || 0,
        ordersWithOutlet: ordersWithOutlet?.total || 0,
        ordersWithoutOutlet: ordersWithoutOutlet?.total || 0,
        migrationProgress: totalOrders?.total > 0 
          ? Math.round((ordersWithOutlet?.total || 0) / totalOrders.total * 100)
          : 0
      },
      outletBreakdown: outletBreakdown?.results || [],
      sampleUnmigratedOrders: sampleUnmigrated?.results || [],
      needsMigration: (ordersWithoutOutlet?.total || 0) > 0
    };

    return new Response(JSON.stringify({
      success: true,
      data: migrationStatus
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error getting migration status:', error);
    
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
