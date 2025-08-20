/**
 * Debug delivery dashboard synchronization issues
 */

export async function debugDeliverySync(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const orderId = url.searchParams.get('order_id') || 'ORDER-1755657889902-X5MAT';
    
    console.log(`🔍 Debugging delivery sync for order: ${orderId}`);
    
    // 1. Check delivery user details
    const deliveryUser = await env.DB.prepare(`
      SELECT id, username, role, outlet_id, created_at
      FROM users 
      WHERE role = 'deliveryman'
    `).all();
    
    // 2. Check specific order details
    const orderDetails = await env.DB.prepare(`
      SELECT id, customer_name, outlet_id, assigned_deliveryman_id, pickup_method, lokasi_pengiriman, shipping_area
      FROM orders 
      WHERE id = ?
    `).bind(orderId).first();
    
    // 3. Check outlet assignments for bonbin
    const bonbinOutlet = await env.DB.prepare(`
      SELECT id, name, location_alias
      FROM outlets_unified 
      WHERE LOWER(name) LIKE '%bonbin%' OR id = 'outlet_bonbin'
    `).first();
    
    // 4. Simulate delivery query for this specific order
    let deliveryQueryResults = [];
    for (const user of (deliveryUser.results || [])) {
      const deliveryOrders = await env.DB.prepare(`
        SELECT id, customer_name, assigned_deliveryman_id, pickup_method, outlet_id
        FROM orders
        WHERE assigned_deliveryman_id = ? OR pickup_method = 'deliveryman'
        ORDER BY created_at DESC
      `).bind(user.id).all();
      
      deliveryQueryResults.push({
        user: user,
        orders_count: deliveryOrders.results?.length || 0,
        orders: deliveryOrders.results || [],
        has_target_order: (deliveryOrders.results || []).some(o => o.id === orderId)
      });
    }
    
    // 5. Check what orders should be visible based on outlet
    const outletBasedQuery = bonbinOutlet ? await env.DB.prepare(`
      SELECT id, customer_name, outlet_id, assigned_deliveryman_id, pickup_method
      FROM orders
      WHERE outlet_id = ? 
      ORDER BY created_at DESC
      LIMIT 10
    `).bind(bonbinOutlet.id).all() : { results: [] };
    
    // 6. Generate recommendations
    let recommendations = [];
    
    if (!orderDetails) {
      recommendations.push({
        issue: "ORDER_NOT_FOUND",
        message: `Order ${orderId} tidak ditemukan di database`,
        solution: "Pastikan order ID benar"
      });
    }
    
    if (!deliveryUser.results || deliveryUser.results.length === 0) {
      recommendations.push({
        issue: "NO_DELIVERY_USERS",
        message: "Tidak ada user dengan role 'deliveryman'",
        solution: "Buat user delivery atau periksa role di database"
      });
    }
    
    const deliveryUsersWithoutOutlet = (deliveryUser.results || []).filter(u => !u.outlet_id);
    if (deliveryUsersWithoutOutlet.length > 0) {
      recommendations.push({
        issue: "DELIVERY_USER_NO_OUTLET",
        message: `${deliveryUsersWithoutOutlet.length} delivery user belum di-assign ke outlet`,
        solution: "Jalankan migration atau assign manual ke outlet_bonbin",
        users: deliveryUsersWithoutOutlet.map(u => u.username)
      });
    }
    
    if (orderDetails && !orderDetails.assigned_deliveryman_id && orderDetails.pickup_method !== 'deliveryman') {
      recommendations.push({
        issue: "ORDER_NOT_ASSIGNED_TO_DELIVERY",
        message: `Order ${orderId} tidak di-assign ke delivery user dan pickup_method bukan 'deliveryman'`,
        solution: "Set assigned_deliveryman_id atau ubah pickup_method ke 'deliveryman'",
        current_values: {
          assigned_deliveryman_id: orderDetails.assigned_deliveryman_id,
          pickup_method: orderDetails.pickup_method
        }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      debug_info: {
        target_order_id: orderId,
        order_details: orderDetails,
        delivery_users: deliveryUser.results || [],
        bonbin_outlet: bonbinOutlet,
        delivery_query_simulation: deliveryQueryResults,
        outlet_based_orders: outletBasedQuery.results || [],
        recommendations: recommendations
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error('Error in debugDeliverySync:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      debug_info: null
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

/**
 * Fix delivery user assignment to outlet
 */
export async function fixDeliveryAssignment(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔧 Fixing delivery user assignment to outlets...');
    
    // 1. Get bonbin outlet ID
    const bonbinOutlet = await env.DB.prepare(`
      SELECT id FROM outlets_unified WHERE id = 'outlet_bonbin' OR LOWER(name) LIKE '%bonbin%'
    `).first();
    
    if (!bonbinOutlet) {
      throw new Error('Outlet Bonbin not found in outlets_unified');
    }
    
    // 2. Update delivery users to link to bonbin outlet
    const updateResult = await env.DB.prepare(`
      UPDATE users 
      SET outlet_id = ? 
      WHERE role = 'deliveryman' AND (outlet_id IS NULL OR outlet_id = '')
    `).bind(bonbinOutlet.id).run();
    
    // 3. Check updated users
    const updatedUsers = await env.DB.prepare(`
      SELECT id, username, role, outlet_id 
      FROM users 
      WHERE role = 'deliveryman'
    `).all();
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        outlet_assigned: bonbinOutlet.id,
        users_updated: updateResult.meta?.changes || 0,
        updated_users: updatedUsers.results || []
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error('Error in fixDeliveryAssignment:', error);
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
