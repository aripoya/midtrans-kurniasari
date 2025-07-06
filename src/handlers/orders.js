import { Buffer } from 'node:buffer';

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

    const totalAmount = items.reduce((total, item) => total + (Number(item.price) * Number(item.quantity)), 0);
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
          ).bind(item.name, Number(item.price)).run();
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
        price: Number(item.price),
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

  try {
    const url = new URL(request.url);
    const orderId = url.pathname.split('/').pop();

    if (!orderId) {
      return new Response(JSON.stringify({ success: false, error: 'Order ID is required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
    }

    if (!env.DB) {
      return new Response(JSON.stringify({ success: false, error: 'Database not available' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
    }

    const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();

    if (!order) {
      return new Response(JSON.stringify({ success: false, error: 'Order not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
    }

    const { results: items } = await env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(orderId).all();

    return new Response(JSON.stringify({ success: true, order: { ...order, items } }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }});

  } catch (error) {
    console.error('Get Order By ID Error:', error.message, error.stack);
    return new Response(JSON.stringify({ success: false, error: 'Failed to fetch order' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
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

// Admin endpoint to get enhanced order list with more details
export async function getAdminOrders(request, env) {
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
    // TODO: Add real admin authentication here
    // For now, we'll just implement the basic endpoint functionality
    
    // Get pagination parameters from URL query
    const url = new URL(request.url);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    
    console.log(`Getting admin orders with offset=${offset}, limit=${limit}`);
    
    if (!env.DB) {
      throw new Error('Database binding not found');
    }

    // First check if GROUP_CONCAT is available in this D1 instance
    try {
      await env.DB.prepare('SELECT GROUP_CONCAT(1,2) as test').first();
      console.log('GROUP_CONCAT is available in D1');
    } catch (sqlError) {
      console.error('GROUP_CONCAT test failed:', sqlError);
      // Fall back to simpler query without GROUP_CONCAT
    }

    console.log('Running admin orders query...');
    
    // Get all orders first (without items to avoid GROUP_CONCAT issues)
    const orders = await env.DB.prepare(`
      SELECT * 
      FROM orders
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    console.log('Orders query returned:', {
      success: !!orders,
      resultsExist: !!orders?.results,
      count: orders?.results?.length || 0
    });

    if (!orders || !orders.results) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to fetch orders', 
        details: 'No results from database query' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Process each order and fetch items separately (safer than GROUP_CONCAT)
    const processedOrders = await Promise.all(orders.results.map(async order => {
      try {
        // Get items for this specific order
        const orderItems = await env.DB.prepare(`
          SELECT product_id, product_name, price, quantity 
          FROM order_items 
          WHERE order_id = ?
        `).bind(order.id).all();
        
        const items = orderItems?.results || [];
        
        // Parse payment_response if it exists
        let paymentDetails = null;
        if (order.payment_response) {
          try {
            paymentDetails = JSON.parse(order.payment_response);
          } catch (e) {
            console.error(`Error parsing payment response for order ${order.id}:`, e);
          }
        }

        return {
          ...order,
          items,
          payment_details: paymentDetails,
          total_amount: items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0)
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

    // Count total orders for pagination
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
    const orderId = url.pathname.split('/')[3]; // Assuming URL is /api/orders/:id/status
    const { status } = await request.json();

    if (!orderId || !status) {
      return new Response(JSON.stringify({ success: false, error: 'Order ID and status are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const allowedStatuses = ['dikemas', 'siap kirim', 'sedang dikirim', 'received'];
    if (!allowedStatuses.includes(status)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid status value' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!env.DB) {
      throw new Error("Database binding not found.");
    }

    const updateResult = await env.DB.prepare(
      'UPDATE orders SET shipping_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(status, orderId).run();

    if (updateResult.meta.changes === 0) {
        return new Response(JSON.stringify({ success: false, error: 'Order not found or status unchanged' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, message: 'Order status updated successfully' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Update Order Status Error:', error.message, error.stack);
    return new Response(JSON.stringify({ success: false, error: 'Failed to update order status' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
    const orderId = url.pathname.split('/')[3]; // Assuming URL is /api/orders/:id/details
    
    console.log(`[updateOrderDetails] Processing update for order: ${orderId}`);
    
    // Parse request body dengan safe error handling
    let data;
    try {
      data = await request.json();
      console.log(`[updateOrderDetails] Request data:`, JSON.stringify(data));
    } catch (parseError) {
      console.error(`[updateOrderDetails] Failed to parse request body:`, parseError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid request body format',
        details: parseError.message
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    const { status, admin_note, shipping_area, pickup_method, metode_pengiriman, tracking_number, courier_service } = data;

    // Validasi dasar
    if (!orderId) {
      console.error(`[updateOrderDetails] Missing order ID`);
      return new Response(JSON.stringify({ success: false, error: 'Order ID is required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    // Pastikan order ID ada di database
    try {
      const orderCheck = await env.DB.prepare(`SELECT id FROM orders WHERE id = ?`).bind(orderId).first();
      if (!orderCheck) {
        console.error(`[updateOrderDetails] Order not found: ${orderId}`);
        return new Response(JSON.stringify({ success: false, error: 'Order not found' }), 
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } catch (dbError) {
      console.error(`[updateOrderDetails] Error checking order existence:`, dbError);
      throw dbError; // Re-throw untuk ditangkap di catch utama
    }

    // Persiapkan query dan parameter update
    let updateFields = [];
    let updateParams = [];
    
    // Hanya update field yang diberikan dalam request
    if (status !== undefined) {
      const allowedStatuses = ['dikemas', 'siap kirim', 'sedang dikirim', 'received'];
      if (!allowedStatuses.includes(status)) {
        console.error(`[updateOrderDetails] Invalid status: ${status}`);
        return new Response(JSON.stringify({ success: false, error: `Invalid status value. Allowed values: ${allowedStatuses.join(', ')}` }), 
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      updateFields.push('shipping_status = ?');
      updateParams.push(status);
    }
    
    if (admin_note !== undefined) {
      updateFields.push('admin_note = ?');
      updateParams.push(admin_note || null); // Konversi string kosong ke null
    }
    
    if (shipping_area !== undefined) {
      const allowedShippingAreas = ['dalam-kota', 'luar-kota'];
      if (shipping_area && !allowedShippingAreas.includes(shipping_area)) {
        console.error(`[updateOrderDetails] Invalid shipping_area: ${shipping_area}`);
        return new Response(JSON.stringify({ success: false, error: `Invalid shipping area value. Allowed values: ${allowedShippingAreas.join(', ')}` }), 
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      updateFields.push('shipping_area = ?');
      updateParams.push(shipping_area || null);
    }
    
    if (pickup_method !== undefined) {
      // Validasi pickup_method hanya jika shipping_area adalah 'dalam-kota'
      if (shipping_area === 'dalam-kota' || 
         (shipping_area === undefined && data.shipping_area === 'dalam-kota')) {
        const allowedPickupMethods = ['sendiri', 'ojek-online'];
        if (pickup_method && !allowedPickupMethods.includes(pickup_method)) {
          console.error(`[updateOrderDetails] Invalid pickup_method: ${pickup_method}`);
          return new Response(JSON.stringify({ success: false, error: `Invalid pickup method value. Allowed values: ${allowedPickupMethods.join(', ')}` }), 
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
      updateFields.push('pickup_method = ?');
      updateParams.push(pickup_method || null);
    }
    
    // Validasi dan proses metode_pengiriman
    if (metode_pengiriman !== undefined) {
      const allowedDeliveryMethods = ['ojek-online', 'team-delivery'];
      if (metode_pengiriman && !allowedDeliveryMethods.includes(metode_pengiriman)) {
        console.error(`[updateOrderDetails] Invalid metode_pengiriman: ${metode_pengiriman}`);
        return new Response(JSON.stringify({ success: false, error: `Invalid delivery method value. Allowed values: ${allowedDeliveryMethods.join(', ')}` }), 
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      updateFields.push('metode_pengiriman = ?');
      updateParams.push(metode_pengiriman || null);
    }
    
    // Process tracking_number if provided
    if (tracking_number !== undefined) {
      updateFields.push('tracking_number = ?');
      updateParams.push(tracking_number || null);
    }
    
    // Process courier_service if provided
    if (courier_service !== undefined) {
      updateFields.push('courier_service = ?');
      updateParams.push(courier_service || null);
    }
    
    // Tambahkan updated_at dan ID
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateParams.push(orderId); // Untuk WHERE clause
    
    // Jika tidak ada field yang diupdate
    if (updateFields.length <= 1) { // Hanya updated_at
      console.warn(`[updateOrderDetails] No fields to update for order: ${orderId}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No fields provided to update' 
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!env.DB) {
      console.error(`[updateOrderDetails] Database binding not found`);
      throw new Error("Database binding not found.");
    }
    
    // Cek apakah kolom shipping_area, pickup_method, dan admin_note ada di tabel
    try {
      console.log(`[updateOrderDetails] Checking if columns exist in orders table`);
      await env.DB.prepare("SELECT shipping_area, pickup_method, admin_note FROM orders LIMIT 1").first();
      console.log(`[updateOrderDetails] All required columns exist, proceeding with update`);
    } catch (e) {
      if (e.message.includes('no such column')) {
        // Kolom belum ada, tambahkan kolom baru
        console.log(`[updateOrderDetails] Adding missing columns to orders table`);
        try {
          // Cek keberadaan kolom shipping_area
          try {
            await env.DB.prepare("SELECT shipping_area FROM orders LIMIT 1").first();
            console.log(`[updateOrderDetails] Column shipping_area already exists`);
          } catch (columnError) {
            if (columnError.message.includes('no such column: shipping_area')) {
              console.log(`[updateOrderDetails] Adding column shipping_area`);
              await env.DB.prepare('ALTER TABLE orders ADD COLUMN shipping_area TEXT DEFAULT NULL').run();
            } else {
              throw columnError;
            }
          }
          
          // Cek keberadaan kolom pickup_method
          try {
            await env.DB.prepare("SELECT pickup_method FROM orders LIMIT 1").first();
            console.log(`[updateOrderDetails] Column pickup_method already exists`);
          } catch (columnError) {
            if (columnError.message.includes('no such column: pickup_method')) {
              console.log(`[updateOrderDetails] Adding column pickup_method`);
              await env.DB.prepare('ALTER TABLE orders ADD COLUMN pickup_method TEXT DEFAULT NULL').run();
            } else {
              throw columnError;
            }
          }
          
          // Cek keberadaan kolom admin_note
          try {
            await env.DB.prepare("SELECT admin_note FROM orders LIMIT 1").first();
            console.log(`[updateOrderDetails] Column admin_note already exists`);
          } catch (columnError) {
            if (columnError.message.includes('no such column: admin_note')) {
              console.log(`[updateOrderDetails] Adding column admin_note`);
              await env.DB.prepare('ALTER TABLE orders ADD COLUMN admin_note TEXT DEFAULT NULL').run();
            } else {
              throw columnError;
            }
          }
          
          // Cek keberadaan kolom metode_pengiriman
          try {
            await env.DB.prepare("SELECT metode_pengiriman FROM orders LIMIT 1").first();
            console.log(`[updateOrderDetails] Column metode_pengiriman already exists`);
          } catch (columnError) {
            if (columnError.message.includes('no such column: metode_pengiriman')) {
              console.log(`[updateOrderDetails] Adding column metode_pengiriman`);
              await env.DB.prepare('ALTER TABLE orders ADD COLUMN metode_pengiriman TEXT DEFAULT NULL').run();
            } else {
              throw columnError;
            }
          }
          
          // Cek keberadaan kolom tracking_number
          try {
            await env.DB.prepare("SELECT tracking_number FROM orders LIMIT 1").first();
            console.log(`[updateOrderDetails] Column tracking_number already exists`);
          } catch (columnError) {
            if (columnError.message.includes('no such column: tracking_number')) {
              console.log(`[updateOrderDetails] Adding column tracking_number`);
              await env.DB.prepare('ALTER TABLE orders ADD COLUMN tracking_number TEXT DEFAULT NULL').run();
            } else {
              throw columnError;
            }
          }
          
          // Cek keberadaan kolom courier_service
          try {
            await env.DB.prepare("SELECT courier_service FROM orders LIMIT 1").first();
            console.log(`[updateOrderDetails] Column courier_service already exists`);
          } catch (columnError) {
            if (columnError.message.includes('no such column: courier_service')) {
              console.log(`[updateOrderDetails] Adding column courier_service`);
              await env.DB.prepare('ALTER TABLE orders ADD COLUMN courier_service TEXT DEFAULT NULL').run();
            } else {
              throw columnError;
            }
          }
          
          console.log(`[updateOrderDetails] All missing columns added successfully`);
        } catch (alterError) {
          console.error(`[updateOrderDetails] Error adding columns:`, alterError);
          throw alterError; // Re-throw untuk ditangkap di catch utama
        }
      } else {
        console.error(`[updateOrderDetails] Error checking columns:`, e);
        throw e; // Re-throw jika error bukan karena kolom tidak ada
      }
    }

    // Build query string
    const updateQuery = `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`;
    console.log(`[updateOrderDetails] Update query: ${updateQuery}`);
    console.log(`[updateOrderDetails] Update params:`, JSON.stringify(updateParams));
    
    // Execute query
    let updateResult;
    try {
      updateResult = await env.DB.prepare(updateQuery).bind(...updateParams).run();
      console.log(`[updateOrderDetails] Update result:`, JSON.stringify(updateResult.meta));
    } catch (dbError) {
      console.error(`[updateOrderDetails] Database error during update:`, dbError);
      throw dbError; // Re-throw untuk ditangkap di catch utama
    }

    // Check if update was successful
    if (!updateResult || updateResult.meta.changes === 0) {
      console.warn(`[updateOrderDetails] No rows updated for order: ${orderId}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Order not found or details unchanged' 
      }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[updateOrderDetails] Successfully updated order: ${orderId}`);
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Order details updated successfully',
      data: { 
        orderId,
        status: status || undefined, 
        shipping_area: shipping_area || undefined, 
        pickup_method: pickup_method || undefined,
        admin_note: admin_note || undefined
      }
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error(`[updateOrderDetails] Unhandled error:`, error.message, error.stack);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to update order details',
      details: error.message 
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
}
