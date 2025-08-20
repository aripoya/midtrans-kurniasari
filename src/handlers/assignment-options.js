/**
 * Get assignment options for outlets and delivery users
 */

export async function getAssignmentOptions(request, env) {
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

    // Get all available outlets
    const outletsResult = await env.DB.prepare(`
      SELECT id, name, location_alias, address
      FROM outlets_unified 
      WHERE status = 'active' OR status IS NULL
      ORDER BY name ASC
    `).all();

    // Get all delivery users  
    const deliveryUsersResult = await env.DB.prepare(`
      SELECT u.id, u.username, u.name, u.outlet_id, ou.name as outlet_name
      FROM users u
      LEFT JOIN outlets_unified ou ON u.outlet_id = ou.id
      WHERE u.role = 'deliveryman'
      ORDER BY u.username ASC
    `).all();

    return new Response(JSON.stringify({
      success: true,
      data: {
        outlets: outletsResult.results || [],
        delivery_users: deliveryUsersResult.results || []
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error getting assignment options:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}
