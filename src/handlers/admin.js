/**
 * Admin handler functions for administrative operations
 */

/**
 * Reset admin password (for debugging purposes)
 */
export async function resetAdminPassword(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const bcrypt = require('bcryptjs');
    const newPassword = 'admin123'; // Default password for debugging
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update admin password in database
    const result = await env.DB.prepare(
      'UPDATE users SET password = ? WHERE username = ?'
    ).bind(hashedPassword, 'admin').run();

    if (result.success && result.meta.changes > 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Admin password reset successfully',
        username: 'admin',
        newPassword: newPassword
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'Admin user not found or password unchanged'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

  } catch (error) {
    console.error('Error resetting admin password:', error.message, error.stack);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Get admin statistics and dashboard data
 */
export async function getAdminStats(request, env) {
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

    // Get total orders count
    const totalOrdersResult = await env.DB.prepare(
      'SELECT COUNT(*) as total FROM orders'
    ).first();

    // Get pending payments count (treat legacy 'paid' as paid)
    const pendingPaymentsResult = await env.DB.prepare(
      "SELECT COUNT(*) as total FROM orders WHERE payment_status NOT IN ('settlement', 'capture', 'paid')"
    ).first();

    // Get paid orders count (include legacy 'paid')
    const paidOrdersResult = await env.DB.prepare(
      "SELECT COUNT(*) as total FROM orders WHERE payment_status IN ('settlement', 'capture', 'paid')"
    ).first();

    // Get orders in shipping count (include legacy 'paid')
    const shippingOrdersResult = await env.DB.prepare(
      "SELECT COUNT(*) as total FROM orders WHERE payment_status IN ('settlement', 'capture', 'paid') AND shipping_status NOT IN ('delivered', 'received')"
    ).first();

    const stats = {
      totalOrders: totalOrdersResult?.total || 0,
      pendingPayments: pendingPaymentsResult?.total || 0,
      paidOrders: paidOrdersResult?.total || 0,
      shippingOrders: shippingOrdersResult?.total || 0
    };

    return new Response(JSON.stringify({
      success: true,
      data: stats
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error getting admin stats:', error.message, error.stack);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get admin statistics'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * Get system health check for admin monitoring
 */
export async function getSystemHealth(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const health = {
      database: false,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };

    // Test database connection
    if (env.DB) {
      try {
        await env.DB.prepare('SELECT 1').first();
        health.database = true;
      } catch (dbError) {
        console.error('Database health check failed:', dbError);
        health.database = false;
        health.databaseError = dbError.message;
      }
    }

    const status = health.database ? 200 : 503;

    return new Response(JSON.stringify({
      success: health.database,
      data: health
    }), {
      status: status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Error checking system health:', error.message, error.stack);
    return new Response(JSON.stringify({
      success: false,
      error: 'Health check failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}