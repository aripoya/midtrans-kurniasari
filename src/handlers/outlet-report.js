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

async function ensureSoftDeleteColumns(env) {
  if (!env?.DB) return;

  try {
    const cols = await env.DB.prepare(`PRAGMA table_info('orders')`).all();
    const names = new Set((cols.results || []).map((c) => c.name));

    if (!names.has('deleted_at')) {
      try {
        await env.DB.prepare(`ALTER TABLE orders ADD COLUMN deleted_at TEXT`).run();
      } catch (e) {
        if (!e?.message?.includes('duplicate column name')) throw e;
      }
    }

    if (!names.has('deleted_by')) {
      try {
        await env.DB.prepare(`ALTER TABLE orders ADD COLUMN deleted_by TEXT`).run();
      } catch (e) {
        if (!e?.message?.includes('duplicate column name')) throw e;
      }
    }
  } catch (e) {
    console.error('[outlet-report] Failed to ensure soft delete columns:', e);
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
      AND (deleted_at IS NULL OR deleted_at = '')
      AND (outlet_id = ? OR outlet_id = ?)
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month DESC
    LIMIT 12
  `)
    .bind(
      outletId || '',
      altOutletId || ''
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
      AND (deleted_at IS NULL OR deleted_at = '')
      AND (
        outlet_id = ? OR outlet_id = ?
      )
    GROUP BY strftime('%Y-%W', created_at)
    ORDER BY week ASC
  `)
    .bind(
      monthStr,
      outletId || '',
      altOutletId || ''
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
    "(deleted_at IS NULL OR deleted_at = '')",
    "(outlet_id = ? OR outlet_id = ?)",
  ];

  const params = [
    outletId || '',
    altOutletId || '',
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
      outlet_id,
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

async function getOutletOrderItems(env, outletName, outletId, dateFrom, dateTo) {
  const altOutletId = outletId && outletId.startsWith('outlet_') && !outletId.startsWith('outlet_outlet_')
    ? `outlet_${outletId}`
    : outletId;

  const query = `
    SELECT 
      oi.id,
      oi.order_id,
      oi.product_name,
      oi.product_price as price,
      oi.quantity,
      oi.subtotal as total_price,
      o.id as order_id_check,
      o.customer_name,
      o.customer_phone,
      o.total_amount,
      o.payment_status,
      o.shipping_status,
      o.created_at
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.id
    WHERE date(o.created_at) >= date(?)
      AND date(o.created_at) <= date(?)
      AND (o.deleted_at IS NULL OR o.deleted_at = '')
      AND (o.outlet_id = ? OR o.outlet_id = ?)
    ORDER BY o.created_at DESC, oi.id ASC
  `;

  const result = await env.DB.prepare(query)
    .bind(
      dateFrom,
      dateTo,
      outletId || '',
      altOutletId || ''
    )
    .all();

  return (result.results || []).map((item) => ({
    id: item.id,
    order_id: item.order_id,
    product_name: item.product_name,
    quantity: item.quantity,
    price: item.price || 0,
    total_price: item.total_price || 0,
    order: {
      id: item.order_id,
      customer_name: item.customer_name,
      customer_phone: item.customer_phone,
      total_amount: item.total_amount,
      payment_status: item.payment_status,
      shipping_status: item.shipping_status,
      created_at: item.created_at,
    },
  }));
}

export async function getOutletReport(request, env) {
  try {
    await ensureSoftDeleteColumns(env);
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

    if (type === 'items') {
      const dateFrom = url.searchParams.get('date_from');
      const dateTo = url.searchParams.get('date_to');

      if (!dateFrom || !dateTo) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'date_from and date_to parameters are required',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...(request.corsHeaders || {}) },
          }
        );
      }

      const items = await getOutletOrderItems(env, outletName, outletId, dateFrom, dateTo);
      return new Response(
        JSON.stringify({
          success: true,
          data: items,
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
