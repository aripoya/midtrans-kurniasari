// Function for customers to mark their order as received
export async function markOrderAsReceived(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const orderId = url.pathname.split('/')[3]; // Assuming URL is /api/orders/:id/received or /mark-received

    if (!orderId) {
      return new Response(JSON.stringify({ success: false, error: 'Order ID is required' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (!env.DB) {
      throw new Error("Database binding not found.");
    }

    // Update the shipping status to 'received'
    const updateResult = await env.DB.prepare(
      'UPDATE orders SET shipping_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind('received', orderId).run();

    if (updateResult.meta.changes === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Order not found or status unchanged' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Return success response
    return new Response(JSON.stringify({
      success: true,
      message: 'Order marked as received successfully',
      data: { id: orderId, shipping_status: 'received' }
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Mark Order as Received Error:', error.message, error.stack);
    return new Response(JSON.stringify({ success: false, error: 'Failed to mark order as received' }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
}
