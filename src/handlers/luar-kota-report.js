/**
 * Luar Kota Orders Report Handler
 * Provides comprehensive statistics and list of orders for luar kota shipments
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
 * Get weekly breakdown for a specific month
 */
async function getWeeklyBreakdown(env, year, month) {
  try {
    const monthStr = `${year}-${month.toString().padStart(2, '0')}`;

    const weeklyQuery = await env.DB.prepare(`
      SELECT 
        strftime('%Y-%W', created_at) as week,
        strftime('%d', created_at) as day_start,
        COUNT(*) as count,
        SUM(total_amount) as revenue,
        MIN(date(created_at)) as week_start,
        MAX(date(created_at)) as week_end
      FROM orders
      WHERE shipping_area = 'luar-kota'
        AND strftime('%Y-%m', created_at) = ?
      GROUP BY strftime('%Y-%W', created_at)
      ORDER BY week ASC
    `).bind(monthStr).all();

    return (weeklyQuery.results || []).map(row => ({
      week: row.week,
      week_start: row.week_start,
      week_end: row.week_end,
      count: row.count,
      revenue: row.revenue || 0,
      revenue_formatted: formatRupiah(row.revenue || 0)
    }));
  } catch (error) {
    console.error('❌ Error getting weekly breakdown:', error);
    throw error;
  }
}

/**
 * Get statistics for luar kota orders
 */
async function getLuarKotaStats(env) {
  try {
    // Total orders and revenue
    const totalQuery = await env.DB.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount) as total_revenue
      FROM orders
      WHERE shipping_area = 'luar-kota'
    `).first();

    // Orders by payment status
    const paymentStatusQuery = await env.DB.prepare(`
      SELECT 
        payment_status,
        COUNT(*) as count,
        SUM(total_amount) as revenue
      FROM orders
      WHERE shipping_area = 'luar-kota'
      GROUP BY payment_status
    `).all();

    // Orders by shipping status
    const shippingStatusQuery = await env.DB.prepare(`
      SELECT 
        shipping_status,
        COUNT(*) as count
      FROM orders
      WHERE shipping_area = 'luar-kota'
      GROUP BY shipping_status
    `).all();

    // Orders by courier service
    const courierQuery = await env.DB.prepare(`
      SELECT 
        courier_service,
        COUNT(*) as count,
        SUM(total_amount) as revenue
      FROM orders
      WHERE shipping_area = 'luar-kota'
        AND courier_service IS NOT NULL
      GROUP BY courier_service
    `).all();

    // Monthly trend (last 12 months)
    const monthlyQuery = await env.DB.prepare(`
      SELECT 
        strftime('%Y-%m', created_at) as month,
        COUNT(*) as count,
        SUM(total_amount) as revenue
      FROM orders
      WHERE shipping_area = 'luar-kota'
        AND date(created_at) >= date('now', '-12 months')
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
      by_courier: (courierQuery.results || []).map(row => ({
        courier: row.courier_service,
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
    console.error('❌ Error getting luar kota stats:', error);
    throw error;
  }
}

/**
 * Get list of luar kota orders with pagination
 */
async function getLuarKotaOrders(env, options = {}) {
  const {
    offset = 0,
    limit = 50,
    payment_status = null,
    shipping_status = null,
    courier_service = null,
    date_from = null,
    date_to = null,
    search = null
  } = options;

  try {
    // Build WHERE conditions
    let conditions = ["shipping_area = 'luar-kota'"];
    let params = [];

    if (payment_status) {
      conditions.push('payment_status = ?');
      params.push(payment_status);
    }

    if (shipping_status) {
      conditions.push('shipping_status = ?');
      params.push(shipping_status);
    }

    if (courier_service) {
      conditions.push('courier_service = ?');
      params.push(courier_service);
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
        courier_service,
        tracking_number,
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
    console.error('❌ Error getting luar kota orders:', error);
    throw error;
  }
}

/**
 * Main handler for luar kota report endpoint
 */
export async function getLuarKotaReport(request, env) {
  try {
    const url = new URL(request.url);
    const type = (url.searchParams.get('type') || 'stats').trim().toLowerCase(); // 'stats', 'orders', or 'weekly'

    if (type === 'weekly') {
      const year = url.searchParams.get('year');
      const month = url.searchParams.get('month');
      if (!year || !month) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Year and month parameters are required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...(request.corsHeaders || {}) }
        });
      }

      const weeklyData = await getWeeklyBreakdown(env, parseInt(year), parseInt(month));
      return new Response(JSON.stringify({
        success: true,
        data: weeklyData,
        year: parseInt(year),
        month: parseInt(month)
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...(request.corsHeaders || {}) }
      });
    }

    if (type === 'stats') {
      // Return statistics
      const stats = await getLuarKotaStats(env);
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
        courier_service: url.searchParams.get('courier_service'),
        date_from: url.searchParams.get('date_from'),
        date_to: url.searchParams.get('date_to'),
        search: url.searchParams.get('search')
      };

      const result = await getLuarKotaOrders(env, options);
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
        error: 'Invalid type parameter. Use "stats", "orders", or "weekly"'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...(request.corsHeaders || {}) }
      });
    }
  } catch (error) {
    console.error('❌ Error in luar kota report handler:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to generate luar kota report'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...(request.corsHeaders || {}) }
    });
  }
}
