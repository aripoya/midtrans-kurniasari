/**
 * Revenue Statistics Handler
 * Provides revenue data for charts and analytics
 */

export async function getRevenueStats(request, env) {
  try {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || 'monthly'; // 'monthly' or 'weekly'
    
    let revenueData;
    
    if (period === 'monthly') {
      // Get last 12 months revenue
      revenueData = await getMonthlyRevenue(env);
    } else if (period === 'weekly') {
      // Get last 8 weeks revenue
      revenueData = await getWeeklyRevenue(env);
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid period parameter. Use "monthly" or "weekly"'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...(request.corsHeaders || {}) }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      data: revenueData
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...(request.corsHeaders || {}) }
    });
    
  } catch (error) {
    console.error('Error getting revenue stats:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to get revenue statistics'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...(request.corsHeaders || {}) }
    });
  }
}

/**
 * Get monthly revenue for last 12 months
 */
async function getMonthlyRevenue(env) {
  const query = `
    SELECT 
      strftime('%Y-%m', created_at) as month,
      COUNT(*) as order_count,
      SUM(total_amount) as revenue
    FROM orders
    WHERE payment_status = 'settlement'
      AND is_deleted = 0
      AND date(created_at) >= date('now', '-12 months')
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month ASC
  `;
  
  const result = await env.DB.prepare(query).all();
  
  // Format data for chart
  return (result.results || []).map(row => ({
    period: formatMonthLabel(row.month),
    revenue: row.revenue || 0,
    orders: row.order_count || 0,
    month: row.month
  }));
}

/**
 * Get weekly revenue for last 8 weeks
 */
async function getWeeklyRevenue(env) {
  const query = `
    SELECT 
      strftime('%Y-W%W', created_at) as week,
      COUNT(*) as order_count,
      SUM(total_amount) as revenue,
      MIN(date(created_at)) as week_start,
      MAX(date(created_at)) as week_end
    FROM orders
    WHERE payment_status = 'settlement'
      AND is_deleted = 0
      AND date(created_at) >= date('now', '-56 days')
    GROUP BY strftime('%Y-W%W', created_at)
    ORDER BY week ASC
  `;
  
  const result = await env.DB.prepare(query).all();
  
  // Format data for chart
  return (result.results || []).map(row => ({
    period: formatWeekLabel(row.week_start, row.week_end),
    revenue: row.revenue || 0,
    orders: row.order_count || 0,
    week: row.week
  }));
}

/**
 * Format month label (e.g., "2025-01" -> "Jan 2025")
 */
function formatMonthLabel(monthStr) {
  const [year, month] = monthStr.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}

/**
 * Format week label (e.g., "2025-01-01" to "2025-01-07" -> "1-7 Jan")
 */
function formatWeekLabel(startDate, endDate) {
  if (!startDate || !endDate) return 'N/A';
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
  const startDay = start.getDate();
  const endDay = end.getDate();
  const month = monthNames[start.getMonth()];
  
  return `${startDay}-${endDay} ${month}`;
}
