/**
 * Dalam Kota Orders Report Handler
 * Provides comprehensive statistics and list of orders for dalam kota shipments
 */

/**
 * Format rupiah currency
 */
function formatRupiah(amount) {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount || 0);
  } catch {
    return `Rp ${Number(amount || 0).toLocaleString('id-ID')}`;
  }
}

/**
 * Get statistics for dalam kota orders
 */
async function getDalamKotaStats(env) {
  try {
    // Total orders and revenue
    const totalQuery = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount) as total_revenue
      FROM orders
      WHERE shipping_area = 'dalam-kota'
    `).first();

    // Orders by payment status
    const paymentStatusQuery = await env.DB.prepare(`
      SELECT 
        payment_status,
        COUNT(*) as count,
        SUM(total_amount) as revenue
      FROM orders
      WHERE shipping_area = 'dalam-kota'
      GROUP BY payment_status
    `).all();

    // Orders by shipping status
    const shippingStatusQuery = await env.DB.prepare(`
      SELECT 
        shipping_status,
        COUNT(*) as count
      FROM orders
      WHERE shipping_area = 'dalam-kota'
      GROUP BY shipping_status
    `).all();

    // Orders by delivery method (Ambil Sendiri vs Kurir Toko)
    const deliveryMethodQuery = await env.DB.prepare(`
      SELECT 
        delivery_method,
        COUNT(*) as count,
        SUM(total_amount) as revenue
      FROM orders
      WHERE shipping_area = 'dalam-kota'
        AND delivery_method IS NOT NULL
      GROUP BY delivery_method
    `).all();

    // Monthly trend (last 6 months)
    const monthlyQuery = await env.DB.prepare(`
      SELECT 
        strftime('%Y-%m', created_at) as month,
        COUNT(*) as count,
        SUM(total_amount) as revenue
      FROM orders
      WHERE shipping_area = 'dalam-kota'
        AND date(created_at) >= date('now', '-6 months')
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month DESC
    `).all();

    return {
      total: {
        orders: totalQuery?.total_orders || 0,
        revenue: totalQuery?.total_revenue || 0,
        revenue_formatted: formatRupiah(totalQuery?.total_revenue || 0)
      },
      by_payment_status: (paymentStatusQuery.results || []).map(row => ({
        status: row.payment_status,
        count: row.count,
        revenue: row.revenue || 0,
        revenue_formatted: formatRupiah(row.revenue || 0)
      })),
      by_shipping_status: (shippingStatusQuery.results || []).map(row => ({
        status: row.shipping_status,
        count: row.count
      })),
      by_delivery_method: (deliveryMethodQuery.results || []).map(row => ({
        method: row.delivery_method,
        count: row.count,
        revenue: row.revenue || 0,
        revenue_formatted: formatRupiah(row.revenue || 0)
      })),
      monthly_trend: (monthlyQuery.results || []).map(row => ({
        month: row.month,
        count: row.count,
        revenue: row.revenue || 0,
        revenue_formatted: formatRupiah(row.revenue || 0)
      }))
    };
  } catch (error) {
    console.error('❌ Error getting dalam kota stats:', error);
    throw error;
  }
}

/**
 * Get list of dalam kota orders with pagination
 */
async function getDalamKotaOrders(env, options = {}) {
  const {
    offset = 0,
    limit = 50,
    payment_status = null,
    shipping_status = null,
    delivery_method = null,
    date_from = null,
    date_to = null,
    search = null
  } = options;

  try {
    // Build WHERE conditions
    let conditions = ["shipping_area = 'dalam-kota'"];
    let params = [];

    if (payment_status) {
      conditions.push('payment_status = ?');
      params.push(payment_status);
    }

    if (shipping_status) {
      conditions.push('shipping_status = ?');
      params.push(shipping_status);
    }

    if (delivery_method) {
      conditions.push('delivery_method = ?');
      params.push(delivery_method);
    }

    if (date_from) {
      conditions.push('date(created_at) >= date(?)');
      params.push(date_from);
    }

    if (date_to) {
      conditions.push('date(created_at) <= date(?)');
      params.push(date_to);
    }

    if (search) {
      conditions.push('(customer_name LIKE ? OR id LIKE ? OR customer_phone LIKE ?)');
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM orders WHERE ${whereClause}`;
    const countResult = await env.DB.prepare(countQuery).bind(...params).first();
    const total = countResult?.total || 0;

    // Get orders
    const ordersQuery = `
      SELECT 
        id,
        customer_name,
        customer_phone,
        customer_address,
        customer_email,
        total_amount,
        payment_status,
        shipping_status,
        delivery_method,
        courier_name,
        lokasi_pengambilan,
        lokasi_pengiriman,
        pickup_method,
        created_at,
        updated_at
      FROM orders
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const ordersResult = await env.DB.prepare(ordersQuery)
      .bind(...params, limit, offset)
      .all();

    return {
      orders: (ordersResult.results || []).map(order => ({
        ...order,
        total_amount_formatted: formatRupiah(order.total_amount)
      })),
      total,
      offset,
      limit,
      has_more: (offset + limit) < total
    };
  } catch (error) {
    console.error('❌ Error getting dalam kota orders:', error);
    throw error;
  }
}

/**
 * Main handler for dalam kota report endpoint
 */
export async function getDalamKotaReport(request, env) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'stats'; // 'stats' or 'orders'

    if (type === 'stats') {
      // Return statistics
      const stats = await getDalamKotaStats(env);
      return new Response(JSON.stringify({
        success: true,
        data: stats
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...(request.corsHeaders || {}) }
      });
    } else if (type === 'orders') {
      // Return orders list
      const options = {
        offset: parseInt(url.searchParams.get('offset') || '0'),
        limit: parseInt(url.searchParams.get('limit') || '50'),
        payment_status: url.searchParams.get('payment_status'),
        shipping_status: url.searchParams.get('shipping_status'),
        delivery_method: url.searchParams.get('delivery_method'),
        date_from: url.searchParams.get('date_from'),
        date_to: url.searchParams.get('date_to'),
        search: url.searchParams.get('search')
      };

      const result = await getDalamKotaOrders(env, options);
      return new Response(JSON.stringify({
        success: true,
        ...result
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...(request.corsHeaders || {}) }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid type parameter. Use "stats" or "orders"'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...(request.corsHeaders || {}) }
      });
    }
  } catch (error) {
    console.error('❌ Error in dalam kota report handler:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to generate dalam kota report'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...(request.corsHeaders || {}) }
    });
  }
}
