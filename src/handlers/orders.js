import { Buffer } from 'node:buffer';
import { createNotification } from './notifications.js';

// Simple order ID generator
function generateOrderId() {
  return `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
}

export async function createOrder(request, env) {
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
    if (!env.DB) {
      throw new Error("Database binding not found.");
    }

    const orderData = await request.json();
    const { customer_name, email, phone, items, customer_address } = orderData;
    const customerPhone = phone || null;

    if (!customer_name || !email || !items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Missing or invalid required fields' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const totalAmount = items.reduce((total, item) => total + (Number(item.product_price || item.price) * Number(item.quantity)), 0);
    const orderId = generateOrderId();

    const processedItems = [];
    for (const item of items) {
      let productId = item.id;
      // For custom/new items, the ID might be null or a placeholder like 'new-item'
      if (!productId || String(productId).startsWith('new-')) {
        const existingProduct = await env.DB.prepare(`SELECT id FROM products WHERE name = ?`).bind(item.name).first();
        if (existingProduct) {
          productId = existingProduct.id;
        } else {
          // Insert the new product and get its auto-incremented ID
          const insertResult = await env.DB.prepare(
            `INSERT INTO products (name, price) VALUES (?, ?)`
          ).bind(item.name, Number(item.product_price || item.price)).run();
          // D1 run() result for INSERT contains meta with last_row_id
          productId = insertResult.meta.last_row_id;
        }
      }
      processedItems.push({ ...item, id: Number(productId) });
    }

    const isProduction = env.MIDTRANS_IS_PRODUCTION === 'true';
    const serverKey = env.MIDTRANS_SERVER_KEY;
    if (!serverKey) {
      throw new Error("Midtrans server key not configured.");
    }

    // Use the Snap API endpoint
    const midtransUrl = isProduction
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

    console.log('Midtrans Configuration:', {
      isProduction,
      serverKeyLength: serverKey ? serverKey.length : 0,
      serverKeyPrefix: serverKey ? serverKey.substring(0, 10) + '...' : 'not-set',
      midtransUrl
    });

    const customerDetails = { 
      first_name: customer_name, 
      email,
      phone: customerPhone || ''
    };

    const requestOrigin = request.headers.get('origin');
    const finishUrl = `${requestOrigin || 'https://kurniasari-midtrans-frontend.pages.dev'}/orders/${orderId}`;
    console.log(`[DEBUG] Using finish URL for Midtrans callback: ${finishUrl}. Request origin: ${requestOrigin}`);

    const midtransPayload = {
      transaction_details: { 
        order_id: orderId, 
        gross_amount: totalAmount 
      },
      customer_details: customerDetails,
      item_details: processedItems.map(item => ({
        id: String(item.id),
        name: item.name,
        price: Number(item.product_price || item.price),
        quantity: Number(item.quantity)
      })),
      callbacks: {
        finish: finishUrl,
      }
    };
    
    console.log('Sending to Midtrans Snap API:', {
      url: midtransUrl,
      payload: midtransPayload,
      isProduction
    });
    
    // Create basic auth header
    const authString = `${serverKey}:`;
    const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`;
    
    // Make request to Midtrans
    let midtransData;
    try {
      const response = await fetch(midtransUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(midtransPayload)
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('Midtrans API error:', {
          status: response.status,
          statusText: response.statusText,
          response: responseData
        });
        throw new Error(`Midtrans API error: ${responseData.error_messages ? responseData.error_messages.join(', ') : 'Unknown error'}`);
      }
      
      midtransData = responseData;
      console.log('Midtrans response:', {
        token: midtransData.token ? 'Token received' : 'No token',
        redirect_url: midtransData.redirect_url || 'No redirect URL'
      });
      
    } catch (error) {
      console.error('Error calling Midtrans API:', error);
      throw new Error(`Failed to process payment: ${error.message}`);
    }

    // Insert the order into the database, now including the address
    await env.DB.prepare(`
      INSERT INTO orders (id, customer_name, customer_email, customer_phone, total_amount, snap_token, payment_link, payment_response, shipping_status, customer_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        orderId,
        customer_name,
        email,
        customerPhone,
        totalAmount,
        midtransData.token,
        midtransData.redirect_url,
        JSON.stringify(midtransData), // Storing the full response for reference
        'pending', // Initial shipping status
        customer_address || null // Add the address here
      ).run();

    // Statements for inserting into 'order_items' table
    const dbStatements = [];
    for (const item of processedItems) {
      const subtotal = Number(item.price) * Number(item.quantity);
      dbStatements.push(
        env.DB.prepare(
          `INSERT INTO order_items (order_id, product_name, product_price, quantity, subtotal)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(orderId, item.name, Number(item.price), Number(item.quantity), subtotal)
      );
    }

    // Batch execute item insertion statements
    if (dbStatements.length > 0) {
      await env.DB.batch(dbStatements);
    }

    return new Response(JSON.stringify({ success: true, orderId: orderId, ...midtransData }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  } catch (e) {
    console.error('Create Order Error:', e.message, e.stack);
    return new Response(JSON.stringify({ success: false, error: e.message, stack: e.stack }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}

export async function getOrders(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  try {
    if (!env.DB) {
      return new Response(JSON.stringify({ success: true, orders: [] }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
    }

    const { results } = await env.DB.prepare('SELECT * FROM orders ORDER BY id DESC').all();
    
    const orders = await Promise.all(results.map(async (order) => {
        const { results: items } = await env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(order.id).all();
        return { ...order, items };
    }));

    return new Response(JSON.stringify({ success: true, orders }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }});

  } catch (error) {
    console.error('Get Orders Error:', error.message, error.stack);
    return new Response(JSON.stringify({ success: false, error: 'Failed to fetch orders' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  }
}

export async function getOrderById(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  let failedQuery = 'unknown';
  try {
    const url = new URL(request.url);
    const orderId = url.pathname.split('/').pop();

    if (!orderId) {
      return new Response(JSON.stringify({ success: false, error: 'Order ID is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
    }

    if (!env.DB) {
      return new Response(JSON.stringify({ success: false, error: 'Database not available' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
    }

    // Step 1: Fetch the main order details
    failedQuery = 'fetching order';
    const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();

    if (!order) {
      return new Response(JSON.stringify({ success: false, error: 'Order not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
    }

    // Step 2: Fetch order items
    failedQuery = 'fetching order items';
    const { results: items } = await env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(orderId).all();

    // Step 3: Fetch shipping images (with error handling)
    failedQuery = 'fetching shipping images';
    let shipping_images = [];
    try {
      const shippingImagesResult = await env.DB.prepare('SELECT image_type, image_url FROM shipping_images WHERE order_id = ?').bind(orderId).all();
      shipping_images = shippingImagesResult.results || [];
    } catch (shippingError) {
      // Log error but don't fail the entire request
      console.error(`Error fetching shipping images for order ${orderId}:`, shippingError);
      // Continue with empty shipping_images array
    }

    // Step 4: Fetch location names if they exist
    failedQuery = 'fetching location names';
    let lokasiPengirimanNama = null;
    if (order.lokasi_pengiriman) {
      const loc = await env.DB.prepare('SELECT nama_lokasi FROM locations WHERE nama_lokasi = ?').bind(order.lokasi_pengiriman).first();
      lokasiPengirimanNama = loc ? loc.nama_lokasi : order.lokasi_pengiriman; // Fallback to the stored value
    }

    let lokasiPengambilanNama = null;
    if (order.lokasi_pengambilan) {
      const loc = await env.DB.prepare('SELECT nama_lokasi FROM locations WHERE nama_lokasi = ?').bind(order.lokasi_pengambilan).first();
      lokasiPengambilanNama = loc ? loc.nama_lokasi : order.lokasi_pengambilan; // Fallback to the stored value
    }

    // Log shipping_area untuk debugging
    console.log(`[getOrderById] Order ${orderId} shipping_area: ${order.shipping_area}`);

    const finalOrder = {
      ...order,
      lokasi_pengiriman: lokasiPengirimanNama,
      lokasi_pengambilan: lokasiPengambilanNama,
      items,
      shipping_images
      // shipping_area sudah termasuk dalam ...order
    };

    return new Response(JSON.stringify({ success: true, data: finalOrder }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }});

  } catch (error) {
    console.error(`Get Order By ID Error while ${failedQuery}:`, error.message, error.stack);
    return new Response(JSON.stringify({ success: false, error: 'Failed to fetch order', details: `Error during: ${failedQuery}` }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  }
}

async function updateOrderStatusFromMidtrans(orderId, env) {
  const serverKey = env.MIDTRANS_SERVER_KEY;
  const isProduction = env.MIDTRANS_IS_PRODUCTION === 'true';
  
  if (!serverKey) {
    return { success: false, error: 'Midtrans server key not configured.' };
  }

  const midtransUrl = isProduction
    ? `https://api.midtrans.com/v2/${orderId}/status`
    : `https://api.sandbox.midtrans.com/v2/${orderId}/status`;

  const authString = `${serverKey}:`;
  const authHeader = `Basic ${Buffer.from(authString).toString('base64')}`;

  try {
    const midtransResponse = await fetch(midtransUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
      },
    });

    if (!midtransResponse.ok) {
      const errorData = await midtransResponse.json();
      console.error('Midtrans status check failed:', errorData);
      return { success: false, error: `Midtrans API error: ${errorData.status_message || 'Unknown error'}` };
    }

    const statusData = await midtransResponse.json();
    
    const paymentStatus = statusData.transaction_status;
    const paymentResponse = JSON.stringify(statusData);

    const updateResult = await env.DB.prepare(
      `UPDATE orders 
       SET payment_status = ?, payment_response = ?, updated_at = ?
       WHERE id = ?`
    ).bind(paymentStatus, paymentResponse, new Date().toISOString(), orderId).run();

    if (updateResult.meta.changes > 0) {
      return { success: true, payment_status: paymentStatus, message: 'Status updated successfully.' };
    } else {
      return { success: false, error: 'Order not found or status unchanged.' };
    }
  } catch (error) {
    console.error('Error in updateOrderStatusFromMidtrans:', error);
    return { success: false, error: `Internal server error: ${error.message}` };
  }
}

// New function to allow a customer to refresh their order status
export async function refreshOrderStatus(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const url = new URL(request.url);
    const orderId = url.pathname.split('/')[3]; // Assuming URL is /api/orders/:id/refresh-status

    if (!orderId) {
      return new Response(JSON.stringify({ success: false, error: 'Order ID is required' }), { status: 400, headers: corsHeaders });
    }

    // We now directly call updateOrderStatusFromMidtrans which will fetch status from Midtrans
    // and update our database with the latest info
    const updateResult = await updateOrderStatusFromMidtrans(orderId, env);

    if (updateResult.success) {
      return new Response(JSON.stringify({ success: true, ...updateResult }), { status: 200, headers: corsHeaders });
    } else {
      return new Response(JSON.stringify({ success: false, error: 'Failed to update order status', details: updateResult.error }), { status: 500, headers: corsHeaders });
    }

  } catch (error) {
    console.error('Refresh Order Status Error:', error.message, error.stack);
    return new Response(JSON.stringify({ success: false, error: 'Failed to refresh order status' }), { status: 500, headers: corsHeaders });
  }
}

// markOrderAsReceived moved to received.js file

// Function to delete an order by ID
export async function deleteOrder(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle OPTIONS request for CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract order ID from URL path
    const url = new URL(request.url);
    const orderId = url.pathname.split('/')[3]; // Assuming URL is /api/orders/:id

    if (!orderId) {
      return new Response(JSON.stringify({ success: false, error: 'Order ID is required' }), 
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (!env.DB) {
      throw new Error('Database binding not found');
    }

    // Check if order exists before attempting to delete
    const existingOrder = await env.DB.prepare(
      `SELECT id FROM orders WHERE id = ?`
    ).bind(orderId).first();

    if (!existingOrder) {
      return new Response(JSON.stringify({ success: false, error: 'Order not found' }), 
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Delete order items first to maintain referential integrity
    await env.DB.prepare(
      `DELETE FROM order_items WHERE order_id = ?`
    ).bind(orderId).run();

    // Then delete the order
    const result = await env.DB.prepare(
      `DELETE FROM orders WHERE id = ?`
    ).bind(orderId).run();

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Order successfully deleted',
      orderId: orderId
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });

  } catch (error) {
    console.error('Delete Order Error:', error.message, error.stack);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to delete order',
      details: error.message 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  }
}

// Get orders assigned to specific deliveryman
export async function getDeliveryOrders(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle OPTIONS request for CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get deliveryman ID from JWT token (should be set by verifyToken middleware)
    const deliverymanId = request.user?.id;
    
    if (!deliverymanId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Deliveryman ID not found in token'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Query orders assigned to this deliveryman
    const ordersResult = await env.DB.prepare(`
      SELECT *
      FROM orders
      WHERE assigned_deliveryman_id = ?
      ORDER BY created_at DESC
    `).bind(deliverymanId).all();

    if (!ordersResult.success) {
      throw new Error('Failed to fetch delivery orders from database');
    }

    const orders = ordersResult.results || [];

    // Process each order to add additional data
    const processedOrders = [];
    for (const order of orders) {
      try {
        // Fetch shipping images for this order
        const shippingImagesResult = await env.DB.prepare(
          'SELECT * FROM shipping_images WHERE order_id = ? ORDER BY created_at DESC'
        ).bind(order.id).all();
        
        const shipping_images = shippingImagesResult.results || [];

        // Add processed order with shipping images
        processedOrders.push({
          ...order,
          shipping_images
        });
      } catch (imageError) {
        console.error(`Error fetching images for order ${order.id}:`, imageError);
        // Continue with order but without images
        processedOrders.push({
          ...order,
          shipping_images: []
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      orders: processedOrders,
      count: processedOrders.length
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Get Delivery Orders Error:', error.message, error.stack);
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to fetch delivery orders',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Admin endpoint to get enhanced order list with more details
export async function getAdminOrders(request, env) {
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
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    if (!env.DB) {
      throw new Error('Database binding not found');
    }

    const ordersQuery = `
      SELECT
        o.*,
        lp.nama_lokasi AS lokasi_pengiriman_nama,
        la.nama_lokasi AS lokasi_pengambilan_nama
      FROM orders o
      LEFT JOIN locations lp ON o.lokasi_pengiriman = lp.nama_lokasi
      LEFT JOIN locations la ON o.lokasi_pengambilan = la.nama_lokasi
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const orders = await env.DB.prepare(ordersQuery).bind(limit, offset).all();

    if (!orders || !orders.results) {
      return new Response(JSON.stringify({ success: false, error: 'Failed to fetch orders' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const processedOrders = await Promise.all(orders.results.map(async order => {
      try {
        const orderItems = await env.DB.prepare(
          `SELECT product_id, product_name, price, quantity FROM order_items WHERE order_id = ?`
        ).bind(order.id).all();
        
        const items = orderItems?.results || [];
        
        let paymentDetails = null;
        if (order.payment_response) {
          try {
            paymentDetails = JSON.parse(order.payment_response);
          } catch (e) {
            console.error(`Error parsing payment response for order ${order.id}:`, e);
          }
        }

        const { 
          lokasi_pengiriman_nama, 
          lokasi_pengambilan_nama,
          ...restOfOrder 
        } = order;

        return {
          ...restOfOrder,
          lokasi_pengiriman: lokasi_pengiriman_nama, // Use the name from the JOIN
          lokasi_pengambilan: lokasi_pengambilan_nama, // Use the name from the JOIN
          items,
          payment_details: paymentDetails,
          total_amount: items.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0)), 0)
        };
      } catch (itemError) {
        console.error(`Error processing items for order ${order.id}:`, itemError);
        return {
          ...order,
          items: [],
          error: 'Failed to fetch items for this order'
        };
      }
    }));

    const countResult = await env.DB.prepare('SELECT COUNT(*) as total FROM orders').first();
    const total = countResult ? countResult.total : 0;

    return new Response(JSON.stringify({
      success: true,
      orders: processedOrders,
      pagination: {
        total,
        offset,
        limit,
        has_more: offset + limit < total
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('Admin Get Orders Error:', error.message, error.stack);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to fetch admin orders',
      details: error.message 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  }
}

export async function updateOrderStatus(request, env) {
  const corsHeaders = request.corsHeaders || {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const orderId = url.pathname.split('/')[3]; // Assuming URL is /api/orders/:id/status
    const { status } = await request.json();

    if (!orderId || !status) {
      return new Response(JSON.stringify({ success: false, error: 'Order ID and status are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Updated to match frontend utility normalization
    const allowedStatuses = [
      'menunggu diproses', 'pending', // backward compatibility
      'dikemas', 'diproses',
      'siap kirim', 'siap diambil', 'siap di ambil',
      'dalam pengiriman', 'sedang dikirim', 'dikirim',
      'diterima', 'received', 'sudah di terima'
    ];
    if (!allowedStatuses.includes(status.toLowerCase())) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid status value', 
        allowedValues: ['menunggu diproses', 'pending', 'dikemas', 'siap kirim', 'siap di ambil', 'sedang dikirim', 'diterima', 'received'] 
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!env.DB) {
      throw new Error("Database binding not found.");
    }

    // Get current order status and related information before updating
    const currentOrder = await env.DB.prepare(`
      SELECT o.shipping_status, o.outlet_id, o.assigned_deliveryman_id, 
             ou.name as outlet_name
      FROM orders o
      LEFT JOIN outlets ou ON o.outlet_id = ou.id
      WHERE o.id = ?
    `).bind(orderId).first();

    if (!currentOrder) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Order not found' 
      }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const oldStatus = currentOrder.shipping_status;

    // Only update if status has changed
    if (oldStatus === status) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Status is unchanged' 
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Update the order status
    const updateResult = await env.DB.prepare(
      'UPDATE orders SET shipping_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(status, orderId).run();

    if (updateResult.meta.changes === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Order not found or status unchanged' 
      }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // Create audit log entry
    // Generate a random ID for the log entry
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    let userId = null;
    let userRole = 'anonymous';
    
    // Extract user info from request if available
    if (request.user) {
      userId = request.user.id;
      userRole = request.user.role;
    }
    
    // Add entry to order_update_logs
    const logResult = await env.DB.prepare(
      `INSERT INTO order_update_logs (
        id, order_id, user_id, update_type, old_value, new_value, user_role, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      logId,
      orderId,
      userId,
      'shipping_status',
      oldStatus,
      status,
      userRole,
      `Shipping status updated from ${oldStatus || 'not set'} to ${status}`
    ).run();
    
    if (!logResult.success) {
      console.error('Failed to create audit log:', logResult.error);
      // We still return success for the status update even if logging fails
    }
    
    // Create notifications
    try {
      // Extract outlet and deliveryman info if available
      const outletId = currentOrder.outlet_id;
      const deliverymanId = currentOrder.assigned_deliveryman_id;
      const outletName = currentOrder.outlet_name || 'the outlet';
      
      // Determine notification title and message based on status
      let title = `Order Status Updated`;
      let message = `Order #${orderId} status updated to "${status}"`;
      
      // Create different notification messages based on status and user role
      if (status.toLowerCase() === 'dalam pengiriman' || 
          status.toLowerCase() === 'sedang dikirim' || 
          status.toLowerCase() === 'dikirim') {
        title = 'Order In Transit';
        message = `Order #${orderId} is now being delivered to the customer.`;
      } else if (status.toLowerCase() === 'diterima' || 
                status.toLowerCase() === 'received' || 
                status.toLowerCase() === 'sudah di terima') {
        title = 'Order Delivered';
        message = `Order #${orderId} has been successfully delivered to the customer.`;
      } else if (status.toLowerCase() === 'siap kirim' || 
                status.toLowerCase() === 'siap diambil' || 
                status.toLowerCase() === 'siap di ambil') {
        title = 'Order Ready for Delivery';
        message = `Order #${orderId} is ready to be picked up from ${outletName} for delivery.`;
      }
      
      // Get the user who made the change (for context in notifications)
      let updatedByText = 'The system';
      if (request.user) {
        updatedByText = request.user.role === 'admin' ? 'An admin' : 
                       request.user.role === 'outlet_manager' ? 'The outlet manager' : 
                       'The delivery person';
      }
      
      // Append who made the change
      message += ` ${updatedByText} updated the status from "${oldStatus || 'not set'}" to "${status}".`;
      
      // 1. Notify the outlet if order is for that outlet
      if (outletId && userRole !== 'outlet_manager') {
        await createNotification(env, {
          outletId: outletId,
          orderId: orderId,
          title: title,
          message: message,
          type: 'order_status_update'
        });
      }
      
      // 2. Notify the assigned deliveryman if there is one and they didn't make the change
      if (deliverymanId && userId !== deliverymanId) {
        await createNotification(env, {
          userId: deliverymanId,
          orderId: orderId,
          title: title,
          message: message,
          type: 'order_status_update'
        });
      }
      
    } catch (notifError) {
      console.error('Failed to create notifications:', notifError);
      // Continue execution even if notification creation fails
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Order status updated successfully',
      logId: logId // Return log ID for reference
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Update Order Status Error:', error.message, error.stack);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to update order status', 
      details: error.message 
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

/**
 * Update order details termasuk status pengiriman, area pengiriman, dan metode pengambilan
 */
export async function updateOrderDetails(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const orderId = url.pathname.split('/')[3];

    if (!orderId) {
      return new Response(JSON.stringify({ success: false, error: 'Order ID is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await request.json();
    console.log(`[updateOrderDetails] Received for order ${orderId}:`, JSON.stringify(data));

    const {
      status,
      shipping_area, // tambahkan shipping_area ke daftar variabel yang di-destructure
      pickup_method,
      admin_note,
      tracking_number,
      courier_service,
      lokasi_pengiriman: lokasiPengirimanName,
      lokasi_pengambilan: lokasiPengambilanName,
      tipe_pesanan,
      metode_pengiriman
    } = data;

    const orderCheck = await env.DB.prepare(`SELECT id FROM orders WHERE id = ?`).bind(orderId).first();
    if (!orderCheck) {
      return new Response(JSON.stringify({ success: false, error: 'Order not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const updateFields = [];
    const updateParams = [];

    // Update shipping status jika ada
    if (status !== undefined) { 
      // Validasi status harus valid sebelum diupdate
      // Updated to match frontend utility normalization
      const allowedStatuses = [
        'menunggu diproses', 'pending', // backward compatibility
        'dikemas', 'diproses',
        'siap kirim', 'siap diambil', 'siap di ambil',
        'dalam pengiriman', 'sedang dikirim', 'dikirim',
        'diterima', 'received', 'sudah di terima'
      ];
      if (!allowedStatuses.includes(status.toLowerCase())) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Invalid status value: ${status}`, 
          allowedValues: ['menunggu diproses', 'pending', 'dikemas', 'siap kirim', 'siap di ambil', 'sedang dikirim', 'diterima', 'received'] 
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      updateFields.push('shipping_status = ?'); 
      updateParams.push(status); 
    }
    // Aktifkan kembali shipping_area karena kolom sudah ditambahkan ke database
    if (shipping_area !== undefined) { updateFields.push('shipping_area = ?'); updateParams.push(shipping_area); }
    // Kolom pickup_method sudah ditambahkan kembali ke database
    if (pickup_method !== undefined) { updateFields.push('pickup_method = ?'); updateParams.push(pickup_method); }
    if (admin_note !== undefined) { updateFields.push('admin_note = ?'); updateParams.push(admin_note); }
    if (tracking_number !== undefined) { updateFields.push('tracking_number = ?'); updateParams.push(tracking_number); }
    if (courier_service !== undefined) { updateFields.push('courier_service = ?'); updateParams.push(courier_service); }
    if (tipe_pesanan !== undefined) { updateFields.push('tipe_pesanan = ?'); updateParams.push(tipe_pesanan); }

    if (lokasiPengirimanName !== undefined) {
      if (lokasiPengirimanName) {
        // Periksa apakah lokasi valid, tapi gunakan langsung nama_lokasi (bukan kode_area yang sudah dihapus)
        const location = await env.DB.prepare("SELECT id FROM locations WHERE nama_lokasi = ?").bind(lokasiPengirimanName).first();
        if (!location) {
          return new Response(JSON.stringify({ success: false, error: `Invalid location name for lokasi_pengiriman: ${lokasiPengirimanName}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        updateFields.push('lokasi_pengiriman = ?');
        updateParams.push(lokasiPengirimanName); // Gunakan nama lokasi langsung
      } else {
        updateFields.push('lokasi_pengiriman = ?');
        updateParams.push(null);
      }
    }

    if (lokasiPengambilanName !== undefined) {
      if (lokasiPengambilanName) {
        // Periksa apakah lokasi valid, tapi gunakan langsung nama_lokasi (bukan kode_area yang sudah dihapus)
        const location = await env.DB.prepare("SELECT id FROM locations WHERE nama_lokasi = ?").bind(lokasiPengambilanName).first();
        if (!location) {
          return new Response(JSON.stringify({ success: false, error: `Invalid location name for lokasi_pengambilan: ${lokasiPengambilanName}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        updateFields.push('lokasi_pengambilan = ?');
        updateParams.push(lokasiPengambilanName); // Gunakan nama lokasi langsung
      } else {
        updateFields.push('lokasi_pengambilan = ?');
        updateParams.push(null);
      }
    }

    if (updateFields.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No fields to update' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateParams.push(orderId);

    const updateQuery = `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`;

    try {
      console.log(`[updateOrderDetails] Executing query: ${updateQuery}`);
      console.log(`[updateOrderDetails] With params:`, JSON.stringify(updateParams));

      const updateResult = await env.DB.prepare(updateQuery).bind(...updateParams).run();

      if (!updateResult.success) {
        throw new Error('Database update failed: ' + (updateResult.error || 'Unknown D1 error'));
      }

      if (updateResult.meta.changes === 0) {
        return new Response(JSON.stringify({ success: false, error: 'Order not found or details were unchanged' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      console.log(`[updateOrderDetails] Successfully updated order: ${orderId}`);
      return new Response(JSON.stringify({ success: true, message: 'Order details updated successfully' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (dbError) {
      console.error(`[updateOrderDetails] Database Error for order ${orderId}:`, dbError);
      console.error(`[updateOrderDetails] Failing Query: ${updateQuery}`);
      console.error(`[updateOrderDetails] Failing Params:`, JSON.stringify(updateParams));

      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Gagal memperbarui pesanan di database.',
        details: dbError.message,
        query: updateQuery, // For debugging
        params: updateParams // For debugging
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

  } catch (error) {
    console.error(`[updateOrderDetails] Unhandled error:`, error.message, error.stack);
    return new Response(JSON.stringify({ success: false, error: 'Failed to update order details', details: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}

/**
 * Get orders specific to an outlet or a deliveryman
 * - For outlet managers: returns orders for their specific outlet
 * - For deliverymen: returns orders assigned to them
 * - For admins: returns all orders filtered by outlet_id (if provided) or assigned deliveryman (if isDeliveryView=true)
 */
export async function getOutletOrders(request, env) {
  const corsHeaders = request.corsHeaders || {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Parse URL and get query parameters
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const page = parseInt(url.searchParams.get('page')) || 1;
    const perPage = parseInt(url.searchParams.get('perPage')) || 10;
    const isDeliveryView = request.isDeliveryView || false;
    
    // Calculate offset
    const offset = (page - 1) * perPage;
    
    // Debug user info
    console.log('User info in getOutletOrders:', request.user ? {
      id: request.user.id,
      role: request.user.role,
      outlet_id: request.user.outlet_id
    } : 'No user in request');

    // Build query based on actual production database schema (simplified)
    let orderQuery = `
      SELECT o.*,
             ou.name AS outlet_name
      FROM orders o
      LEFT JOIN outlets ou ON o.outlet_id = ou.id
      WHERE 1=1
    `;
    
    let countQuery = "SELECT COUNT(*) as total FROM orders o WHERE 1=1";
    
    // Filter by status if provided
    if (status) {
      const statusCondition = ` AND o.status = '${status}'`;
      orderQuery += statusCondition;
      countQuery += statusCondition;
    }
    
    // Apply role-specific filters with proper parameter binding
    if (request.user) {
      if (request.user.role === 'outlet_manager') {
        // Outlet managers should see orders:
        // 1. Either directly assigned to their outlet (outlet_id)
        // 2. OR where shipping location (lokasi_pengiriman) matches their outlet location
        
        try {
          // Get outlet info to check location match - use defensive coding
          const outletId = request.user.outlet_id || '';
          const outletInfo = outletId ? 
            await env.DB.prepare(`SELECT name, location FROM outlets WHERE id = ?`).bind(outletId).first() : 
            null;
            
          // Default values if no outlet info found
          const outletLocation = outletInfo?.location || '';
          const outletName = outletInfo?.name || '';
          
          console.log(`📍 Outlet ${outletName} (ID: ${outletId}) with location: ${outletLocation}`);
          
          // Generate safe pattern strings (escape special characters)
          const outletLocationPattern = (outletLocation || '').replace(/[%_]/g, '\\$&');
          const outletNamePattern = (outletName || '').replace(/[%_]/g, '\\$&');
          
          // Debug: Check for the specific order that's missing
          console.log('🔍 Checking for ORDER-1752037059362-FLO3E...');
          const debugOrderQuery = `SELECT id, outlet_id, lokasi_pengiriman, shipping_area FROM orders WHERE id = 'ORDER-1752037059362-FLO3E'`;
          try {
            const debugOrder = await env.DB.prepare(debugOrderQuery).first();
            console.log('Debug order data:', debugOrder);
            
            if (debugOrder) {
              // Check if this order would match our outlet conditions
              const wouldMatch = 
                (outletId && debugOrder.outlet_id === outletId) ||
                (outletNamePattern && (
                  (debugOrder.lokasi_pengiriman && debugOrder.lokasi_pengiriman.toLowerCase().includes(outletNamePattern.toLowerCase())) ||
                  (debugOrder.shipping_area && debugOrder.shipping_area.toLowerCase().includes(outletNamePattern.toLowerCase()))
                )) ||
                (outletLocationPattern && (
                  (debugOrder.lokasi_pengiriman && debugOrder.lokasi_pengiriman.toLowerCase().includes(outletLocationPattern.toLowerCase())) ||
                  (debugOrder.shipping_area && debugOrder.shipping_area.toLowerCase().includes(outletLocationPattern.toLowerCase()))
                ));
                
              console.log(`Would ORDER-1752037059362-FLO3E match outlet ${outletName} conditions? ${wouldMatch}`);
            }
          } catch (debugErr) {
            console.error('Error in debug query:', debugErr);
          }
          
          // Build query with all the OR conditions to get all orders for this outlet
          let outletCondition = '';
          
          // CRITICAL FIX: For outlet synchronization, prioritize lokasi_pengiriman matching
          // This ensures orders with lokasi_pengiriman="Outlet Bonbin" show up in Outlet Bonbin dashboard
          
          if (outletName) {
            // Primary matching: lokasi_pengiriman contains outlet name (most reliable)
            outletCondition += `LOWER(o.lokasi_pengiriman) LIKE LOWER('%${outletName}%')`;
            
            // Add special matching patterns for common outlet names
            if (outletName.toLowerCase().includes('bonbin')) {
              outletCondition += ` OR LOWER(o.lokasi_pengiriman) LIKE LOWER('%bonbin%')`;
            }
            if (outletName.toLowerCase().includes('monjali')) {
              outletCondition += ` OR LOWER(o.lokasi_pengiriman) LIKE LOWER('%monjali%')`;
            }
            if (outletName.toLowerCase().includes('jakal')) {
              outletCondition += ` OR LOWER(o.lokasi_pengiriman) LIKE LOWER('%jakal%')`;
            }
            if (outletName.toLowerCase().includes('glagahsari')) {
              outletCondition += ` OR LOWER(o.lokasi_pengiriman) LIKE LOWER('%glagahsari%')`;
            }
          }
          
          // Secondary matching: outlet_id (fallback for direct assignments)
          if (outletId) {
            if (outletCondition) outletCondition += ' OR ';
            outletCondition += `o.outlet_id = '${outletId}'`;
          }
          
          // Tertiary matching: shipping_area (additional fallback)
          if (outletName || outletLocationPattern) {
            if (outletCondition) outletCondition += ' OR ';
            if (outletName) {
              outletCondition += `LOWER(o.shipping_area) LIKE LOWER('%${outletName}%')`;
            }
            if (outletLocationPattern) {
              if (outletName) outletCondition += ' OR ';
              outletCondition += `LOWER(o.shipping_area) LIKE LOWER('%${outletLocationPattern}%')`;
            }
          }
          
          // If we couldn't build any conditions, use a fallback to show SOME orders
          if (!outletCondition) {
            // Fallback to show orders with no specific outlet or location assigned
            outletCondition = "(o.outlet_id IS NULL OR o.outlet_id = '')";
          }
          orderQuery += ` AND (${outletCondition})`;
          countQuery += ` AND (${outletCondition})`;
          
          console.log(`🔍 Expanded outlet order query to match outlet: ${outletName || outletId}`);
        } catch (outletError) {
          console.error(`Error getting outlet info: ${outletError.message}`, outletError);
          
          // Fallback to just outlet_id if there was an error
          if (request.user.outlet_id) {
            orderQuery += ` AND o.outlet_id = '${request.user.outlet_id}'`;
            countQuery += ` AND o.outlet_id = '${request.user.outlet_id}'`;
          }
        }
      } else if (request.user.role === 'deliveryman') {
        // Deliverymen can only see orders assigned to them
        orderQuery += ` AND o.assigned_deliveryman_id = '${request.user.id}'`;
        countQuery += ` AND o.assigned_deliveryman_id = '${request.user.id}'`;
      } else if (request.user.role === 'admin' && isDeliveryView) {
        // Admin in delivery view sees all orders with assigned deliverymen
        orderQuery += ` AND o.assigned_deliveryman_id IS NOT NULL`;
        countQuery += ` AND o.assigned_deliveryman_id IS NOT NULL`;
      }
    } else {
      console.warn('No user found in request, returning no orders for security');
      // Return empty result if no user in request
      return new Response(JSON.stringify({
        success: false,
        message: 'Authentication required',
        data: [],
        pagination: { total: 0, page, perPage, totalPages: 0 }
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
        status: 401
      });
    }
    
    // Execute count query to get total records matching filter
    let countResult;
    try {
      countResult = await env.DB.prepare(countQuery).first();
    } catch (countError) {
      console.error('Error executing count query:', countError, { query: countQuery });
      countResult = { total: 0 };
    }
    
    // Default to 0 if no count available
    const total = countResult?.total || 0;
    
    // Add pagination to the main query
    orderQuery += ` ORDER BY o.created_at DESC LIMIT ${perPage} OFFSET ${offset}`;
    console.log('Final query:', orderQuery);
    
    // Execute main query to get orders
    let result;
    try {
      result = await env.DB.prepare(orderQuery).all();
      console.log(`Query returned ${result?.results?.length || 0} results`);
    } catch (queryError) {
      console.error('Error executing order query:', queryError, { query: orderQuery });
      // Return empty result on query error
      return new Response(JSON.stringify({
        success: false,
        message: 'Error fetching orders: ' + queryError.message,
        data: [],
        pagination: { total: 0, page, perPage, totalPages: 0 }
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
        status: 500
      });
    }
    
    // Calculate total pages
    const totalPages = Math.ceil(total / perPage);
    
    // Process orders to format data consistently
    const processedOrders = result?.results?.map(order => {
      // Add derived fields or normalize data here
      return {
        ...order,
        // Ensure these fields exist with default values if null
        shipping_status: order.shipping_status || 'menunggu-diproses',
        payment_status: order.payment_status || 'pending',
        order_status: order.order_status || 'pending'
      };
    }) || [];
    
    // Return success response with orders and pagination info
    return new Response(JSON.stringify({
      success: true,
      message: 'Orders retrieved successfully',
      data: processedOrders,
      pagination: {
        total,
        page,
        perPage,
        totalPages
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('Error in getOutletOrders:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to fetch outlet orders',
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
