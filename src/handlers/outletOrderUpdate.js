import { createNotification } from './notifications.js';

/**
 * Update order shipping status by outlet managers
 * Only allows outlet managers to update shipping status for orders assigned to their outlet
 */
export async function updateOutletOrderStatus(request, env) {
  const corsHeaders = request.corsHeaders || {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle OPTIONS request for CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract order ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const orderId = pathParts[pathParts.indexOf('orders') + 1];
    
    if (!orderId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Order ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Parse request body
    const requestData = await request.json();
    const { shipping_status } = requestData;
    
    if (!shipping_status) {
      return new Response(JSON.stringify({
        success: false,
        message: 'shipping_status is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Validate shipping status values
    const validStatuses = ['pending', 'processing', 'dikemas', 'siap kirim', 'siap di ambil', 'siap diambil', 'shipping', 'delivered', 'sudah diambil', 'sudah di ambil'];
    if (!validStatuses.includes(shipping_status)) {
      return new Response(JSON.stringify({
        success: false,
        message: `Invalid shipping status. Valid values: ${validStatuses.join(', ')}`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Verify order exists and user has permission to update it
    let whereClause = 'WHERE id = ?';
    let bindParams = [orderId];
    
    // For outlet managers, restrict to their outlet only
    if (request.user && request.user.role === 'outlet_manager') {
      whereClause += ' AND outlet_id = ?';
      bindParams.push(request.user.outlet_id);
    }
    
    const existingOrder = await env.DB.prepare(
      `SELECT o.id, o.shipping_status, o.outlet_id, ou.name as outlet_name FROM orders o
       LEFT JOIN outlets_unified ou ON o.outlet_id = ou.id ${whereClause}`
    ).bind(...bindParams).first();
    
    if (!existingOrder) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Order not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Update shipping status and handle pickup status transition
    let updateQuery = 'UPDATE orders SET shipping_status = ?, updated_at = datetime(\'now\')';
    let updateParams = [shipping_status];
    
    // When status becomes pickup-related, clear delivery fields and set pickup fields
    if (shipping_status.toLowerCase() === 'siap di ambil' || 
        shipping_status.toLowerCase() === 'siap diambil' || 
        shipping_status.toLowerCase() === 'sudah diambil' || 
        shipping_status.toLowerCase() === 'sudah di ambil') {
      // Clear delivery-related fields
      updateQuery += ', shipping_area = NULL, pickup_method = NULL, courier_service = NULL, tracking_number = NULL, lokasi_pengiriman = NULL, lokasi_pengambilan = NULL';
      
      // Set pickup fields with current outlet and user info
      const now = new Date();
      const currentDate = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()}`; // DD-MM-YYYY format
      const currentTime = new Date().toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'Asia/Jakarta'
      }); // HH:MM format in Jakarta timezone
      
      // Get the outlet name from existing order
      const outletName = existingOrder.outlet_name || 'Outlet Tidak Diketahui';
      
      // Get user name from request if available, fallback to role or default
      let pickedUpBy = 'System';
      if (request.user) {
        pickedUpBy = request.user.username || request.user.name || request.user.role || 'Outlet Manager';
      }
      
      updateQuery += ', pickup_outlet = ?, picked_up_by = ?, pickup_date = ?, pickup_time = ?';
      updateParams.push(outletName, pickedUpBy, currentDate, currentTime);
    }
    
    updateQuery += ` ${whereClause}`;
    updateParams.push(...bindParams);
    
    const updateResult = await env.DB.prepare(updateQuery).bind(...updateParams).run();
    
    if (updateResult.changes === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Failed to update order status'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Log the status update (if order_update_logs table exists)
    try {
      await env.DB.prepare(
        `INSERT INTO order_update_logs (order_id, field_name, old_value, new_value, updated_by, updated_at) 
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        orderId,
        'shipping_status',
        existingOrder.shipping_status,
        shipping_status,
        request.user?.username || 'unknown'
      ).run();
    } catch (logError) {
      console.log('Failed to log status update:', logError.message);
    }

    // Create notification for admin about status update
    try {
      await createNotification(env, {
        type: 'order_status_update',
        title: 'Status Pengiriman Diperbarui',
        message: `Order ${orderId} status diubah menjadi "${shipping_status}" oleh outlet ${request.user?.outlet_id || 'unknown'}`,
        order_id: orderId,
        user_type: 'admin',
        priority: 'normal'
      });
    } catch (notifError) {
      console.log('Failed to create notification:', notifError.message);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Shipping status updated successfully',
      data: {
        order_id: orderId,
        shipping_status: shipping_status,
        updated_by: request.user?.username || 'unknown'
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    console.error('Error in updateOutletOrderStatus:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to update order status',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
