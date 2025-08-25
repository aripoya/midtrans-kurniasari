import { Buffer } from 'node:buffer';
import { createNotification } from './notifications.js';
import { determineOutletFromLocation } from './outlet-assignment.js';
import { AdminActivityLogger, getClientInfo } from '../utils/admin-activity-logger.js';
import { derivePaymentStatusFromData } from '../utils/payment-status.js';

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

    // Determine outlet assignment based on location
    const outletId = determineOutletFromLocation(
      orderData.lokasi_pengiriman,
      orderData.lokasi_pengambilan,
      orderData.shipping_area
    );
    
    console.log('🏪 Order assignment:', {
      orderId,
      outletId,
      lokasi_pengiriman: orderData.lokasi_pengiriman,
      lokasi_pengambilan: orderData.lokasi_pengambilan,
      shipping_area: orderData.shipping_area
    });

    // Normalize pickup_method: legacy 'pickup' -> 'ojek-online'
    const normalizedPickupMethod = orderData.pickup_method === 'pickup' ? 'ojek-online' : orderData.pickup_method;

    // Insert the order into the database, now including outlet assignment
    // Ensure all values are properly defined to avoid D1 undefined errors
    const safeOutletId = outletId || null;
    const safeMidtransToken = midtransData?.token || null;
    const safeMidtransRedirectUrl = midtransData?.redirect_url || null;
    const safeMidtransResponse = midtransData ? JSON.stringify(midtransData) : null;
    
    console.log('🔧 Database insertion values:', {
      orderId,
      customer_name,
      email,
      customerPhone: customerPhone || null,
      totalAmount,
      snap_token: safeMidtransToken,
      payment_link: safeMidtransRedirectUrl,
      lokasi_pengiriman: orderData.lokasi_pengiriman || null
    });

    // Get admin info from request if authenticated
    let createdByAdminId = null;
    let createdByAdminName = null;
    let adminUser = null;
    
    console.log('🔍 [ADMIN DEBUG] request.user:', request.user);
    console.log('🔍 [ADMIN DEBUG] request.user exists:', !!request.user);
    
    if (request.user) {
      createdByAdminId = request.user.id;
      createdByAdminName = request.user.name || request.user.username;
      adminUser = request.user;
      
      console.log('✅ [ADMIN DEBUG] Admin detected:');
      console.log('   - createdByAdminId:', createdByAdminId);
      console.log('   - createdByAdminName:', createdByAdminName);
      console.log('   - request.user.id:', request.user.id);
      console.log('   - request.user.name:', request.user.name);
      console.log('   - request.user.username:', request.user.username);
    } else {
      console.log('❌ [ADMIN DEBUG] No admin user found in request');
    }

    await env.DB.prepare(`
      INSERT INTO orders (id, customer_name, customer_email, customer_phone, total_amount, snap_token, payment_link, payment_response, shipping_status, customer_address, lokasi_pengiriman, lokasi_pengambilan, shipping_area, pickup_method, courier_service, shipping_notes, created_by_admin_id, created_by_admin_name, tipe_pesanan)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        orderId,
        customer_name,
        email,
        customerPhone || null,
        totalAmount,
        safeMidtransToken,
        safeMidtransRedirectUrl,
        safeMidtransResponse,
        'pending', // Initial shipping status
        customer_address || null,
        orderData.lokasi_pengiriman || null,
        orderData.lokasi_pengambilan || null,
        orderData.shipping_area || null,
        normalizedPickupMethod || null,
        orderData.courier_service || null,
        orderData.shipping_notes || null,
        createdByAdminId,
        createdByAdminName,
        orderData.tipe_pesanan || 'Pesan Antar'
      ).run();

    // Statements for inserting into 'order_items' table
    const dbStatements = [];
    for (const item of processedItems) {
      // Ensure we consistently use the correct unit price field
      const unitPrice = Number(item.product_price ?? item.price);
      const qty = Number(item.quantity);
      const subtotal = unitPrice * qty;
      dbStatements.push(
        env.DB.prepare(
          `INSERT INTO order_items (order_id, product_name, product_price, quantity, subtotal)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(orderId, item.name, unitPrice, qty, subtotal)
      );
    }

    // Batch execute item insertion statements
    if (dbStatements.length > 0) {
      await env.DB.batch(dbStatements);
    }

    // Log order creation activity if admin is authenticated
    if (adminUser) {
      try {
        const activityLogger = new AdminActivityLogger(env);
        const { ipAddress, userAgent } = getClientInfo(request);
        await activityLogger.logOrderCreated(adminUser, orderId, customer_name, totalAmount, ipAddress, userAgent);
      } catch (logError) {
        console.error('Failed to log order creation activity:', logError);
        // Don't fail the order creation if logging fails
      }
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
        // Omit deprecated pickup_outlet from response payload
        const { pickup_outlet, ...orderWithoutPickupOutlet } = order;
        return {
          ...orderWithoutPickupOutlet,
          items,
          // Ensure consistent payment status across endpoints
          payment_status: derivePaymentStatusFromData(order)
        };
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
    const { results: rawItems } = await env.DB.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(orderId).all();
    
    // Map database fields to frontend-expected field names
    const items = rawItems.map(item => ({
      ...item,
      price: item.product_price // Map product_price to price for frontend compatibility
    }));

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

    // Step 4: Use stored location fields directly (legacy locations_view removed)
    failedQuery = 'mapping stored location fields';
    const lokasiPengirimanNama = order.lokasi_pengiriman || null;
    const lokasiPengambilanNama = order.lokasi_pengambilan || null;

    // Log shipping_area untuk debugging
    console.log(`[getOrderById] Order ${orderId} shipping_area: ${order.shipping_area}`);

    // Step 5: Derive consistent payment status (prefer payment_response.transaction_status)
    const derivedPaymentStatus = derivePaymentStatusFromData(order);
    let processedOrder = { ...order, payment_status: derivedPaymentStatus };
    if (order.payment_response) {
      try {
        const paymentDetails = JSON.parse(order.payment_response);
        processedOrder = {
          ...processedOrder,
          payment_method: paymentDetails.payment_type || processedOrder.payment_method,
          payment_time: paymentDetails.settlement_time || processedOrder.payment_time
        };
        console.log(`[getOrderById] Derived payment status for ${orderId}: ${derivedPaymentStatus}`);
      } catch (e) {
        console.error(`[getOrderById] Error parsing payment_response for order ${orderId}:`, e);
      }
    }

    const finalOrder = {
      ...processedOrder,
      lokasi_pengiriman: lokasiPengirimanNama,
      lokasi_pengambilan: lokasiPengambilanNama,
      items,
      shipping_images,
      // Only include active pickup metadata; omit deprecated pickup_outlet
      picked_up_by: order.picked_up_by || null,
      pickup_date: order.pickup_date || null,
      pickup_time: order.pickup_time || null
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

    // Delete all related data first to maintain referential integrity
    console.log(`[DELETE] Starting deletion process for order: ${orderId}`);
    
    try {
      // Delete notifications
      const notifResult = await env.DB.prepare(
        `DELETE FROM notifications WHERE order_id = ?`
      ).bind(orderId).run();
      console.log(`[DELETE] Deleted ${notifResult.meta.changes} notifications`);
    } catch (e) {
      console.log(`[DELETE] Notifications table may not exist: ${e.message}`);
    }
    
    try {
      // First get images for R2 cleanup before deleting DB records
      let imagesToDelete = [];
      try {
        const imageQuery = await env.DB.prepare(
          `SELECT image_url, cloudflare_id FROM shipping_images WHERE order_id = ?`
        ).bind(orderId).all();
        imagesToDelete = imageQuery.results || [];
      } catch (selectError) {
        console.log(`[DELETE] Could not select images for cleanup: ${selectError.message}`);
      }
      
      // Delete shipping images from database
      const imagesResult = await env.DB.prepare(
        `DELETE FROM shipping_images WHERE order_id = ?`
      ).bind(orderId).run();
      console.log(`[DELETE] Deleted ${imagesResult.meta.changes} shipping images from database`);
      
      // Clean up R2 storage
      if (imagesToDelete.length > 0 && env.SHIPPING_IMAGES) {
        for (const image of imagesToDelete) {
          try {
            if (image.cloudflare_id) {
              await env.SHIPPING_IMAGES.delete(image.cloudflare_id);
              console.log(`[DELETE] Removed image ${image.cloudflare_id} from R2 storage`);
            }
          } catch (r2Error) {
            console.log(`[DELETE] Failed to delete ${image.cloudflare_id} from R2: ${r2Error.message}`);
          }
        }
      }
    } catch (e) {
      console.log(`[DELETE] Critical shipping images deletion error: ${e.message}`);
      throw e; // This is critical for foreign key constraints
    }
    
    try {
      // Delete audit logs
      const auditResult = await env.DB.prepare(
        `DELETE FROM audit_logs WHERE order_id = ?`
      ).bind(orderId).run();
      console.log(`[DELETE] Deleted ${auditResult.meta.changes} audit logs`);
    } catch (e) {
      console.log(`[DELETE] Audit logs table may not exist: ${e.message}`);
    }
    
    try {
      // Delete order update logs
      const updateLogsResult = await env.DB.prepare(
        `DELETE FROM order_update_logs WHERE order_id = ?`
      ).bind(orderId).run();
      console.log(`[DELETE] Deleted ${updateLogsResult.meta.changes} update logs`);
    } catch (e) {
      console.log(`[DELETE] Order update logs table may not exist: ${e.message}`);
    }
    
    try {
      // Delete order items
      const itemsResult = await env.DB.prepare(
        `DELETE FROM order_items WHERE order_id = ?`
      ).bind(orderId).run();
      console.log(`[DELETE] Deleted ${itemsResult.meta.changes} order items`);
    } catch (e) {
      console.log(`[DELETE] Order items deletion error: ${e.message}`);
      throw e; // This one is critical
    }

    // Finally delete the order
    const result = await env.DB.prepare(
      `DELETE FROM orders WHERE id = ?`
    ).bind(orderId).run();
    
    console.log(`[DELETE] Successfully deleted order ${orderId}, main record changes: ${result.meta.changes}`);

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

    // Get deliveryman's outlet assignment and resolve outlet name
    const deliveryUser = await env.DB.prepare(`
      SELECT outlet_id FROM users WHERE id = ? AND role = 'deliveryman'
    `).bind(deliverymanId).first();
    let outletNameForUser = null;
    if (deliveryUser?.outlet_id) {
      const outletRow = await env.DB.prepare(`
        SELECT name FROM outlets_unified WHERE id = ?
      `).bind(deliveryUser.outlet_id).first();
      outletNameForUser = outletRow?.name || null;
    }

    // Build comprehensive query for deliveryman orders
    let deliveryQuery = `
      SELECT *
      FROM orders
      WHERE assigned_deliveryman_id = ? 
         OR pickup_method = 'deliveryman'
    `;
    
    let queryParams = [deliverymanId];
    
    // Include outlet orders by lokasi_pengambilan that are ready for delivery if user has outlet assignment
    if (outletNameForUser) {
      deliveryQuery += ` 
         OR (lokasi_pengambilan = ? AND shipping_status IN ('siap kirim', 'siap ambil', 'shipping'))
      `;
      queryParams.push(outletNameForUser);
    }
    
    deliveryQuery += ` ORDER BY created_at DESC`;
    
    console.log(`🚚 Delivery query for user ${deliverymanId} (outlet_name: ${outletNameForUser || 'none'}):`, deliveryQuery);
    
    const ordersResult = await env.DB.prepare(deliveryQuery).bind(...queryParams).all();

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

        // Omit deprecated pickup_outlet from response
        const { pickup_outlet, ...orderClean } = order;

        // Add processed order with shipping images
        processedOrders.push({
          ...orderClean,
          shipping_images,
          // Ensure consistent defaults and derived fields
          shipping_status: order.shipping_status || 'menunggu diproses',
          // Include derived payment status for consistency
          payment_status: derivePaymentStatusFromData(order)
        });
      } catch (imageError) {
        console.error(`Error fetching images for order ${order.id}:`, imageError);
        // Continue with order but without images
        const { pickup_outlet, ...orderClean } = order;
        processedOrders.push({
          ...orderClean,
          shipping_images: [],
          shipping_status: order.shipping_status || 'menunggu diproses',
          payment_status: derivePaymentStatusFromData(order)
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
        o.lokasi_pengiriman AS lokasi_pengiriman_nama,
        o.lokasi_pengambilan AS lokasi_pengambilan_nama
      FROM orders o
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
          `SELECT product_name, product_price, quantity, subtotal FROM order_items WHERE order_id = ?`
        ).bind(order.id).all();
        
        const rawItems = orderItems?.results || [];
        // Normalize to expose a consistent 'price' field for frontend compatibility
        const items = rawItems.map(it => ({
          ...it,
          price: it.product_price
        }));
        
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

        // Omit deprecated pickup_outlet from response
        const { pickup_outlet, ...restNoPickup } = restOfOrder;

        return {
          ...restNoPickup,
          lokasi_pengiriman: lokasi_pengiriman_nama, // Use the name from the JOIN
          lokasi_pengambilan: lokasi_pengambilan_nama, // Use the name from the JOIN
          items,
          payment_details: paymentDetails,
          payment_status: derivePaymentStatusFromData(order),
          total_amount: items.reduce((sum, item) => {
            const unit = Number(item.price) || 0;
            const qty = Number(item.quantity) || 0;
            const sub = item.subtotal != null ? Number(item.subtotal) : (unit * qty);
            return sum + sub;
          }, 0)
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
    // Accept lokasi_pengambilan as the new outlet assignment field.
    // For backward compatibility, if outlet_id is provided, resolve it to outlet name and update lokasi_pengambilan.
    const { status, pickupOutlet, pickedUpBy, pickupDate, pickupTime, outlet_id, lokasi_pengambilan, assigned_deliveryman_id } = await request.json();

    if (!orderId || !status) {
      return new Response(JSON.stringify({ success: false, error: 'Order ID and status are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Updated to match frontend utility normalization
    const allowedStatuses = [
      'menunggu diproses', 'pending', // backward compatibility
      'dikemas', 'diproses',
      'siap kirim', 'siap diambil', 'siap di ambil',
      'dalam pengiriman', 'sedang dikirim', 'dikirim',
      'diterima', 'received', 'sudah di terima',
      'sudah diambil', 'sudah di ambil' // NEW STATUS for pickup_sendiri orders
    ];
    if (!allowedStatuses.includes(status.toLowerCase())) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid status value', 
        allowedValues: ['menunggu diproses', 'pending', 'dikemas', 'siap kirim', 'siap di ambil', 'sedang dikirim', 'diterima', 'received', 'sudah diambil', 'sudah di ambil'] 
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!env.DB) {
      throw new Error("Database binding not found.");
    }

    // Get current order status and related information before updating
    const currentOrder = await env.DB.prepare(`
      SELECT 
        o.shipping_status,
        o.lokasi_pengambilan AS outlet_name,
        o.assigned_deliveryman_id
      FROM orders o
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

    // Update the order status and handle pickup status transition
    let updateQuery = 'UPDATE orders SET shipping_status = ?, updated_at = CURRENT_TIMESTAMP';
    let updateParams = [status];
    
    // Add outlet assignment (by name) if provided
    if (lokasi_pengambilan !== undefined && lokasi_pengambilan !== null) {
      updateQuery += ', lokasi_pengambilan = ?';
      updateParams.push(lokasi_pengambilan);
      console.log(`[DEBUG] Assigning order ${orderId} to outlet (by name): ${lokasi_pengambilan}`);
    } else if (outlet_id !== undefined && outlet_id !== null) {
      try {
        const outletRow = await env.DB.prepare('SELECT name FROM outlets_unified WHERE id = ?').bind(outlet_id).first();
        const outletNameFromId = outletRow?.name || null;
        if (outletNameFromId) {
          updateQuery += ', lokasi_pengambilan = ?';
          updateParams.push(outletNameFromId);
          console.log(`[DEBUG] Assigning order ${orderId} to outlet (resolved from id): ${outlet_id} -> ${outletNameFromId}`);
        } else {
          console.log(`[DEBUG] Could not resolve outlet name for id: ${outlet_id}`);
        }
      } catch (resolveErr) {
        console.error('Failed to resolve outlet name from id:', resolveErr);
      }
    }
    
    // Add delivery person assignment if provided
    if (assigned_deliveryman_id !== undefined) {
      updateQuery += ', assigned_deliveryman_id = ?';
      updateParams.push(assigned_deliveryman_id);
      console.log(`[DEBUG] Assigning order ${orderId} to deliveryman: ${assigned_deliveryman_id}`);
    }
    
    // When status becomes pickup-related, clear delivery fields and set pickup fields
    if (status.toLowerCase() === 'siap di ambil' || 
        status.toLowerCase() === 'siap diambil' || 
        status.toLowerCase() === 'sudah diambil' || 
        status.toLowerCase() === 'sudah di ambil') {
      
      console.log(`[DEBUG] Pickup transition detected for status: ${status}`);
      
      // Clear delivery-related fields
      updateQuery += ', shipping_area = NULL, pickup_method = NULL, courier_service = NULL, tracking_number = NULL, lokasi_pengiriman = NULL, lokasi_pengambilan = NULL';
      
      // Set pickup fields - use frontend values if provided, otherwise auto-generate
      let pickupOutletValue, pickedUpByValue, pickupDateValue, pickupTimeValue;
      
      // Use frontend-provided values if available, otherwise auto-generate
      if (pickupOutlet && pickupOutlet.trim()) {
        pickupOutletValue = pickupOutlet.trim();
      } else {
        pickupOutletValue = currentOrder.outlet_name || 'Outlet Tidak Diketahui';
      }
      
      if (pickedUpBy && pickedUpBy.trim()) {
        pickedUpByValue = pickedUpBy.trim();
      } else {
        pickedUpByValue = request.user ? (request.user.username || request.user.name || request.user.role || 'Admin') : 'System';
      }
      
      if (pickupDate && pickupDate.trim()) {
        pickupDateValue = pickupDate.trim();
      } else {
        const now = new Date();
        pickupDateValue = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()}`;
      }
      
      if (pickupTime && pickupTime.trim()) {
        pickupTimeValue = pickupTime.trim();
      } else {
        pickupTimeValue = new Date().toLocaleTimeString('en-GB', { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'Asia/Jakarta'
        });
      }
      
      updateQuery += ', pickup_outlet = ?, picked_up_by = ?, pickup_date = ?, pickup_time = ?';
      updateParams.push(pickupOutletValue, pickedUpByValue, pickupDateValue, pickupTimeValue);
      
      console.log(`[DEBUG] Pickup fields - Outlet: ${pickupOutletValue}, Picked up by: ${pickedUpByValue}, Date: ${pickupDateValue}, Time: ${pickupTimeValue}`);
      
      console.log(`[DEBUG] Final SQL Query: ${updateQuery}`);
      console.log(`[DEBUG] SQL Parameters: `, updateParams);
    }
    
    updateQuery += ' WHERE id = ?';
    updateParams.push(orderId);
    
    const updateResult = await env.DB.prepare(updateQuery).bind(...updateParams).run();

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
      const outletName = currentOrder.outlet_name || null;
      const deliverymanId = currentOrder.assigned_deliveryman_id;
      // Resolve outletId for notifications (if needed) from name
      let outletId = null;
      if (outletName) {
        try {
          const resolved = await env.DB.prepare('SELECT id FROM outlets_unified WHERE name = ?').bind(outletName).first();
          outletId = resolved?.id || null;
        } catch (e) {
          console.log('Notification: failed to resolve outlet id from name', e);
        }
      }
      
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
      metode_pengiriman,
      // Pickup detail fields
      pickup_outlet,
      picked_up_by,
      pickup_date,
      pickup_time
    } = data;

    const orderCheck = await env.DB.prepare(`SELECT id FROM orders WHERE id = ?`).bind(orderId).first();
    if (!orderCheck) {
      return new Response(JSON.stringify({ success: false, error: 'Order not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch current order info for audit/notification and to compare status changes
    const currentOrderInfo = await env.DB.prepare(`
      SELECT shipping_status, lokasi_pengambilan AS outlet_name, assigned_deliveryman_id
      FROM orders
      WHERE id = ?
    `).bind(orderId).first();
    const oldStatus = currentOrderInfo?.shipping_status || null;

    const updateFields = [];
    const updateParams = [];
    let isPickupTransition = false;

    // Update shipping status jika ada
    if (status !== undefined) { 
      console.log(`[DEBUG updateOrderDetails] Processing status update: ${status}`);
      
      // Validasi status harus valid sebelum diupdate
      // Updated to match frontend utility normalization
      const allowedStatuses = [
        'menunggu diproses', 'pending', // backward compatibility
        'dikemas', 'diproses',
        'siap kirim', 'siap diambil', 'siap di ambil',
        'dalam pengiriman', 'sedang dikirim', 'dikirim',
        'diterima', 'received', 'sudah di terima',
        'sudah diambil', 'sudah di ambil' // NEW STATUS for pickup_sendiri orders
      ];
      if (!allowedStatuses.includes(status.toLowerCase())) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Invalid status value: ${status}`, 
          allowedValues: ['menunggu diproses', 'pending', 'dikemas', 'siap kirim', 'siap di ambil', 'sedang dikirim', 'diterima', 'received', 'sudah diambil', 'sudah di ambil'] 
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      // PICKUP STATUS TRANSITION LOGIC
      if (status.toLowerCase() === 'siap di ambil' || 
          status.toLowerCase() === 'siap diambil' || 
          status.toLowerCase() === 'sudah diambil' || 
          status.toLowerCase() === 'sudah di ambil') {
        
        isPickupTransition = true;
        console.log(`[DEBUG updateOrderDetails] Pickup transition detected for status: ${status}`);
        
        // Clear delivery-related fields
        updateFields.push('shipping_area = NULL');
        updateFields.push('pickup_method = NULL'); 
        updateFields.push('courier_service = NULL');
        updateFields.push('tracking_number = NULL');
        updateFields.push('lokasi_pengiriman = NULL');
        updateFields.push('lokasi_pengambilan = NULL');
        
        // Set pickup fields with current outlet and user info
        const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const currentTime = new Date().toLocaleTimeString('en-GB', { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'Asia/Jakarta'
        }); // HH:MM format in Jakarta timezone
        
        // Get outlet name from current order or default
        const outletInfo = await env.DB.prepare(`
          SELECT lokasi_pengambilan AS outlet_name FROM orders WHERE id = ?
        `).bind(orderId).first();
        const outletName = outletInfo?.outlet_name || 'Outlet Tidak Diketahui';
        
        // Get user name from request if available, fallback to role or default
        let pickedUpBy = 'System';
        if (request.user) {
          pickedUpBy = request.user.username || request.user.name || request.user.role || 'Admin';
        }
        
        updateFields.push('pickup_outlet = ?');
        updateParams.push(outletName);
        updateFields.push('picked_up_by = ?');
        updateParams.push(pickedUpBy);
        updateFields.push('pickup_date = ?');
        updateParams.push(currentDate);
        updateFields.push('pickup_time = ?');
        updateParams.push(currentTime);
        
        console.log(`[DEBUG updateOrderDetails] Pickup fields set: outlet=${outletName}, by=${pickedUpBy}, date=${currentDate}, time=${currentTime}`);
      }
      
      updateFields.push('shipping_status = ?'); 
      updateParams.push(status); 
    }
    
    // Skip delivery fields if this is a pickup transition (they were already set to NULL)
    if (!isPickupTransition) {
      // Aktifkan kembali shipping_area karena kolom sudah ditambahkan ke database
      if (shipping_area !== undefined) { updateFields.push('shipping_area = ?'); updateParams.push(shipping_area); }
      // Kolom pickup_method sudah ditambahkan kembali ke database
      if (pickup_method !== undefined) { 
        const normalized = pickup_method === 'pickup' ? 'ojek-online' : pickup_method;
        updateFields.push('pickup_method = ?'); 
        updateParams.push(normalized); 
      }
      if (tracking_number !== undefined) { updateFields.push('tracking_number = ?'); updateParams.push(tracking_number); }
      if (courier_service !== undefined) { updateFields.push('courier_service = ?'); updateParams.push(courier_service); }
    }
    
    // Non-delivery fields that can always be updated
    if (admin_note !== undefined) { updateFields.push('admin_note = ?'); updateParams.push(admin_note); }
    if (tipe_pesanan !== undefined) { updateFields.push('tipe_pesanan = ?'); updateParams.push(tipe_pesanan); }
    
    // Pickup detail fields for pickup statuses
    if (pickup_outlet !== undefined) { updateFields.push('pickup_outlet = ?'); updateParams.push(pickup_outlet); }
    if (picked_up_by !== undefined) { updateFields.push('picked_up_by = ?'); updateParams.push(picked_up_by); }
    if (pickup_date !== undefined) { updateFields.push('pickup_date = ?'); updateParams.push(pickup_date); }
    if (pickup_time !== undefined) { updateFields.push('pickup_time = ?'); updateParams.push(pickup_time); }

    // Skip lokasi fields if this is a pickup transition (they were already set to NULL)
    if (!isPickupTransition) {
      // REDESIGNED SHIPPING INFO LOGIC - REMOVE INVALID VALIDATION
      // lokasi_pengambilan should always be outlet name, lokasi_pengiriman should be customer address
      // No need for locations table validation since these are actual outlet names and customer addresses
      if (lokasiPengirimanName !== undefined) {
        updateFields.push('lokasi_pengiriman = ?');
        updateParams.push(lokasiPengirimanName || null);
      }

      if (lokasiPengambilanName !== undefined) {
        updateFields.push('lokasi_pengambilan = ?');
        updateParams.push(lokasiPengambilanName || null);
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

      // If shipping status changed in this update, create audit log and notifications
      let logId = null;
      if (typeof status !== 'undefined' && String(status || '').toLowerCase() !== String(oldStatus || '').toLowerCase()) {
        // Prepare user info
        let userId = null;
        let userRole = 'anonymous';
        if (request.user) {
          userId = request.user.id;
          userRole = request.user.role;
        }

        // Create audit log
        logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        try {
          await env.DB.prepare(
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
        } catch (logErr) {
          console.error('[updateOrderDetails] Failed to create audit log:', logErr);
        }

        // Create notifications similar to updateOrderStatus
        try {
          // Resolve outletId from outlet name (lokasi_pengambilan)
          let outletId = null;
          try {
            const resolved = await env.DB.prepare('SELECT id FROM outlets_unified WHERE name = ?').bind(currentOrderInfo?.outlet_name || null).first();
            outletId = resolved?.id || null;
          } catch (e) {
            console.log('[updateOrderDetails] Failed to resolve outlet id from name:', e);
          }
          const deliverymanId = currentOrderInfo?.assigned_deliveryman_id || null;

          // Determine notification title and message based on status
          let title = 'Order Status Updated';
          let message = `Order #${orderId} status updated to "${status}"`;
          if (String(status).toLowerCase() === 'dalam pengiriman' ||
              String(status).toLowerCase() === 'sedang dikirim' ||
              String(status).toLowerCase() === 'dikirim') {
            title = 'Order In Transit';
            message = `Order #${orderId} is now being delivered to the customer.`;
          } else if (String(status).toLowerCase() === 'diterima' ||
                     String(status).toLowerCase() === 'received' ||
                     String(status).toLowerCase() === 'sudah di terima') {
            title = 'Order Delivered';
            message = `Order #${orderId} has been successfully delivered to the customer.`;
          } else if (String(status).toLowerCase() === 'siap kirim' ||
                     String(status).toLowerCase() === 'siap diambil' ||
                     String(status).toLowerCase() === 'siap di ambil') {
            title = 'Order Ready for Delivery';
            message = `Order #${orderId} is ready to be picked up from the outlet for delivery.`;
          }

          let updatedByText = 'The system';
          if (request.user) {
            updatedByText = request.user.role === 'admin' ? 'An admin' :
                            request.user.role === 'outlet_manager' ? 'The outlet manager' :
                            'The delivery person';
          }
          message += ` ${updatedByText} updated the status from "${oldStatus || 'not set'}" to "${status}".`;

          // Notify outlet (skip if the updater is an outlet manager themselves)
          if (outletId && userRole !== 'outlet_manager') {
            await createNotification(env, {
              outletId,
              orderId,
              title,
              message,
              type: 'order_status_update'
            });
          }

          // Notify assigned deliveryman if present (and they didn't make the change)
          if (deliverymanId && userId !== deliverymanId) {
            await createNotification(env, {
              userId: deliverymanId,
              orderId,
              title,
              message,
              type: 'order_status_update'
            });
          }
        } catch (notifErr) {
          console.error('[updateOrderDetails] Failed to create notifications:', notifErr);
        }
      }

      return new Response(JSON.stringify({ success: true, message: 'Order details updated successfully', logId }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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

    // Build query based on current schema (no outlet_id dependency)
    let orderQuery = `
      SELECT o.*,
             o.lokasi_pengambilan AS outlet_name,
             o.lokasi_pengiriman AS lokasi_pengiriman_nama,
             o.lokasi_pengambilan AS lokasi_pengambilan_nama
      FROM orders o
      WHERE 1=1
    `;
    
    let countQuery = "SELECT COUNT(*) as total FROM orders o WHERE 1=1";
    
    // Filter by status if provided
    if (status) {
      const statusCondition = ` AND LOWER(o.shipping_status) = LOWER('${status}')`;
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
          const outletIdFromUser = request.user.outlet_id || '';
          const outletInfo = outletIdFromUser ? 
            await env.DB.prepare(`SELECT name, location_alias FROM outlets_unified WHERE id = ?`).bind(outletIdFromUser).first() : 
            null;
          // Default values if no outlet info found
          const outletLocation = outletInfo?.location_alias || '';
          const outletName = outletInfo?.name || '';
          
          console.log(`📍 Outlet ${outletName} (ID: ${outletIdFromUser}) with location: ${outletLocation}`);
          
          // Generate safe pattern strings (escape special characters)
          const outletLocationPattern = (outletLocation || '').replace(/[%_]/g, '\\$&');
          const outletNamePattern = (outletName || '').replace(/[%_]/g, '\\$&');
          
          // Debug: Check for the specific order that's missing
          console.log('🔍 Checking for ORDER-1752037059362-FLO3E...');
          const debugOrderQuery = `SELECT id, lokasi_pengambilan, lokasi_pengiriman, shipping_area FROM orders WHERE id = 'ORDER-1752037059362-FLO3E'`;
          try {
            const debugOrder = await env.DB.prepare(debugOrderQuery).first();
            console.log('Debug order data:', debugOrder);
            
            if (debugOrder) {
              // Check if this order would match our outlet conditions
              const wouldMatch = 
                (outletName && debugOrder.lokasi_pengambilan && debugOrder.lokasi_pengambilan.toLowerCase() === outletName.toLowerCase()) ||
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
          
          // Build query with conditions for outlet matching by name/location
          let outletCondition = '';
          
          // Primary: exact match on lokasi_pengambilan (canonical outlet scoping)
          if (outletName) {
            outletCondition += `LOWER(o.lokasi_pengambilan) = LOWER('${outletName}')`;
          }
          
          // Fallback: location/name string matching
          if (outletName) {
            if (outletCondition) outletCondition += ' OR ';
            outletCondition += `(LOWER(o.lokasi_pengiriman) LIKE LOWER('%${outletName}%')`;
            
            // Add special matching patterns for common outlet names
            if (outletName.toLowerCase().includes('bonbin')) {
              outletCondition += ` OR LOWER(o.lokasi_pengiriman) LIKE LOWER('%bonbin%')`;
              outletCondition += ` OR LOWER(o.shipping_area) LIKE LOWER('%bonbin%')`;
            }
            if (outletName.toLowerCase().includes('malioboro')) {
              outletCondition += ` OR LOWER(o.lokasi_pengiriman) LIKE LOWER('%malioboro%')`;
              outletCondition += ` OR LOWER(o.shipping_area) LIKE LOWER('%malioboro%')`;
            }
            if (outletName.toLowerCase().includes('jogja')) {
              outletCondition += ` OR LOWER(o.lokasi_pengiriman) LIKE LOWER('%jogja%')`;
              outletCondition += ` OR LOWER(o.lokasi_pengambilan) LIKE LOWER('%jogja%')`;
            }
            
            // Include shipping_area and pickup location in fallback matching
            if (outletLocationPattern) {
              outletCondition += ` OR LOWER(o.lokasi_pengambilan) LIKE LOWER('%${outletLocationPattern}%')`;
              outletCondition += ` OR LOWER(o.shipping_area) LIKE LOWER('%${outletLocationPattern}%')`;
            }
            
            outletCondition += '))';
          }
          
          // If we couldn't build any conditions, use a fallback to show SOME orders
          if (!outletCondition) {
            // Fallback to show orders with no specific outlet or location assigned
            outletCondition = "(o.lokasi_pengambilan IS NULL OR o.lokasi_pengambilan = '')";
          }
          orderQuery += ` AND (${outletCondition})`;
          countQuery += ` AND (${outletCondition})`;
          
          console.log(`🔍 Expanded outlet order query to match outlet: ${outletName}`);
        } catch (outletError) {
          console.error(`Error getting outlet info: ${outletError.message}`, outletError);
          
          // Fallback: no outlet filter applied to avoid exposing wrong data
          orderQuery += ` AND 1=0`;
          countQuery += ` AND 1=0`;
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
      const { lokasi_pengiriman_nama, lokasi_pengambilan_nama, ...rest } = order;
      return {
        ...rest,
        lokasi_pengiriman: lokasi_pengiriman_nama || order.lokasi_pengiriman || null,
        lokasi_pengambilan: lokasi_pengambilan_nama || order.lokasi_pengambilan || null,
        // Ensure these fields exist with default values if null, using unified wording
        shipping_status: order.shipping_status || 'menunggu diproses',
        payment_status: derivePaymentStatusFromData(order),
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

// Public endpoint for customer to mark order as received
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
    const orderId = url.pathname.split('/')[3]; // /api/orders/:id/mark-received
    const { customer_phone, customer_name } = await request.json();

    if (!orderId || !customer_phone || !customer_name) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Order ID, customer phone, and customer name are required for verification' 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (!env.DB) {
      throw new Error("Database binding not found.");
    }

    // Verify customer info matches order and get outlet/delivery info
    const order = await env.DB.prepare(`
      SELECT id, customer_name, customer_phone, shipping_status, lokasi_pengambilan, assigned_deliveryman_id
      FROM orders
      WHERE id = ?
    `).bind(orderId).first();

    if (!order) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Order not found' 
      }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verify customer details match (case-insensitive and phone number flexible)
    const orderPhone = order.customer_phone?.replace(/\D/g, ''); // Remove non-digits
    const inputPhone = customer_phone?.replace(/\D/g, '');
    const orderName = order.customer_name?.toLowerCase().trim();
    const inputName = customer_name?.toLowerCase().trim();

    if (orderPhone !== inputPhone || orderName !== inputName) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Customer verification failed. Please check your name and phone number.' 
      }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Check if already received
    if (order.shipping_status?.toLowerCase() === 'diterima') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Order is already marked as received' 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Update order status to received
    const updateResult = await env.DB.prepare(
      'UPDATE orders SET shipping_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind('diterima', orderId).run();

    if (updateResult.meta.changes === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to update order status' 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Create audit log
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    await env.DB.prepare(
      `INSERT INTO order_update_logs (
        id, order_id, user_id, update_type, old_value, new_value, user_role, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      logId,
      orderId,
      null, // No user ID for customer action
      'shipping_status',
      order.shipping_status,
      'diterima',
      'customer',
      `Order marked as received by customer: ${customer_name}`
    ).run();

    // Create notifications for outlet and assigned deliveryman
    try {
      // Resolve outlet id from outlet name (lokasi_pengambilan)
      let outletId = null;
      if (order.lokasi_pengambilan) {
        try {
          const resolved = await env.DB.prepare('SELECT id FROM outlets_unified WHERE name = ?').bind(order.lokasi_pengambilan).first();
          outletId = resolved?.id || null;
        } catch (e) {
          console.log('[markOrderAsReceived] Failed to resolve outlet id from lokasi_pengambilan', e);
        }
      }
      const deliverymanId = order.assigned_deliveryman_id;
      const title = 'Order Delivered';
      const message = `Order #${orderId} has been marked as received by the customer (${customer_name}).`;

      // Notify all users in the outlet (manager and delivery team)
      if (outletId) {
        await createNotification(env, {
          outletId,
          orderId,
          title,
          message,
          type: 'order_status_update'
        });
      }

      // Notify the assigned deliveryman directly if present
      if (deliverymanId) {
        await createNotification(env, {
          userId: deliverymanId,
          orderId,
          title,
          message,
          type: 'order_status_update'
        });
      }
    } catch (notifError) {
      console.error('Failed to create notifications for received status:', notifError);
    }

    console.log(`✅ Order ${orderId} marked as received by customer: ${customer_name}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Order successfully marked as received',
      order_id: orderId,
      new_status: 'diterima'
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Error marking order as received:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
}
