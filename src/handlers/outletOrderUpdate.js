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
    const validStatuses = ['pending', 'processing', 'dikemas', 'siap kirim', 'shipping', 'delivered'];
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
      `SELECT id, shipping_status, outlet_id FROM orders ${whereClause}`
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

    // Update shipping status
    const updateResult = await env.DB.prepare(
      `UPDATE orders SET shipping_status = ?, updated_at = datetime('now') ${whereClause}`
    ).bind(shipping_status, ...bindParams).run();
    
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
