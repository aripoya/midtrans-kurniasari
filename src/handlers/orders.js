import { Buffer } from 'node:buffer';
import { createNotification } from './notifications.js';
import { determineOutletFromLocation } from './outlet-assignment.js';
import { AdminActivityLogger, getClientInfo } from '../utils/admin-activity-logger.js';
import { derivePaymentStatusFromData } from '../utils/payment-status.js';

// Simple order ID generator
function generateOrderId() {
  return `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
}

// GET /api/orders/:id/qris-image
// Proxy the QRIS image to bypass third-party CORS so the frontend can draw it to canvas
export async function proxyOrderQrisImage(request, env) {
  const corsHeaders = request.corsHeaders || {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const orderId = url.pathname.split('/')[3]; // /api/orders/:id/qris-image
    if (!orderId) {
      return new Response('Order ID required', { status: 400, headers: corsHeaders });
    }

    const serverKey = env.MIDTRANS_SERVER_KEY;
    const isProduction = env.MIDTRANS_IS_PRODUCTION === 'true';
    const makeStatusUrl = (prod) => prod
      ? `https://api.midtrans.com/v2/${orderId}/status`
      : `https://api.sandbox.midtrans.com/v2/${orderId}/status`;

    if (!serverKey) {
      return new Response('Midtrans server key not configured', { status: 500, headers: corsHeaders });
    }

    const authHeader = `Basic ${btoa(`${serverKey}:`)}`;

    // Attempt in configured environment first, then fallback to the opposite env if needed
    async function fetchStatusWithFallback() {
      const firstUrl = makeStatusUrl(isProduction);
      const secondUrl = makeStatusUrl(!isProduction);
      let resp = await fetch(firstUrl, { headers: { Accept: 'application/json', Authorization: authHeader } });
      let statusData = await resp.json().catch(() => ({}));
      console.log('[proxyOrderQrisImage] Midtrans status attempt 1', { url: firstUrl, ok: resp.ok, status: resp.status, keys: Object.keys(statusData || {}) });
      if (!resp.ok) {
        // Try opposite environment
        const resp2 = await fetch(secondUrl, { headers: { Accept: 'application/json', Authorization: authHeader } });
        const statusData2 = await resp2.json().catch(() => ({}));
        console.log('[proxyOrderQrisImage] Midtrans status attempt 2', { url: secondUrl, ok: resp2.ok, status: resp2.status, keys: Object.keys(statusData2 || {}) });
        return { resp: resp2, statusData: statusData2 };
      }
      return { resp, statusData };
    }

    const { resp, statusData } = await fetchStatusWithFallback();
    if (!resp.ok) {
      return new Response(JSON.stringify(statusData), { status: resp.status || 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    let qrisUrl = null;
    const actions = Array.isArray(statusData?.actions) ? statusData.actions : [];
    const qrAction = actions.find(a => (a?.name || '').toLowerCase() === 'generate-qr-code');
    qrisUrl = qrAction?.url || statusData?.qr_code_url || statusData?.qr_url || null;
    if (!qrisUrl) {
      console.log('[proxyOrderQrisImage] No QR URL found. statusData summary:', {
        hasActions: !!actions?.length,
        payment_type: statusData?.payment_type,
        transaction_status: statusData?.transaction_status,
        availableKeys: Object.keys(statusData || {})
      });
      return new Response('QRIS URL not available', { status: 404, headers: corsHeaders });
    }

    // Fetch the image and stream it back with permissive CORS
    const imgResp = await fetch(qrisUrl);
    if (!imgResp.ok) {
      return new Response('Failed to fetch QR image', { status: 502, headers: corsHeaders });
    }
    const contentType = imgResp.headers.get('content-type') || 'image/png';
    const body = await imgResp.arrayBuffer();
    return new Response(body, { status: 200, headers: { ...corsHeaders, 'Content-Type': contentType } });
  } catch (error) {
    console.error('[proxyOrderQrisImage] Error:', error);
    return new Response('Proxy error', { status: 500, headers: corsHeaders });
  }
}

/**
 * Delivery Overview for deliverymen/admins
 * Returns all delivery-related orders grouped by deliveryman (including unassigned)
 * Query params:
 * - status: optional filter by shipping_status (case-insensitive)
 */
export async function getDeliveryOverview(request, env) {
  const corsHeaders = request.corsHeaders || {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!request.user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Allow deliveryman and admin to access overview
    const role = request.user.role;
    if (role !== 'deliveryman' && role !== 'admin') {
      return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status');

    // Fetch all delivery users
    const deliveryUsersRes = await env.DB.prepare(`
      SELECT id, username, name, outlet_id
      FROM users
      WHERE role = 'deliveryman'
      ORDER BY username
    `).all();
    const deliveryUsers = deliveryUsersRes.results || [];

    // Build base query for delivery-related orders with strict filters:
    // - shipping_area: dalam kota only (accepts variations 'dalam_kota', 'dalam-kota', 'dalam kota')
    // - pickup_method: Kurir Toko (stored as 'deliveryman' or variants)
    // - tipe_pesanan: Pesan Antar (accept 'pesan antar' or 'pesan-antar')
    let ordersQuery = `
      SELECT 
        id, customer_name, customer_address, shipping_status, pickup_method,
        shipping_area, tipe_pesanan,
        assigned_deliveryman_id, lokasi_pengambilan AS outlet_name,
        lokasi_pengiriman, delivery_date, delivery_time, created_at
      FROM orders
      WHERE 
        LOWER(COALESCE(shipping_area, '')) IN ('dalam_kota', 'dalam-kota', 'dalam kota')
        AND LOWER(COALESCE(pickup_method, '')) IN ('deliveryman', 'kurir toko', 'kurir_toko')
        AND LOWER(COALESCE(tipe_pesanan, '')) IN ('pesan antar', 'pesan-antar')
    `;
    const params = [];
    if (statusFilter) {
      ordersQuery += ` AND LOWER(shipping_status) = LOWER(?)`;
      params.push(statusFilter);
    }
    ordersQuery += ` ORDER BY created_at DESC`;

    const ordersRes = await env.DB.prepare(ordersQuery).bind(...params).all();
    const allOrders = ordersRes.results || [];

    // Group by deliveryman
    const byDeliveryman = new Map();
    for (const user of deliveryUsers) {
      byDeliveryman.set(user.id, { user, orders: [] });
    }
    const unassigned = [];

    for (const order of allOrders) {
      const did = order.assigned_deliveryman_id;
      if (did && byDeliveryman.has(did)) {
        byDeliveryman.get(did).orders.push(order);
      } else {
        unassigned.push(order);
      }
    }

    const deliverymen = Array.from(byDeliveryman.values()).map(group => ({
      user: group.user,
      count: group.orders.length,
      orders: group.orders,
    }));

    const response = {
      success: true,
      summary: {
        deliverymen_count: deliveryUsers.length,
        total_orders: allOrders.length,
        assigned_count: allOrders.filter(o => !!o.assigned_deliveryman_id).length,
        unassigned_count: unassigned.length,
      },
      deliverymen,
      unassigned: {
        count: unassigned.length,
        orders: unassigned,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('getDeliveryOverview error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to get delivery overview', details: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
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
    // Use Web Worker-compatible base64 encoding
    const authHeader = `Basic ${btoa(authString)}`;
    
    console.log('🔐 Midtrans API call:', {
      url: midtransUrl,
      orderId,
      serverKeyPrefix: serverKey ? serverKey.substring(0, 8) + '...' : 'MISSING',
      isProduction
    });
    
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
        console.error('❌ Midtrans API error:', {
          status: response.status,
          statusText: response.statusText,
          response: responseData,
          orderId
        });
        throw new Error(`Midtrans API error: ${responseData.error_messages ? responseData.error_messages.join(', ') : 'Unknown error'}`);
      }
      
      midtransData = responseData;
      console.log('✅ Midtrans response success:', {
        orderId,
        token: midtransData.token ? 'Token received' : 'No token',
        redirect_url: midtransData.redirect_url || 'No redirect URL',
        hasToken: !!midtransData.token
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

      // Validate admin user exists in DB to satisfy FK constraints
      try {
        const adminExists = await env.DB
          .prepare('SELECT id FROM users WHERE id = ?')
          .bind(createdByAdminId)
          .first();
        if (!adminExists) {
          console.warn('[ADMIN DEBUG] JWT user not found in users table. Falling back to null to avoid FK violation.');
          createdByAdminId = null;
          createdByAdminName = null;
          adminUser = null;
        }
      } catch (checkErr) {
        console.warn('[ADMIN DEBUG] Failed to validate admin existence. Falling back to null. Error:', checkErr?.message || checkErr);
        createdByAdminId = null;
        createdByAdminName = null;
        adminUser = null;
      }
    } else {
      console.log('❌ [ADMIN DEBUG] No admin user found in request');
    }

    // Validate outlet_id exists to avoid FK violations on some schemas (FK often points to legacy 'outlets')
    let finalOutletId = safeOutletId;
    try {
      if (safeOutletId) {
        // Prefer checking legacy 'outlets' because orders.outlet_id FK typically references this table
        const outletLegacy = await env.DB
          .prepare('SELECT id FROM outlets WHERE id = ?')
          .bind(safeOutletId)
          .first();
        if (outletLegacy && outletLegacy.id) {
          // OK
        } else {
          // Optionally check unified table for diagnostics
          let unifiedFound = false;
          try {
            const unified = await env.DB
              .prepare('SELECT id FROM outlets_unified WHERE id = ?')
              .bind(safeOutletId)
              .first();
            unifiedFound = !!unified;
          } catch (_) {}
          console.warn(`[CREATE ORDER] outlet_id ${safeOutletId} not found in outlets (legacy).` + (unifiedFound ? ' It exists in outlets_unified but FK likely points to outlets. Setting NULL.' : ' Setting NULL.'));
          finalOutletId = null;
        }
      }
    } catch (outletCheckErr) {
      console.warn('[CREATE ORDER] Failed to validate outlet_id existence. Proceeding without outlet assignment. Error:', outletCheckErr?.message || outletCheckErr);
      finalOutletId = null;
    }

    // Validate assigned_deliveryman_id (if provided) to avoid FK violations
    let finalAssignedDeliverymanId = null;
    try {
      const rawAssignedId = orderData.assigned_deliveryman_id || orderData.assignedDeliverymanId || null;
      if (rawAssignedId) {
        const deliveryUser = await env.DB
          .prepare("SELECT id, role FROM users WHERE id = ?")
          .bind(rawAssignedId)
          .first();
        if (deliveryUser && deliveryUser.id) {
          finalAssignedDeliverymanId = deliveryUser.id; // optionally we could enforce role === 'deliveryman'
        } else {
          console.warn(`[CREATE ORDER] assigned_deliveryman_id ${rawAssignedId} not found in users. Falling back to NULL.`);
        }
      }
    } catch (assignedCheckErr) {
      console.warn('[CREATE ORDER] Failed to validate assigned_deliveryman_id. Proceeding with NULL. Error:', assignedCheckErr?.message || assignedCheckErr);
      finalAssignedDeliverymanId = null;
    }

    // For luar kota orders, set lokasi_pengiriman to null
    const shippingArea = (orderData.shipping_area || '').toLowerCase();
    const isLuarKota = shippingArea.includes('luar') || shippingArea.includes('luar-kota') || shippingArea.includes('luar_kota');
    const finalLokasiPengiriman = isLuarKota ? null : (orderData.lokasi_pengiriman || null);

    console.log('📦 [CREATE ORDER] Shipping location logic:', {
      shipping_area: orderData.shipping_area,
      isLuarKota,
      original_lokasi_pengiriman: orderData.lokasi_pengiriman,
      final_lokasi_pengiriman: finalLokasiPengiriman
    });

    // Attempt insert with outlet_id; on FK error retry without it
    let orderInserted = false;
    try {
      await env.DB.prepare(`
        INSERT INTO orders (
          id, customer_name, customer_email, customer_phone, total_amount,
          snap_token, payment_link, payment_response, shipping_status,
          customer_address, lokasi_pengiriman, lokasi_pengambilan, shipping_area,
          pickup_method, courier_service, shipping_notes,
          assigned_deliveryman_id,
          created_by_admin_id, created_by_admin_name, tipe_pesanan,
          outlet_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          finalLokasiPengiriman,
          orderData.lokasi_pengambilan || null,
          orderData.shipping_area || null,
          normalizedPickupMethod || null,
          orderData.courier_service || null,
          orderData.shipping_notes || null,
          finalAssignedDeliverymanId,
          createdByAdminId,
          createdByAdminName,
          orderData.tipe_pesanan || 'Pesan Antar',
          finalOutletId
        ).run();
        orderInserted = true;
    } catch (insertErr) {
      const msg = insertErr?.message || String(insertErr);
      console.error('[CREATE ORDER] Insert with outlet_id failed:', msg);
      try {
        // Extra diagnostics to help pinpoint FK source
        try {
          const fkList = await env.DB.prepare("PRAGMA foreign_key_list(orders)").all();
          console.warn('[CREATE ORDER] PRAGMA foreign_key_list(orders):', fkList?.results || fkList);
        } catch (pragmaErr) {
          console.warn('[CREATE ORDER] Failed to fetch foreign_key_list pragma:', pragmaErr?.message || pragmaErr);
        }

        const looksLikeFK = /foreign key|constraint/i.test(msg);
        if (looksLikeFK) {
          console.warn('[CREATE ORDER] Retrying MINIMAL insert without any potential FK columns (outlet_id, lokasi fields, shipping_area, admin/deliveryman)...');
          await env.DB.prepare(`
            INSERT INTO orders (
              id, customer_name, customer_email, customer_phone, total_amount,
              snap_token, payment_link, payment_response, shipping_status,
              customer_address, tipe_pesanan
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
              orderId,
              customer_name,
              email,
              customerPhone || null,
              totalAmount,
              safeMidtransToken,
              safeMidtransRedirectUrl,
              safeMidtransResponse,
              'pending',
              customer_address || null,
              orderData.tipe_pesanan || 'Pesan Antar'
            ).run();
          orderInserted = true;
        } else {
          throw insertErr;
        }
      } catch (retryErr) {
        console.error('[CREATE ORDER] Retry insert without FKs also failed:', retryErr?.message || retryErr);
        throw insertErr; // keep original error context
      }
    }

    // Verify that the order row now exists before inserting order_items
    try {
      const exists = await env.DB
        .prepare('SELECT 1 as ok FROM orders WHERE id = ?')
        .bind(orderId)
        .first();
      if (!exists || !orderInserted) {
        throw new Error('[CREATE ORDER] Order row not found after insert, aborting item insertion');
      }
    } catch (verifyErr) {
      console.error('[CREATE ORDER] Post-insert verification failed:', verifyErr?.message || verifyErr);
      throw verifyErr;
    }

    // Insert order_items (FK constraints removed from schema for D1 compatibility)
    if (processedItems.length > 0) {
      try {
        console.log(`[CREATE ORDER] Inserting ${processedItems.length} items...`);
        
        // Build batch insert statements
        const insertPromises = [];
        for (const item of processedItems) {
          const unitPrice = Number(item.product_price ?? item.price);
          const qty = Number(item.quantity);
          const subtotal = unitPrice * qty;
          
          insertPromises.push(
            env.DB.prepare(
              `INSERT INTO order_items (order_id, product_name, product_price, quantity, subtotal)
               VALUES (?, ?, ?, ?, ?)`
            ).bind(orderId, item.name, unitPrice, qty, subtotal).run()
          );
        }
        
        // Execute all inserts in parallel
        await Promise.all(insertPromises);
        
        console.log(`[CREATE ORDER] Successfully inserted ${processedItems.length} items`);
      } catch (itemErr) {
        const msg = itemErr?.message || String(itemErr);
        console.error('[CREATE ORDER] Failed to insert order items:', msg);
        throw new Error(`Failed to save order items: ${msg}`);
      }
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

    // Restrict deliveryman visibility: must be assigned OR match delivery filters
    try {
      const viewer = request.user;
      if (viewer && viewer.role === 'deliveryman') {
        const isAssigned = String(order.assigned_deliveryman_id || '') === String(viewer.id || '');
        const area = String(order.shipping_area || '').toLowerCase();
        const method = String(order.pickup_method || '').toLowerCase();
        const tipe = String(order.tipe_pesanan || '').toLowerCase();
        const areaOk = area === 'dalam_kota' || area === 'dalam-kota' || area === 'dalam kota';
        const methodOk = method === 'deliveryman' || method === 'kurir toko' || method === 'kurir_toko';
        const tipeOk = tipe === 'pesan antar' || tipe === 'pesan-antar';
        const matchesDeliveryFilters = areaOk && methodOk && tipeOk;
        if (!isAssigned && !matchesDeliveryFilters) {
          return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
        }
      }
    } catch (_) {}

    // Step 2: Fetch order items
    failedQuery = 'fetching order items';
    const { results: rawItems } = await env.DB
      .prepare('SELECT * FROM order_items WHERE TRIM(order_id) = TRIM(?)')
      .bind(orderId)
      .all();

    // Map database fields to frontend-expected field names
    let items = rawItems.map(item => ({
      ...item,
      price: item.product_price // Map product_price to price for frontend compatibility
    }));

    // Fallback: for legacy orders where items might be stored as JSON
    if ((!items || items.length === 0) && order.items) {
      try {
        const rawLegacy = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        if (Array.isArray(rawLegacy)) {
          items = rawLegacy.map((it, idx) => {
            const unitPrice = Number(it.price ?? it.product_price ?? it.unit_price ?? 0);
            const qty = Number(it.quantity ?? 1);
            const subtotal = Number(it.subtotal ?? unitPrice * qty);
            return {
              id: it.id ?? idx + 1,
              order_id: orderId,
              product_name: it.product_name ?? it.name ?? '',
              product_price: unitPrice,
              quantity: qty,
              subtotal,
              price: unitPrice,
            };
          });
        }
      } catch (legacyErr) {
        console.error(`[getOrderById] Failed to parse legacy items JSON for order ${orderId}:`, legacyErr);
        // keep items as empty array in this case
      }
    }

    if (!items || items.length === 0) {
      try {
        const parsedArrays = [];

        const extraJsonFields = [order?.payment_response, order?.midtrans_response];
        for (const f of extraJsonFields) {
          if (f == null) continue;
          try {
            const obj = typeof f === 'string' ? JSON.parse(f) : f;
            if (Array.isArray(obj)) {
              parsedArrays.push(obj);
              continue;
            }
            if (obj && typeof obj === 'object') {
              if (Array.isArray(obj.items)) parsedArrays.push(obj.items);
              if (Array.isArray(obj.item_details)) parsedArrays.push(obj.item_details);
              if (Array.isArray(obj.order_items)) parsedArrays.push(obj.order_items);
            }
          } catch (_) {}
        }

        const candidates = [];
        for (const [k, v] of Object.entries(order || {})) {
          const key = String(k || '').toLowerCase();
          if (!key.includes('item')) continue;
          if (v == null) continue;
          candidates.push(v);
        }
        for (const c of candidates) {
          try {
            const obj = typeof c === 'string' ? JSON.parse(c) : c;
            if (Array.isArray(obj)) {
              parsedArrays.push(obj);
              continue;
            }
            if (obj && typeof obj === 'object') {
              if (Array.isArray(obj.items)) parsedArrays.push(obj.items);
              if (Array.isArray(obj.item_details)) parsedArrays.push(obj.item_details);
              if (Array.isArray(obj.order_items)) parsedArrays.push(obj.order_items);
            }
          } catch (_) {}
        }

        const picked = parsedArrays.find((a) => Array.isArray(a) && a.length > 0);
        if (picked && picked.length > 0) {
          items = picked.map((it, idx) => {
            const unitPrice = Number(it.price ?? it.product_price ?? it.unit_price ?? 0);
            const qty = Number(it.quantity ?? it.qty ?? 1);
            const subtotal = Number(it.subtotal ?? unitPrice * qty);
            return {
              id: it.id ?? idx + 1,
              order_id: orderId,
              product_name: it.product_name ?? it.name ?? it.title ?? '',
              product_price: unitPrice,
              quantity: qty,
              subtotal,
              price: unitPrice,
            };
          });
        }
      } catch (legacyErr2) {
        console.error(`[getOrderById] Legacy item fallback failed for order ${orderId}:`, legacyErr2);
      }
    }

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
      pickup_time: order.pickup_time || null,
      // Delivery scheduling fields
      delivery_date: order.delivery_date || null,
      delivery_time: order.delivery_time || null
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

  const makeStatusUrl = (prod) => prod
    ? `https://api.midtrans.com/v2/${orderId}/status`
    : `https://api.sandbox.midtrans.com/v2/${orderId}/status`;

  // Use Web Worker-compatible base64 (Buffer may be unavailable on Workers)
  const authHeader = `Basic ${btoa(`${serverKey}:`)}`;

  try {
    // Attempt in configured environment first, then fallback to opposite if needed
    async function fetchStatusWithFallback() {
      const firstUrl = makeStatusUrl(isProduction);
      const secondUrl = makeStatusUrl(!isProduction);
      const resp1 = await fetch(firstUrl, { method: 'GET', headers: { Accept: 'application/json', Authorization: authHeader } });
      let data1 = await resp1.json().catch(() => ({}));
      if (!resp1.ok) {
        const resp2 = await fetch(secondUrl, { method: 'GET', headers: { Accept: 'application/json', Authorization: authHeader } });
        const data2 = await resp2.json().catch(() => ({}));
        return { resp: resp2, statusData: data2 };
      }
      return { resp: resp1, statusData: data1 };
    }

    const { resp, statusData } = await fetchStatusWithFallback();
    if (!resp.ok) {
      console.error('Midtrans status check failed:', statusData);
      return { success: false, error: `Midtrans API error: ${statusData?.status_message || 'Unknown error'}` };
    }

    // Normalize values to avoid D1 undefined bind errors
    const normalizedPaymentStatus = (statusData && statusData.transaction_status)
      ? String(statusData.transaction_status)
      : null; // use null when not provided
    const paymentResponse = JSON.stringify(statusData || {});

    const updateResult = await env.DB.prepare(
      `UPDATE orders 
       SET payment_status = ?, payment_response = ?, updated_at = ?
       WHERE id = ?`
    ).bind(normalizedPaymentStatus, paymentResponse, new Date().toISOString(), orderId).run();

    if (updateResult.meta.changes > 0) {
      return { success: true, payment_status: normalizedPaymentStatus, message: 'Status updated successfully.' };
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

// GET /api/orders/:id/qris-url
// Fetch Midtrans transaction status and extract QRIS image URL from actions (generate-qr-code)
export async function getOrderQrisUrl(request, env) {
  const corsHeaders = request.corsHeaders || {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const orderId = pathParts[3]; // /api/orders/:id/qris-url
    
    console.log('🔍 QRIS URL request debug:', {
      fullPath: url.pathname,
      pathParts,
      orderId,
      expectedFormat: '/api/orders/ORDER-ID/qris-url'
    });

    if (!orderId) {
      console.error('❌ Missing order ID in QRIS URL request:', { pathname: url.pathname });
      return new Response(JSON.stringify({ success: false, error: 'Order ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const serverKey = env.MIDTRANS_SERVER_KEY;
    const isProduction = env.MIDTRANS_IS_PRODUCTION === 'true';
    if (!serverKey) {
      return new Response(JSON.stringify({ success: false, error: 'Midtrans server key not configured.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const midtransUrl = isProduction
      ? `https://api.midtrans.com/v2/${orderId}/status`
      : `https://api.sandbox.midtrans.com/v2/${orderId}/status`;

    // Use btoa for base64 encoding (Buffer is not available in CF Workers runtime)
    const authHeader = `Basic ${btoa(`${serverKey}:`)}`;

    const resp = await fetch(midtransUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: authHeader,
      },
    });

    const statusData = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const message = statusData?.status_message || 'Midtrans status error';
      return new Response(JSON.stringify({ success: false, error: message, details: statusData }), {
        status: resp.status || 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Extract QRIS image URL robustly
    let qrisUrl = null;
    try {
      const actions = Array.isArray(statusData?.actions) ? statusData.actions : [];
      const qrAction = actions.find(a => (a?.name || '').toLowerCase() === 'generate-qr-code');
      qrisUrl = qrAction?.url || null;
      // Fallbacks used by some Midtrans responses
      if (!qrisUrl && typeof statusData?.qr_code_url === 'string') qrisUrl = statusData.qr_code_url;
      if (!qrisUrl && typeof statusData?.qr_url === 'string') qrisUrl = statusData.qr_url;
      
      // Additional fallback: construct QR URL from transaction data
      if (!qrisUrl && statusData?.payment_type === 'qris' && statusData?.transaction_id) {
        // Try common Midtrans QR URL patterns
        const transactionId = statusData.transaction_id;
        qrisUrl = `https://api.midtrans.com/v2/qris/${transactionId}/qr-code`;
        console.log(`[DEBUG] Using constructed QR URL: ${qrisUrl}`);
      }
    } catch (e) {
      // ignore and fall through to not found handling
    }

    if (!qrisUrl) {
      return new Response(JSON.stringify({ success: false, error: 'QRIS URL not available for this order', data: statusData }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true, orderId, qris_url: qrisUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('[getOrderQrisUrl] Error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to fetch QRIS URL', details: String(error && error.message || error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

// Function to soft delete an order by ID
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
    if (!request.user || request.user.role !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

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

    // Admin info is already decoded by verifyToken middleware
    const deletedBy = request.user?.name || request.user?.email || request.user?.username || 'Admin';

    // Detect soft-delete columns
    const pragma = await env.DB.prepare("PRAGMA table_info('orders')").all();
    const cols = (pragma.results || []).map((r) => String(r.name || ''));
    const hasDeletedAt = cols.includes('deleted_at');
    const hasDeletedBy = cols.includes('deleted_by');

    // Ensure columns exist (safe for existing tables)
    if (!hasDeletedAt) {
      try {
        await env.DB.prepare(`ALTER TABLE orders ADD COLUMN deleted_at TEXT`).run();
      } catch (e) {
        const msg = e?.message || String(e);
        if (!/duplicate column name/i.test(msg)) throw e;
      }
    }

    if (!hasDeletedBy) {
      try {
        await env.DB.prepare(`ALTER TABLE orders ADD COLUMN deleted_by TEXT`).run();
      } catch (e) {
        const msg = e?.message || String(e);
        if (!/duplicate column name/i.test(msg)) throw e;
      }
    }

    // Check if order exists and is not already deleted
    const existingOrder = await env.DB
      .prepare(`SELECT id, customer_name, deleted_at FROM orders WHERE id = ?`)
      .bind(orderId)
      .first();

    if (!existingOrder) {
      return new Response(JSON.stringify({ success: false, error: 'Order not found' }), 
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (existingOrder.deleted_at) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Order already deleted' 
      }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    // Soft delete: Mark the order as deleted instead of removing it
    console.log(`[SOFT DELETE] Marking order as deleted: ${orderId}`);
    
    const deletedAt = new Date().toISOString();
    
    const result = await env.DB.prepare(
      `UPDATE orders SET deleted_at = ?, deleted_by = ? WHERE id = ?`
    ).bind(deletedAt, deletedBy, orderId).run();
    
    console.log(`[SOFT DELETE] Successfully soft deleted order ${orderId} by ${deletedBy}`);

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

// Function to restore a soft-deleted order
export async function restoreOrder(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const orderId = url.pathname.split('/')[3]; // /api/orders/:id/restore

    if (!orderId) {
      return new Response(JSON.stringify({ success: false, error: 'Order ID is required' }), 
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (!env.DB) {
      throw new Error('Database binding not found');
    }

    // Check if order exists and is deleted
    const existingOrder = await env.DB.prepare(
      `SELECT id, customer_name, deleted_at, deleted_by FROM orders WHERE id = ?`
    ).bind(orderId).first();

    if (!existingOrder) {
      return new Response(JSON.stringify({ success: false, error: 'Order not found' }), 
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (!existingOrder.deleted_at) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Order is not deleted' 
      }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    // Restore the order by clearing deleted_at and deleted_by
    const result = await env.DB.prepare(
      `UPDATE orders SET deleted_at = NULL, deleted_by = NULL WHERE id = ?`
    ).bind(orderId).run();
    
    console.log(`[RESTORE] Successfully restored order ${orderId}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Order successfully restored',
      orderId: orderId,
      customerName: existingOrder.customer_name,
      previouslyDeletedBy: existingOrder.deleted_by
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });

  } catch (error) {
    console.error('Restore Order Error:', error.message, error.stack);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to restore order',
      details: error.message 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders } 
    });
  }
}

// Function to get deleted orders (recycle bin)
export async function getDeletedOrders(request, env) {
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

    // Query only deleted orders
    const ordersQuery = `
      SELECT
        o.*,
        o.lokasi_pengiriman AS lokasi_pengiriman_nama,
        o.lokasi_pengambilan AS lokasi_pengambilan_nama
      FROM orders o
      WHERE o.deleted_at IS NOT NULL
      ORDER BY o.deleted_at DESC
      LIMIT ? OFFSET ?
    `;

    const orders = await env.DB.prepare(ordersQuery).bind(limit, offset).all();

    if (!orders || !orders.results) {
      return new Response(JSON.stringify({ success: false, error: 'Failed to fetch deleted orders' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Process orders similar to getAdminOrders but include deleted info
    const processedOrders = await Promise.all(orders.results.map(async order => {
      try {
        const orderItems = await env.DB.prepare(
          `SELECT product_name, product_price, quantity, subtotal FROM order_items WHERE order_id = ?`
        ).bind(order.id).all();
        
        const rawItems = orderItems?.results || [];
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

        const { pickup_outlet, ...restNoPickup } = restOfOrder;

        const calculatedTotal = items.reduce((sum, item) => {
          const unit = Number(item.price) || 0;
          const qty = Number(item.quantity) || 0;
          const sub = item.subtotal != null ? Number(item.subtotal) : (unit * qty);
          return sum + sub;
        }, 0);
        
        return {
          ...restNoPickup,
          lokasi_pengiriman: lokasi_pengiriman_nama,
          lokasi_pengambilan: lokasi_pengambilan_nama,
          items,
          payment_details: paymentDetails,
          payment_status: derivePaymentStatusFromData(order),
          total_amount: calculatedTotal || Number(order.total_amount) || 0
        };
      } catch (itemError) {
        console.error(`Error processing items for order ${order.id}:`, itemError);
        return {
          ...order,
          items: [],
          total_amount: Number(order.total_amount) || 0,
          error: 'Failed to fetch items for this order'
        };
      }
    }));

    // Count total deleted orders
    const countResult = await env.DB.prepare(
      'SELECT COUNT(*) as total FROM orders WHERE deleted_at IS NOT NULL'
    ).first();
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
    console.error('Get Deleted Orders Error:', error.message, error.stack);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to fetch deleted orders',
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
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
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
    let accessAllOutlets = false;
    if (deliveryUser?.outlet_id) {
      if (String(deliveryUser.outlet_id).toUpperCase() === 'ALL') {
        accessAllOutlets = true;
      } else {
        const outletRow = await env.DB.prepare(`
          SELECT name FROM outlets_unified WHERE id = ?
        `).bind(deliveryUser.outlet_id).first();
        outletNameForUser = outletRow?.name || null;
      }
    }

    // Build comprehensive query for deliveryman orders with strict filters
    let deliveryQuery = `
      SELECT *
      FROM orders
      WHERE 
        LOWER(COALESCE(shipping_area, '')) IN ('dalam_kota', 'dalam-kota', 'dalam kota')
        AND LOWER(COALESCE(pickup_method, '')) IN ('deliveryman', 'kurir toko', 'kurir_toko')
        AND (LOWER(COALESCE(tipe_pesanan, '')) IN ('pesan antar', 'pesan-antar') OR tipe_pesanan IS NULL OR tipe_pesanan = '')
        AND assigned_deliveryman_id = ?
    `;

    let queryParams = [deliverymanId];

    deliveryQuery += `
      ORDER BY created_at DESC`;
    
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
    const search = url.searchParams.get('search') || '';

    if (!env.DB) {
      throw new Error('Database binding not found');
    }

    // Build query with optional search and exclude deleted orders
    let ordersQuery = `
      SELECT
        o.*,
        o.lokasi_pengiriman AS lokasi_pengiriman_nama,
        o.lokasi_pengambilan AS lokasi_pengambilan_nama
      FROM orders o
      WHERE o.deleted_at IS NULL
    `;
    
    const bindings = [];
    
    if (search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      ordersQuery += `
        AND (o.id LIKE ? 
        OR o.customer_name LIKE ? 
        OR o.customer_email LIKE ?
        OR o.shipping_area LIKE ?
        OR o.lokasi_pengiriman LIKE ?
        OR o.lokasi_pengambilan LIKE ?
        OR o.pickup_method LIKE ?
        OR o.created_by_admin_name LIKE ?)
      `;
      bindings.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    ordersQuery += `
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    bindings.push(limit, offset);

    const orders = await env.DB.prepare(ordersQuery).bind(...bindings).all();

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

        // Calculate total_amount from items, fallback to database value
        const calculatedTotal = items.reduce((sum, item) => {
          const unit = Number(item.price) || 0;
          const qty = Number(item.quantity) || 0;
          const sub = item.subtotal != null ? Number(item.subtotal) : (unit * qty);
          return sum + sub;
        }, 0);
        
        return {
          ...restNoPickup,
          lokasi_pengiriman: lokasi_pengiriman_nama, // Use the name from the JOIN
          lokasi_pengambilan: lokasi_pengambilan_nama, // Use the name from the JOIN
          items,
          payment_details: paymentDetails,
          payment_status: derivePaymentStatusFromData(order),
          total_amount: calculatedTotal || Number(order.total_amount) || 0
        };
      } catch (itemError) {
        console.error(`Error processing items for order ${order.id}:`, itemError);
        return {
          ...order,
          items: [],
          total_amount: Number(order.total_amount) || 0,
          error: 'Failed to fetch items for this order'
        };
      }
    }));

    // Count total with same search filter and exclude deleted orders
    let countQuery = 'SELECT COUNT(*) as total FROM orders WHERE deleted_at IS NULL';
    const countBindings = [];
    
    if (search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      countQuery += ` AND (id LIKE ? 
        OR customer_name LIKE ? 
        OR customer_email LIKE ?
        OR shipping_area LIKE ?
        OR lokasi_pengiriman LIKE ?
        OR lokasi_pengambilan LIKE ?
        OR pickup_method LIKE ?
        OR created_by_admin_name LIKE ?)`;
      countBindings.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    const countResult = await env.DB.prepare(countQuery).bind(...countBindings).first();
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
      pickup_time,
      // Delivery scheduling fields
      delivery_date,
      delivery_time,
      // Operational FK fields (new)
      outlet_id: rawOutletId,
      assigned_deliveryman_id: rawAssignedDeliverymanId
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
        // Also clear delivery scheduling fields for pickup transitions
        updateFields.push('delivery_date = NULL');
        updateFields.push('delivery_time = NULL');
        
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
      if (courier_service !== undefined) { 
        updateFields.push('courier_service = ?'); 
        updateParams.push(courier_service);
        
        // Also update assigned_deliveryman_id when courier_service changes
        // Map courier name to deliveryman ID
        let deliverymanId = null;
        if (courier_service && courier_service.toLowerCase() === 'rudi') {
          deliverymanId = 'usr_1755672750527_49dznt';
        } else if (courier_service && courier_service.toLowerCase() === 'fendi') {
          deliverymanId = 'usr_1755672660126_bbil5p';
        }
        updateFields.push('assigned_deliveryman_id = ?');
        updateParams.push(deliverymanId);
      }
      // Delivery scheduling fields
      if (delivery_date !== undefined) { updateFields.push('delivery_date = ?'); updateParams.push(delivery_date); }
      if (delivery_time !== undefined) { updateFields.push('delivery_time = ?'); updateParams.push(delivery_time); }
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
      
      // For luar kota orders, lokasi_pengiriman should be null
      if (lokasiPengirimanName !== undefined) {
        // Determine if this is luar kota based on shipping_area (use updated value if provided, else fetch current)
        let effectiveShippingArea = shipping_area; // Use the updated shipping_area if provided
        if (effectiveShippingArea === undefined) {
          // Fetch current shipping_area from DB if not provided in update
          const currentOrder = await env.DB.prepare('SELECT shipping_area FROM orders WHERE id = ?').bind(orderId).first();
          effectiveShippingArea = currentOrder?.shipping_area || '';
        }
        const isLuarKotaOrder = (effectiveShippingArea || '').toLowerCase().includes('luar');
        const finalLokasiPengiriman = isLuarKotaOrder ? null : (lokasiPengirimanName || null);
        
        updateFields.push('lokasi_pengiriman = ?');
        updateParams.push(finalLokasiPengiriman);
        
        console.log('📦 [UPDATE ORDER] Shipping location logic:', {
          orderId,
          shipping_area: effectiveShippingArea,
          isLuarKota: isLuarKotaOrder,
          original_lokasi_pengiriman: lokasiPengirimanName,
          final_lokasi_pengiriman: finalLokasiPengiriman
        });
      }

      // Also handle the case where shipping_area is updated to luar kota but lokasi_pengiriman is not explicitly provided
      if (shipping_area !== undefined && lokasiPengirimanName === undefined) {
        const isLuarKotaOrder = (shipping_area || '').toLowerCase().includes('luar');
        if (isLuarKotaOrder) {
          updateFields.push('lokasi_pengiriman = ?');
          updateParams.push(null);
          console.log('📦 [UPDATE ORDER] Clearing lokasi_pengiriman for luar kota transition:', { orderId, shipping_area });
        }
      }

      if (lokasiPengambilanName !== undefined) {
        updateFields.push('lokasi_pengambilan = ?');
        updateParams.push(lokasiPengambilanName || null);
      }
    }

    // Operational FK fields handling with validation and safe fallbacks
    // Validate and update outlet_id if provided
    if (typeof rawOutletId !== 'undefined') {
      let finalOutletId = null;
      try {
        if (rawOutletId) {
          // Prefer legacy outlets table as FK usually references it
          const legacy = await env.DB.prepare('SELECT id FROM outlets WHERE id = ?').bind(rawOutletId).first();
          if (legacy && legacy.id) {
            finalOutletId = legacy.id;
          } else {
            // Optional diagnostic check in unified table
            let unifiedFound = false;
            try {
              const unified = await env.DB.prepare('SELECT id FROM outlets_unified WHERE id = ?').bind(rawOutletId).first();
              unifiedFound = !!unified;
            } catch (_) {}
            console.warn(`[updateOrderDetails] outlet_id ${rawOutletId} not found in outlets (legacy).` + (unifiedFound ? ' Exists in outlets_unified; FK likely references outlets. Setting NULL.' : ' Setting NULL.'));
            finalOutletId = null;
          }
        }
      } catch (outletValidateErr) {
        console.warn('[updateOrderDetails] Failed to validate outlet_id. Setting NULL. Error:', outletValidateErr?.message || outletValidateErr);
        finalOutletId = null;
      }

      // Attempt to include outlet_id in update; if schema lacks the column or FK fails, catch at execution time
      updateFields.push('outlet_id = ?');
      updateParams.push(finalOutletId);
    }

    // Validate and update assigned_deliveryman_id if provided
    // BUT: Skip if courier_service was already provided (it will auto-map assigned_deliveryman_id)
    if (typeof rawAssignedDeliverymanId !== 'undefined' && courier_service === undefined) {
      let finalAssignedId = null;
      try {
        if (rawAssignedDeliverymanId) {
          const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(rawAssignedDeliverymanId).first();
          if (user && user.id) {
            finalAssignedId = user.id; // role check optional
          } else {
            console.warn(`[updateOrderDetails] assigned_deliveryman_id ${rawAssignedDeliverymanId} not found in users. Setting NULL.`);
          }
        }
      } catch (assignedValidateErr) {
        console.warn('[updateOrderDetails] Failed to validate assigned_deliveryman_id. Setting NULL. Error:', assignedValidateErr?.message || assignedValidateErr);
        finalAssignedId = null;
      }

      updateFields.push('assigned_deliveryman_id = ?');
      updateParams.push(finalAssignedId);
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
          
          // Filter orders where:
          // 1. lokasi_pengambilan = outlet name (orders picked up from this outlet)
          // 2. OR lokasi_pengiriman = outlet name (orders delivered to this outlet's area)
          if (outletName) {
            outletCondition += `LOWER(o.lokasi_pengambilan) = LOWER('${outletName}') OR LOWER(o.lokasi_pengiriman) = LOWER('${outletName}')`;
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
