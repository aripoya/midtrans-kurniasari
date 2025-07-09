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

    const finalOrder = {
      ...order,
      lokasi_pengiriman: lokasiPengirimanNama,
      lokasi_pengambilan: lokasiPengambilanNama,
      items,
      shipping_images
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

    const allowedStatuses = ['pending', 'dikemas', 'siap kirim', 'siap di ambil', 'sedang dikirim', 'received'];
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
    const orderId = url.pathname.split('/')[3];

    if (!orderId) {
      return new Response(JSON.stringify({ success: false, error: 'Order ID is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await request.json();
    console.log(`[updateOrderDetails] Received for order ${orderId}:`, JSON.stringify(data));

    const {
      status,
      // shipping_area sekarang sudah ada di database, bisa digunakan kembali
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
      const allowedStatuses = ['pending', 'dikemas', 'siap kirim', 'siap di ambil', 'sedang dikirim', 'received'];
      if (!allowedStatuses.includes(status)) {
        return new Response(JSON.stringify({ success: false, error: `Invalid status value: ${status}. Allowed values: ${allowedStatuses.join(', ')}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
