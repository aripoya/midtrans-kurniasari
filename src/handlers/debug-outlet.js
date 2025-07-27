/**
 * Debug endpoint untuk menganalisis masalah filtering pesanan outlet
 * Khusus untuk mengatasi masalah pesanan tidak muncul di dashboard outlet
 */

/**
 * Debug outlet order filtering untuk memahami mengapa pesanan tidak muncul
 */
export async function debugOutletOrderFiltering(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const url = new URL(request.url);
    const outletName = url.searchParams.get('outlet') || 'bonbin';
    
    console.log(`🔍 Debugging outlet order filtering for: ${outletName}`);
    
    // 1. Check outlet setup in database
    const outletQuery = `SELECT id, name, location FROM outlets WHERE LOWER(name) LIKE LOWER('%${outletName}%')`;
    const outlets = await env.DB.prepare(outletQuery).all();
    
    // 2. Check users associated with this outlet
    const userQuery = `SELECT id, username, role, outlet_id FROM users WHERE role = 'outlet_manager'`;
    const users = await env.DB.prepare(userQuery).all();
    
    // 3. Check orders that should belong to this outlet
    const orderQuery = `
      SELECT id, lokasi_pengiriman, lokasi_pengambilan, outlet_id, shipping_area, area_pengiriman, tipe_pesanan
      FROM orders 
      WHERE LOWER(lokasi_pengiriman) LIKE LOWER('%${outletName}%') 
         OR LOWER(lokasi_pengambilan) LIKE LOWER('%${outletName}%')
         OR LOWER(shipping_area) LIKE LOWER('%${outletName}%')
      ORDER BY created_at DESC
      LIMIT 10
    `;
    const relatedOrders = await env.DB.prepare(orderQuery).all();
    
    // 4. Check specific order from screenshot (if exists)
    const specificOrderQuery = `
      SELECT id, lokasi_pengiriman, lokasi_pengambilan, outlet_id, shipping_area, area_pengiriman, tipe_pesanan
      FROM orders 
      WHERE id = 'ORDER-1752037059362-FLO3E'
    `;
    const specificOrder = await env.DB.prepare(specificOrderQuery).first();
    
    // 5. Simulate the filtering logic from getOutletOrders
    const simulationResults = [];
    
    for (const outlet of outlets.results || []) {
      for (const user of users.results || []) {
        if (user.outlet_id === outlet.id) {
          // Simulate the exact filtering logic
          const testQuery = `
            SELECT COUNT(*) as count
            FROM orders 
            WHERE LOWER(lokasi_pengiriman) LIKE LOWER('%${outlet.name}%')
               OR outlet_id = '${outlet.id}'
               OR LOWER(shipping_area) LIKE LOWER('%${outlet.name}%')
          `;
          const testResult = await env.DB.prepare(testQuery).first();
          
          simulationResults.push({
            outlet: outlet,
            user: user,
            matchingOrdersCount: testResult?.count || 0
          });
        }
      }
    }
    
    // 6. Check all outlet managers and their outlet assignments
    const outletManagerCheck = `
      SELECT u.id, u.username, u.role, u.outlet_id, o.name as outlet_name, o.location
      FROM users u
      LEFT JOIN outlets o ON u.outlet_id = o.id
      WHERE u.role = 'outlet_manager'
    `;
    const managerOutletMapping = await env.DB.prepare(outletManagerCheck).all();
    
    return new Response(JSON.stringify({
      success: true,
      debug_info: {
        searched_outlet: outletName,
        outlets_found: outlets.results || [],
        outlet_managers: users.results || [],
        related_orders: relatedOrders.results || [],
        specific_order: specificOrder || null,
        simulation_results: simulationResults,
        manager_outlet_mapping: managerOutletMapping.results || [],
        recommendations: generateRecommendations(outlets.results, users.results, relatedOrders.results, specificOrder)
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error('Error in debugOutletOrderFiltering:', error);
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
 * Generate recommendations based on debug analysis
 */
function generateRecommendations(outlets, users, orders, specificOrder) {
  const recommendations = [];
  
  // Check if outlets exist
  if (!outlets || outlets.length === 0) {
    recommendations.push({
      issue: "NO_OUTLETS_FOUND",
      message: "Tidak ada outlet ditemukan dengan nama yang dicari",
      solution: "Pastikan data outlet sudah ada di database dengan nama yang benar"
    });
  }
  
  // Check if users are properly assigned to outlets
  const outletManagers = users?.filter(u => u.role === 'outlet_manager') || [];
  if (outletManagers.length === 0) {
    recommendations.push({
      issue: "NO_OUTLET_MANAGERS",
      message: "Tidak ada outlet manager ditemukan",
      solution: "Buat akun outlet manager dan assign ke outlet yang benar"
    });
  }
  
  // Check outlet-user mapping
  for (const manager of outletManagers) {
    if (!manager.outlet_id) {
      recommendations.push({
        issue: "MANAGER_NOT_ASSIGNED",
        message: `User ${manager.username} tidak di-assign ke outlet manapun`,
        solution: `Update user ${manager.username} dengan outlet_id yang benar`
      });
    }
  }
  
  // Check orders that should appear but might not
  if (orders && orders.length > 0) {
    recommendations.push({
      issue: "ORDERS_EXIST_BUT_NOT_VISIBLE",
      message: `Ditemukan ${orders.length} pesanan yang seharusnya muncul di dashboard outlet`,
      solution: "Periksa kesesuaian nama outlet di database dengan lokasi_pengiriman di pesanan"
    });
  }
  
  // Check specific order
  if (specificOrder) {
    recommendations.push({
      issue: "SPECIFIC_ORDER_ANALYSIS",
      message: "Pesanan ORDER-1752037059362-FLO3E ditemukan",
      details: {
        lokasi_pengiriman: specificOrder.lokasi_pengiriman,
        outlet_id: specificOrder.outlet_id,
        area_pengiriman: specificOrder.area_pengiriman
      },
      solution: "Pastikan nama outlet di database sesuai dengan lokasi_pengiriman pesanan"
    });
  }
  
  return recommendations;
}

/**
 * Fix outlet order assignment - mengatasi masalah outlet assignment
 */
export async function fixOutletOrderAssignment(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const { outletName, userId } = await request.json();
    
    if (!outletName || !userId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'outletName dan userId diperlukan'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // 1. Find or create outlet
    let outlet = await env.DB.prepare(`SELECT id, name FROM outlets WHERE LOWER(name) LIKE LOWER('%${outletName}%')`).first();
    
    if (!outlet) {
      // Create outlet if not exists
      const outletId = `outlet-${Date.now()}`;
      await env.DB.prepare(`INSERT INTO outlets (id, name, location) VALUES (?, ?, ?)`).bind(
        outletId,
        `Outlet ${outletName}`,
        outletName
      ).run();
      
      outlet = { id: outletId, name: `Outlet ${outletName}` };
    }
    
    // 2. Assign user to outlet
    await env.DB.prepare(`UPDATE users SET outlet_id = ? WHERE id = ?`).bind(
      outlet.id,
      userId
    ).run();
    
    // 3. Update existing orders to be assigned to this outlet
    const updateQuery = `
      UPDATE orders 
      SET outlet_id = ? 
      WHERE LOWER(lokasi_pengiriman) LIKE LOWER('%${outletName}%')
         OR LOWER(lokasi_pengambilan) LIKE LOWER('%${outletName}%')
    `;
    const updateResult = await env.DB.prepare(updateQuery).bind(outlet.id).run();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Outlet assignment berhasil diperbaiki',
      data: {
        outlet: outlet,
        orders_updated: updateResult.changes || 0
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    console.error('Error in fixOutletOrderAssignment:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Gagal memperbaiki outlet assignment',
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
