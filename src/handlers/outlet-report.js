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

async function resolveOutletName(env, outletId) {
  if (!outletId) return '';

  let outletName = '';
  try {
    let outletInfo = await env.DB.prepare(`SELECT name FROM outlets_unified WHERE id = ?`).bind(outletId).first();

    if (!outletInfo && outletId.startsWith('outlet_') && !outletId.startsWith('outlet_outlet_')) {
      const alternateId = `outlet_${outletId}`;
      outletInfo = await env.DB.prepare(`SELECT name FROM outlets_unified WHERE id = ?`).bind(alternateId).first();
    }

    outletName = outletInfo?.name || '';

    if (!outletName) {
      outletName = outletId.replace(/^outlet_/, '').replace(/_/g, ' ');
      outletName = outletName.charAt(0).toUpperCase() + outletName.slice(1);
    }
  } catch (error) {
    outletName = outletId.replace(/^outlet_/, '').replace(/_/g, ' ');
    outletName = outletName.charAt(0).toUpperCase() + outletName.slice(1);
  }

  return outletName;
}

async function getMonthlyTrend(env, outletName, outletId) {
  const altOutletId = outletId && outletId.startsWith('outlet_') && !outletId.startsWith('outlet_outlet_')
    ? `outlet_${outletId}`
    : outletId;

  const monthlyQuery = await env.DB.prepare(`
    SELECT 
      strftime('%Y-%m', created_at) as month,
      COUNT(*) as count,
      SUM(total_amount) as revenue
    FROM orders
    WHERE date(created_at) >= date('now', '-12 months')
      AND (
        outlet_id = ?
        OR outlet_id = ?
        OR LOWER(outlet_id) LIKE LOWER(?)
        OR LOWER(outlet_id) LIKE LOWER(?)
        lokasi_pengambilan = ?
        OR lokasi_pengambilan = ?
        OR LOWER(lokasi_pengambilan) LIKE LOWER(?)
        OR LOWER(lokasi_pengambilan) LIKE LOWER(?)
        OR LOWER(lokasi_pengiriman) LIKE LOWER(?)
        OR LOWER(lokasi_pengiriman) LIKE LOWER(?)
      )
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month DESC
  `)
    .bind(
      outletId || '',
      altOutletId || '',
      `%${outletId || ''}%`,
      `%${altOutletId || ''}%`,
      outletName,
      outletId || '',
      `%${outletName}%`,
      `%${outletId || ''}%`,
      `%${outletName}%`,
      `%${outletId || ''}%`
    )
    .all();

  return (monthlyQuery.results || []).map((row) => ({
    month: row.month,
    count: row.count,
    revenue: row.revenue || 0,
    revenue_formatted: formatRupiah(row.revenue || 0),
  }));
}

async function getWeeklyBreakdown(env, outletName, outletId, year, month) {
  const altOutletId = outletId && outletId.startsWith('outlet_') && !outletId.startsWith('outlet_outlet_')
    ? `outlet_${outletId}`
    : outletId;

  const monthStr = `${year}-${month.toString().padStart(2, '0')}`;

  const weeklyQuery = await env.DB.prepare(`
    SELECT 
      strftime('%Y-%W', created_at) as week,
      COUNT(*) as count,
      SUM(total_amount) as revenue,
      MIN(date(created_at)) as week_start,
      MAX(date(created_at)) as week_end
    FROM orders
    WHERE strftime('%Y-%m', created_at) = ?
      AND (
        outlet_id = ?
        OR outlet_id = ?
        OR LOWER(outlet_id) LIKE LOWER(?)
        OR LOWER(outlet_id) LIKE LOWER(?)
        lokasi_pengambilan = ?
        OR lokasi_pengambilan = ?
        OR LOWER(lokasi_pengambilan) LIKE LOWER(?)
        OR LOWER(lokasi_pengambilan) LIKE LOWER(?)
        OR LOWER(lokasi_pengiriman) LIKE LOWER(?)
        OR LOWER(lokasi_pengiriman) LIKE LOWER(?)
      )
    GROUP BY strftime('%Y-%W', created_at)
    ORDER BY week ASC
  `)
    .bind(
      monthStr,
      outletId || '',
      altOutletId || '',
      `%${outletId || ''}%`,
      `%${altOutletId || ''}%`,
      outletName,
      outletId || '',
      `%${outletName}%`,
      `%${outletId || ''}%`,
      `%${outletName}%`,
      `%${outletId || ''}%`
    )
    .all();

  return (weeklyQuery.results || []).map((row) => ({
    week: row.week,
    week_start: row.week_start,
    week_end: row.week_end,
    count: row.count,
    revenue: row.revenue || 0,
    revenue_formatted: formatRupiah(row.revenue || 0),
  }));
}

async function getOutletOrders(env, outletName, outletId, options = {}) {
  const {
    offset = 0,
    limit = 50,
    payment_status = null,
    shipping_status = null,
    date_from = null,
    date_to = null,
    search = null,
  } = options;

  const altOutletId = outletId && outletId.startsWith('outlet_') && !outletId.startsWith('outlet_outlet_')
    ? `outlet_${outletId}`
    : outletId;

  let conditions = [
    `(
      outlet_id = ?
      OR outlet_id = ?
      OR LOWER(outlet_id) LIKE LOWER(?)
      OR LOWER(outlet_id) LIKE LOWER(?)
      lokasi_pengambilan = ?
      OR lokasi_pengambilan = ?
      OR LOWER(lokasi_pengambilan) LIKE LOWER(?)
      OR LOWER(lokasi_pengambilan) LIKE LOWER(?)
      OR LOWER(lokasi_pengiriman) LIKE LOWER(?)
      OR LOWER(lokasi_pengiriman) LIKE LOWER(?)
    )`,
  ];

  const params = [
    outletId || '',
    altOutletId || '',
    `%${outletId || ''}%`,
    `%${altOutletId || ''}%`,
    outletName,
    outletId || '',
    `%${outletName}%`,
    `%${outletId || ''}%`,
    `%${outletName}%`,
    `%${outletId || ''}%`,
  ];

  if (payment_status) {
    conditions.push('payment_status = ?');
    params.push(payment_status);
  }

  if (shipping_status) {
    conditions.push('shipping_status = ?');
    params.push(shipping_status);
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
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern);
  }

  const whereClause = conditions.join(' AND ');

  const countQuery = `SELECT COUNT(*) as total FROM orders WHERE ${whereClause}`;
  const countResult = await env.DB.prepare(countQuery).bind(...params).first();
  const total = countResult?.total || 0;

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
      pickup_method,
      courier_service,
      lokasi_pengambilan,
      lokasi_pengiriman,
      created_at,
      updated_at
    FROM orders
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;

  const ordersResult = await env.DB.prepare(ordersQuery).bind(...params, limit, offset).all();

  return {
    orders: (ordersResult.results || []).map((order) => ({
      ...order,
      total_amount_formatted: formatRupiah(order.total_amount),
    })),
    total,
    offset,
    limit,
    has_more: offset + limit < total,
  };
}

export async function getOutletReport(request, env) {
  try {
    const url = new URL(request.url);
    const type = (url.searchParams.get('type') || 'monthly').trim().toLowerCase();

    if (!request.user || request.user.role !== 'outlet_manager') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Outlet manager access required',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...(request.corsHeaders || {}) },
        }
      );
    }

    const outletId = request.user.outlet_id || '';
    const outletName = await resolveOutletName(env, outletId);

    if (!outletName) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Outlet tidak ditemukan',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...(request.corsHeaders || {}) },
        }
      );
    }

    if (type === 'weekly') {
      const year = url.searchParams.get('year');
      const month = url.searchParams.get('month');

      if (!year || !month) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Year and month parameters are required',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...(request.corsHeaders || {}) },
          }
        );
      }

      const weeklyData = await getWeeklyBreakdown(env, outletName, outletId, parseInt(year), parseInt(month));
      return new Response(
        JSON.stringify({
          success: true,
          data: weeklyData,
          year: parseInt(year),
          month: parseInt(month),
          outlet: outletName,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...(request.corsHeaders || {}) },
        }
      );
    }

    if (type === 'orders') {
      const options = {
        offset: parseInt(url.searchParams.get('offset') || '0'),
        limit: parseInt(url.searchParams.get('limit') || '50'),
        payment_status: url.searchParams.get('payment_status'),
        shipping_status: url.searchParams.get('shipping_status'),
        date_from: url.searchParams.get('date_from'),
        date_to: url.searchParams.get('date_to'),
        search: url.searchParams.get('search'),
      };

      const result = await getOutletOrders(env, outletName, outletId, options);
      return new Response(
        JSON.stringify({
          success: true,
          outlet: outletName,
          ...result,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...(request.corsHeaders || {}) },
        }
      );
    }

    if (type === 'monthly' || type === 'stats') {
      const monthlyTrend = await getMonthlyTrend(env, outletName, outletId);
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            monthly_trend: monthlyTrend,
          },
          outlet: outletName,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...(request.corsHeaders || {}) },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid type parameter. Use "monthly", "weekly", or "orders"',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...(request.corsHeaders || {}) },
      }
    );
  } catch (error) {
    console.error('❌ Error in outlet report handler:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to generate outlet report',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...(request.corsHeaders || {}) },
      }
    );
  }
}
