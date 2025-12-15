// AI Chat Handler - Natural Language Query untuk Admin
// Menggunakan Cloudflare Workers AI

import { requireAdmin } from './middleware.js';

const DB_SCHEMA = `
Tabel orders:
- id (TEXT): ID pesanan
- customer_name, customer_phone, customer_email, customer_address: Info pelanggan
- total_amount (REAL): Total harga
- order_status: Status pesanan (pending, processing, completed, cancelled)
- payment_status: Status bayar (pending, paid, failed)
- shipping_status: Status kirim
- shipping_area, pickup_method, tipe_pesanan: Info pengiriman
- tracking_number, courier_service: Info kurir
- lokasi_pengiriman, lokasi_pengambilan: Lokasi
- pickup_date, pickup_time, delivery_date, delivery_time: Jadwal
- created_by_admin_name, outlet_id: Admin & outlet
- created_at, updated_at: Timestamp

Tabel order_items:
- order_id (TEXT): Referensi ke orders.id
- product_name, product_price, quantity, subtotal: Detail item

Tabel users:
- id, username, name, role, outlet_id, email

Tabel products:
- id, name, price
`;

function addDefaultLimit(sql) {
    let out = (sql || '').trim();
    if (!out) return out;

    const limitRegex = /\blimit\s+(\d+)\b/i;
    const m = out.match(limitRegex);

    if (!m) {
        out = `${out} LIMIT 20`;
        return out;
    }

    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) {
        return out.replace(limitRegex, 'LIMIT 20');
    }

    if (n > 50) {
        return out.replace(limitRegex, 'LIMIT 50');
    }

    return out;
}

function formatMonthYearMmYyyy(value) {
    const s = String(value || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})$/);
    if (!m) return value;
    return `${m[2]}-${m[1]}`;
}

function formatDateDdMmYyyy(value) {
    const s = String(value || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/);
    if (!m) return value;
    return `${m[3]}-${m[2]}-${m[1]}`;
}

function formatDatesInRow(row) {
    if (!row || typeof row !== 'object') return row;
    const out = Array.isArray(row) ? [] : {};
    for (const [k, v] of Object.entries(row)) {
        if (typeof v === 'string') {
            const trimmed = v.trim();
            const monthYear = trimmed.match(/^(\d{4})-(\d{2})$/);
            const dateLike = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/);
            if (dateLike) {
                out[k] = formatDateDdMmYyyy(trimmed);
            } else if (monthYear) {
                out[k] = formatMonthYearMmYyyy(trimmed);
            } else {
                out[k] = v;
            }
        } else {
            out[k] = v;
        }
    }
    return out;
}

function formatDatesDeep(data) {
    if (data == null) return data;
    if (Array.isArray(data)) return data.map((x) => formatDatesDeep(x));
    if (typeof data === 'object') {
        // If it's a plain row object, format its values, and recurse for nested objects
        const formattedRow = formatDatesInRow(data);
        for (const [k, v] of Object.entries(formattedRow)) {
            if (v && (Array.isArray(v) || typeof v === 'object')) {
                formattedRow[k] = formatDatesDeep(v);
            }
        }
        return formattedRow;
    }
    return data;
}

function formatDatesInText(text) {
    if (text == null) return text;
    const s = String(text);
    // Format full dates first (YYYY-MM-DD -> DD-MM-YYYY)
    const withDates = s.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_, y, m, d) => `${d}-${m}-${y}`);
    // Then format month periods (YYYY-MM -> MM-YYYY)
    return withDates.replace(/\b(\d{4})-(\d{2})\b/g, (_, y, m) => `${m}-${y}`);
}

function extractAiText(aiResponse) {
    if (aiResponse == null) return '';
    if (typeof aiResponse === 'string') return aiResponse;
    if (typeof aiResponse?.response === 'string') return aiResponse.response;
    const choiceContent = aiResponse?.choices?.[0]?.message?.content;
    if (typeof choiceContent === 'string') return choiceContent;
    const outputText = aiResponse?.result?.response;
    if (typeof outputText === 'string') return outputText;
    try {
        return JSON.stringify(aiResponse);
    } catch {
        return String(aiResponse);
    }
}

function isDuplicateOrdersQuestion(text) {
    const t = String(text || '').toLowerCase();
    return (
        t.includes('pesanan') &&
        (t.includes('detail') || t.includes('item')) &&
        (t.includes('sama') || t.includes('duplikat') || t.includes('kembar')) &&
        (t.includes('hari') || t.includes('tanggal'))
    );
}

function buildDuplicateOrdersSql() {
    // Find groups of orders created on the same day with identical order_items details.
    // Uses a stable item signature per order via an ordered subquery + GROUP_CONCAT.
    return `WITH item_sigs AS (
  SELECT order_id,
         GROUP_CONCAT(item_sig, '||') AS sig
  FROM (
    SELECT order_id,
           printf('%s:%s:%s:%s',
             COALESCE(product_name,''),
             COALESCE(product_price,''),
             COALESCE(quantity,''),
             COALESCE(subtotal,'')
           ) AS item_sig
    FROM order_items
    ORDER BY order_id, product_name, product_price, quantity, subtotal
  )
  GROUP BY order_id
), order_with_sig AS (
  SELECT o.id AS order_id,
         DATE(o.created_at) AS order_date,
         s.sig AS sig
  FROM orders o
  JOIN item_sigs s ON s.order_id = o.id
  WHERE (o.deleted_at IS NULL OR o.deleted_at = '')
)
SELECT order_date,
       sig AS detail_signature,
       COUNT(*) AS orders_count,
       GROUP_CONCAT(order_id, ', ') AS order_ids
FROM order_with_sig
GROUP BY order_date, sig
HAVING COUNT(*) >= 2
ORDER BY order_date DESC, orders_count DESC
LIMIT 20`;
}

function isMonthlyRevenueQuestion(text) {
    const t = String(text || '').toLowerCase();
    if (!(t.includes('pendapatan') || t.includes('penjualan') || t.includes('revenue'))) return false;
    return t.includes('bulan');
}

function isWeeklyRevenueQuestion(text) {
    const t = String(text || '').toLowerCase();
    if (!(t.includes('pendapatan') || t.includes('penjualan') || t.includes('revenue'))) return false;
    return t.includes('minggu') || t.includes('pekan') || t.includes('week');
}

function isTotalRevenueToDateQuestion(text) {
    const t = String(text || '').toLowerCase();
    const isRevenue = t.includes('pendapatan') || t.includes('penjualan') || t.includes('revenue');
    if (!isRevenue) return false;

    return (
        t.includes('hingga hari ini') ||
        t.includes('sampai hari ini') ||
        t.includes('hingga sekarang') ||
        t.includes('sampai sekarang') ||
        t.includes('to date') ||
        t.includes('s/d hari ini')
    );
}

function isAmbiguousTotalRevenueQuestion(text) {
    const t = String(text || '').toLowerCase();
    const isRevenue = t.includes('pendapatan') || t.includes('penjualan') || t.includes('revenue');
    if (!isRevenue) return false;

    // We only want very short/ambiguous “total revenue” questions with no explicit period.
    const asksTotal = t.includes('total');
    if (!asksTotal) return false;

    const hasExplicitPeriod =
        t.includes('bulan') ||
        t.includes('minggu') ||
        t.includes('pekan') ||
        t.includes('hari ini') ||
        t.includes('hingga') ||
        t.includes('sampai') ||
        t.includes('to date') ||
        t.includes('mtd') ||
        t.includes('wtd');

    const isAverageLike =
        t.includes('rata-rata') ||
        t.includes('rata rata') ||
        t.includes('avg') ||
        t.includes('average') ||
        t.includes('per hari') ||
        t.includes('perhari') ||
        t.includes('per-hari') ||
        t.includes('harian');

    return asksTotal && !hasExplicitPeriod && !isAverageLike;
}

function hasLuarKotaKeyword(text) {
    const t = String(text || '').toLowerCase();
    return t.includes('luar kota') || t.includes('luarkota') || t.includes('luar-kota') || t.includes('luar_kota');
}

function isAverageDailyRevenueQuestion(text) {
    const t = String(text || '').toLowerCase();
    const isRevenue = t.includes('pendapatan') || t.includes('penjualan') || t.includes('revenue');
    const isAverage = t.includes('rata-rata') || t.includes('rata rata') || t.includes('average') || t.includes('avg');
    const isPerDay =
        t.includes('per hari') ||
        t.includes('perhari') ||
        t.includes('per-hari') ||
        t.includes('harian') ||
        t.includes('per day') ||
        t.includes('daily');
    // Accept questions that omit the word 'pendapatan' but clearly ask for daily average within a month context
    const isMonthlyContext = t.includes('bulan') && /\b(20\d{2})\b/.test(t);
    return (isRevenue && isAverage && isPerDay) || (isAverage && isPerDay && isMonthlyContext);
}

function parseAverageDailyRange(text) {
    const t = String(text || '').toLowerCase();

    // Rounding: default 2 decimals (to match dashboard card that shows ,33 etc)
    let roundDigits = 2;
    if (t.includes('dua digit') || t.includes('2 digit') || t.includes('2-digit') || t.includes('2 angka')) {
        roundDigits = 2;
    }

    const parsedMonth = parseMonthYearFromText(text);
    if (parsedMonth && t.includes('bulan')) {
        return { kind: 'specific_month', ym: parsedMonth.ym, roundDigits };
    }

    if (t.includes('bulan ini') || t.includes('month to date') || t.includes('mtd')) {
        return { kind: 'month_to_date', roundDigits };
    }
    if (t.includes('minggu ini') || t.includes('pekan ini') || t.includes('week to date') || t.includes('wtd')) {
        return { kind: 'week_to_date', roundDigits };
    }

    const mDays = t.match(/\b(\d{1,3})\s*hari\b/);
    if (mDays) {
        const n = Number(mDays[1]);
        if (Number.isFinite(n) && n > 0 && n <= 3660) {
            return { kind: 'last_n_days', nDays: n, roundDigits };
        }
    }

    if (t.includes('hingga sekarang') || t.includes('sampai sekarang') || t.includes('sejak awal') || t.includes('dari awal')) {
        return { kind: 'all_time', roundDigits };
    }

    // Default: last 30 days
    return { kind: 'last_n_days', nDays: 30, roundDigits };
}

function buildTotalRevenueToDateSql() {
    const paidFilter = "LOWER(COALESCE(payment_status, '')) IN ('settlement','paid','capture','success','dibayar')";
    const notDeleted = "(deleted_at IS NULL OR deleted_at = '')";

    return `SELECT
  COALESCE(SUM(total_amount),0) AS total,
  COUNT(*) AS order_count,
  MIN(date(created_at)) AS start_date,
  date('now') AS end_date
FROM orders
WHERE ${paidFilter}
  AND ${notDeleted}
  AND date(created_at) <= date('now')`;
}

function buildAverageDailyRevenueSql(range) {
    const paidFilter = "LOWER(COALESCE(payment_status, '')) IN ('settlement','paid','capture','success','dibayar')";
    const notDeleted = "(deleted_at IS NULL OR deleted_at = '')";
    const roundDigits = Number.isFinite(range?.roundDigits) ? range.roundDigits : 0;

    let startExpr;
    let endExpr = "date('now')";
    if (range?.kind === 'specific_month' && range?.ym) {
        const ym = String(range.ym);
        // If month is current month => end at today (MTD), otherwise end at last day of that month
        startExpr = `date('${ym}-01')`;
        endExpr = `(CASE WHEN strftime('%Y-%m','now') = '${ym}' THEN date('now') ELSE date('${ym}-01','+1 month','-1 day') END)`;
    } else
    if (range?.kind === 'month_to_date') {
        startExpr = "date('now','start of month')";
    } else if (range?.kind === 'week_to_date') {
        // Monday as start of week
        startExpr = "date('now','weekday 1','-7 days')";
    } else if (range?.kind === 'last_n_days') {
        const n = Math.max(1, Number(range?.nDays || 30));
        const offset = n - 1;
        startExpr = `date('now','-${offset} days')`;
    } else {
        // all_time: start from earliest paid order date
        startExpr = `(
  SELECT MIN(date(created_at))
  FROM orders
  WHERE ${paidFilter}
    AND ${notDeleted}
)`;
    }

    return `WITH bounds AS (
  SELECT
    COALESCE(${startExpr}, date('now')) AS start_date,
    ${endExpr} AS end_date
), paid_orders AS (
  SELECT date(created_at) AS d,
         total_amount AS amount
  FROM orders, bounds
  WHERE date(created_at) >= bounds.start_date
    AND date(created_at) <= bounds.end_date
    AND ${paidFilter}
    AND ${notDeleted}
), agg AS (
  SELECT
    COALESCE(SUM(amount),0) AS total_paid,
    COUNT(*) AS orders_paid,
    COUNT(DISTINCT d) AS active_days,
    (SELECT start_date FROM bounds) AS start_date,
    (SELECT end_date FROM bounds) AS end_date
  FROM paid_orders
), days AS (
  SELECT
    total_paid,
    orders_paid,
    active_days,
    start_date,
    end_date,
    (CAST(julianday(end_date) - julianday(start_date) AS INTEGER) + 1) AS calendar_days
  FROM agg
)
SELECT
  total_paid,
  orders_paid,
  active_days,
  calendar_days,
  CASE WHEN calendar_days > 0 THEN ROUND(total_paid * 1.0 / calendar_days, ${roundDigits}) ELSE 0 END AS avg_per_calendar_day,
  CASE WHEN active_days > 0 THEN ROUND(total_paid * 1.0 / active_days, ${roundDigits}) ELSE 0 END AS avg_per_active_day,
  start_date,
  end_date
FROM days
LIMIT 1`;
}

function isAnalysisQuestion(text) {
    const t = String(text || '').toLowerCase();
    return (
        t.includes('analisis') ||
        t.includes('analisa') ||
        t.includes('ringkas') ||
        t.includes('insight')
    );
}

function buildAnalysisQueries() {
    const paidFilter = "LOWER(COALESCE(payment_status, '')) IN ('settlement','paid','capture','success','dibayar')";
    const notDeleted = "(deleted_at IS NULL OR deleted_at = '')";

    return {
        summary: `SELECT
  (SELECT COUNT(*) FROM orders WHERE date(created_at) >= date('now','-29 days') AND ${notDeleted}) AS orders_30d,
  (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE date(created_at) >= date('now','-29 days') AND ${paidFilter} AND ${notDeleted}) AS revenue_30d_paid,
  (SELECT COUNT(*) FROM orders WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m','now') AND ${notDeleted}) AS orders_mtd,
  (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m','now') AND ${paidFilter} AND ${notDeleted}) AS revenue_mtd_paid,
  (SELECT COUNT(*) FROM orders WHERE date(created_at) = date('now') AND ${notDeleted}) AS orders_today,
  (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE date(created_at) = date('now') AND ${paidFilter} AND ${notDeleted}) AS revenue_today_paid
LIMIT 1`,

        trendDaily30d: `SELECT
  DATE(created_at) AS day,
  COUNT(*) AS orders,
  COALESCE(SUM(CASE WHEN ${paidFilter} THEN total_amount ELSE 0 END),0) AS revenue_paid
FROM orders
WHERE date(created_at) >= date('now','-29 days')
  AND ${notDeleted}
GROUP BY DATE(created_at)
ORDER BY day DESC
LIMIT 30`,

        operationalPayment: `SELECT
  LOWER(COALESCE(payment_status,'')) AS payment_status,
  COUNT(*) AS count
FROM orders
WHERE date(created_at) >= date('now','-29 days')
  AND ${notDeleted}
GROUP BY LOWER(COALESCE(payment_status,''))
ORDER BY count DESC
LIMIT 20`,

        operationalShipping: `SELECT
  LOWER(COALESCE(shipping_status,'')) AS shipping_status,
  COUNT(*) AS count
FROM orders
WHERE date(created_at) >= date('now','-29 days')
  AND ${notDeleted}
GROUP BY LOWER(COALESCE(shipping_status,''))
ORDER BY count DESC
LIMIT 20`,

        shippedNotPaid: `SELECT
  id,
  customer_name,
  total_amount,
  payment_status,
  shipping_status,
  created_at
FROM orders
WHERE date(created_at) >= date('now','-29 days')
  AND ${notDeleted}
  AND LOWER(COALESCE(shipping_status,'')) IN ('dikirim','dalam pengiriman','diterima','delivered','shipped','in transit')
  AND NOT (${paidFilter})
ORDER BY created_at DESC
LIMIT 20`,

        topCustomers: `SELECT
  COALESCE(NULLIF(TRIM(customer_name),''),'(tanpa nama)') AS customer,
  COUNT(*) AS orders,
  COALESCE(SUM(total_amount),0) AS revenue_paid
FROM orders
WHERE date(created_at) >= date('now','-29 days')
  AND ${paidFilter}
  AND ${notDeleted}
GROUP BY COALESCE(NULLIF(TRIM(customer_name),''),'(tanpa nama)')
ORDER BY revenue_paid DESC
LIMIT 10`,

        topProducts: `SELECT
  COALESCE(NULLIF(TRIM(oi.product_name),''),'(tanpa nama)') AS product,
  COALESCE(SUM(oi.quantity),0) AS qty,
  COALESCE(SUM(oi.subtotal),0) AS revenue
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE date(o.created_at) >= date('now','-29 days')
  AND ${paidFilter}
  AND ${notDeleted}
GROUP BY COALESCE(NULLIF(TRIM(oi.product_name),''),'(tanpa nama)')
ORDER BY revenue DESC
LIMIT 10`,

        highValueOrders: `SELECT
  id,
  customer_name,
  total_amount,
  payment_status,
  shipping_status,
  created_at
FROM orders
WHERE date(created_at) >= date('now','-29 days')
  AND ${notDeleted}
ORDER BY total_amount DESC
LIMIT 10`,

        duplicateOrders30d: `WITH recent_orders AS (
  SELECT id
  FROM orders
  WHERE date(created_at) >= date('now','-29 days')
    AND ${notDeleted}
), item_sigs AS (
  SELECT order_id,
         GROUP_CONCAT(item_sig, '||') AS sig
  FROM (
    SELECT order_id,
           printf('%s:%s:%s:%s',
             COALESCE(product_name,''),
             COALESCE(product_price,''),
             COALESCE(quantity,''),
             COALESCE(subtotal,'')
           ) AS item_sig
    FROM order_items
    WHERE order_id IN (SELECT id FROM recent_orders)
    ORDER BY order_id, product_name, product_price, quantity, subtotal
  )
  GROUP BY order_id
), order_with_sig AS (
  SELECT o.id AS order_id,
         DATE(o.created_at) AS order_date,
         s.sig AS sig
  FROM orders o
  JOIN item_sigs s ON s.order_id = o.id
  WHERE o.id IN (SELECT id FROM recent_orders)
)
SELECT order_date,
       sig AS detail_signature,
       COUNT(*) AS orders_count,
       GROUP_CONCAT(order_id, ', ') AS order_ids
FROM order_with_sig
GROUP BY order_date, sig
HAVING COUNT(*) >= 2
ORDER BY order_date DESC, orders_count DESC
LIMIT 20`,
    };
}

function parseMonthYearFromText(text) {
    const t = String(text || '').toLowerCase();
    const monthMap = {
        januari: '01',
        february: '02',
        februari: '02',
        maret: '03',
        march: '03',
        april: '04',
        mei: '05',
        may: '05',
        juni: '06',
        june: '06',
        juli: '07',
        july: '07',
        agustus: '08',
        august: '08',
        september: '09',
        oktober: '10',
        october: '10',
        november: '11',
        desember: '12',
        december: '12',
    };

    let month = null;
    for (const [k, v] of Object.entries(monthMap)) {
        if (t.includes(k)) {
            month = v;
            break;
        }
    }

    if (!month) {
        const m = t.match(/\bbulan\s+(\d{1,2})\b/);
        if (m) {
            const n = Number(m[1]);
            if (Number.isFinite(n) && n >= 1 && n <= 12) {
                month = String(n).padStart(2, '0');
            }
        }
    }

    const y = t.match(/\b(20\d{2})\b/);
    const year = y ? y[1] : String(new Date().getFullYear());

    if (!month) return null;
    return { year, month, ym: `${year}-${month}` };
}

function buildMonthlyRevenueSql(ym) {
    return `SELECT COALESCE(SUM(total_amount), 0) AS total
FROM orders
WHERE strftime('%Y-%m', created_at) = '${ym}'
  AND LOWER(COALESCE(payment_status, '')) IN ('settlement','paid','capture','success','dibayar')
  AND (deleted_at IS NULL OR deleted_at = '')
LIMIT 1`;
}

function buildMonthlyRevenueLuarKotaAllSql(ym) {
    return `SELECT COALESCE(SUM(total_amount), 0) AS total
FROM orders
WHERE strftime('%Y-%m', created_at) = '${ym}'
  AND shipping_area = 'luar-kota'
  AND (deleted_at IS NULL OR deleted_at = '')
LIMIT 1`;
}

function buildMonthlyRevenueLuarKotaPaidSql(ym) {
    return `SELECT COALESCE(SUM(total_amount), 0) AS total
FROM orders
WHERE strftime('%Y-%m', created_at) = '${ym}'
  AND shipping_area = 'luar-kota'
  AND LOWER(COALESCE(payment_status, '')) IN ('settlement','paid','capture','success','dibayar')
  AND (deleted_at IS NULL OR deleted_at = '')
LIMIT 1`;
}

function buildWeeklyRevenueSql() {
    const paidFilter = "LOWER(COALESCE(payment_status, '')) IN ('settlement','paid','capture','success','dibayar')";
    return `WITH bounds AS (
  SELECT
    date('now','weekday 1','-7 days') AS start_date,
    date('now','weekday 1','-7 days','+7 days') AS end_date
)
SELECT
  COALESCE(SUM(total_amount), 0) AS total,
  COUNT(*) AS order_count,
  (SELECT start_date FROM bounds) AS start_date,
  date((SELECT end_date FROM bounds),'-1 day') AS end_date
FROM orders, bounds
WHERE date(created_at) >= bounds.start_date
  AND date(created_at) < bounds.end_date
  AND ${paidFilter}
  AND (deleted_at IS NULL OR deleted_at = '')
LIMIT 1`;
}

function addSoftDeleteFilterForOrders(sql) {
    let out = (sql || '').trim();
    if (!out) return out;

    const lower = out.toLowerCase();
    if (!/\bfrom\s+orders\b/i.test(out)) return out;
    if (lower.includes('deleted_at')) return out;

    const orderByIndex = lower.lastIndexOf(' order by ');
    const groupByIndex = lower.lastIndexOf(' group by ');
    const limitIndex = lower.lastIndexOf(' limit ');
    const insertIndexCandidates = [
        orderByIndex,
        groupByIndex,
        limitIndex,
    ].filter((i) => i >= 0);

    const insertIndex = insertIndexCandidates.length
        ? Math.min(...insertIndexCandidates)
        : out.length;

    const head = out.slice(0, insertIndex).trimEnd();
    const tail = out.slice(insertIndex);

    if (/\bwhere\b/i.test(head)) {
        return `${head} AND (deleted_at IS NULL OR deleted_at = '')${tail}`;
    }

    return `${head} WHERE (deleted_at IS NULL OR deleted_at = '')${tail}`;
}

function normalizeSoftDeleteFilterForOrders(sql) {
    let out = (sql || '').trim();
    if (!out) return out;
    if (!/\bfrom\s+orders\b/i.test(out)) return out;

    // Ensure the soft-delete clause is always parenthesized to avoid AND/OR precedence bugs
    out = out.replace(
        /\bwhere\s+deleted_at\s+is\s+null\s+or\s+deleted_at\s*=\s*''/gi,
        "WHERE (deleted_at IS NULL OR deleted_at = '')"
    );
    out = out.replace(
        /\band\s+deleted_at\s+is\s+null\s+or\s+deleted_at\s*=\s*''/gi,
        "AND (deleted_at IS NULL OR deleted_at = '')"
    );
    out = out.replace(
        /\bor\s+deleted_at\s+is\s+null\s+or\s+deleted_at\s*=\s*''/gi,
        "OR (deleted_at IS NULL OR deleted_at = '')"
    );

    return out;
}

function validateSqlIsSelectOnly(sql) {
    const raw = (sql || '').trim();
    const lower = raw.toLowerCase();

    if (!raw) return { ok: false, reason: 'SQL kosong' };
    if (!lower.startsWith('select') && !lower.startsWith('with')) {
        return { ok: false, reason: 'Hanya SELECT yang diperbolehkan' };
    }
    if (raw.includes(';')) return { ok: false, reason: 'Query tidak boleh mengandung ;' };

    const forbidden = [
        'drop',
        'delete',
        'update',
        'insert',
        'alter',
        'truncate',
        'pragma',
        'attach',
        'detach',
        'vacuum',
        'reindex',
        'create',
        'replace',
    ];
    for (const kw of forbidden) {
        const re = new RegExp(`\\b${kw}\\b`, 'i');
        if (re.test(raw)) {
            return { ok: false, reason: `Keyword tidak diizinkan: ${kw}` };
        }
    }

    if (lower.includes('sqlite_master')) {
        return { ok: false, reason: 'Akses metadata sqlite_master tidak diizinkan' };
    }

    return { ok: true };
}

const SYSTEM_PROMPT = `Kamu adalah AI Assistant untuk sistem manajemen pesanan Kurnia Sari.
Tugasmu adalah membantu admin mencari dan menganalisis data pesanan.

${DB_SCHEMA}

INSTRUKSI PENTING:
1. Ketika admin bertanya tentang data, generate SQL query yang sesuai
2. Response dalam format JSON dengan struktur:
   {"intent": "query|info|greeting", "sql": "SELECT ...", "explanation": "penjelasan singkat"}
2b. Output WAJIB HANYA JSON (tanpa markdown, tanpa code block, tanpa penjelasan tambahan di luar JSON)
3. Untuk intent "query", WAJIB sertakan SQL yang valid untuk SQLite
4. Gunakan LIKE dengan % untuk pencarian nama (case-insensitive)
5. Format tanggal di database: YYYY-MM-DD
6. Batasi hasil dengan LIMIT 20 jika tidak disebutkan
7. Jangan gunakan JOIN kecuali benar-benar diperlukan
8. Saat query dari tabel orders, selalu tambahkan filter: (deleted_at IS NULL OR deleted_at = '')
   (WAJIB pakai tanda kurung kalau digabung dengan kondisi lain memakai AND/OR)

CATATAN PENTING:
- Kolom primary key tabel orders adalah "id" (bukan order_id). order_items memakai order_id yang mereferensi orders.id.

Contoh:
- "pesanan hari ini" → SELECT * FROM orders WHERE DATE(created_at) = DATE('now') LIMIT 20
- "cari pesanan Budi" → SELECT * FROM orders WHERE customer_name LIKE '%Budi%' LIMIT 20
- "total penjualan bulan ini" → SELECT SUM(total_amount) as total FROM orders WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now') AND (deleted_at IS NULL OR deleted_at = '')
`;

export async function handleAiChat(request, env) {
    try {
        const corsHeaders = request.corsHeaders || {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma, expires',
            'Access-Control-Allow-Credentials': 'true',
        };

        const adminCheck = requireAdmin(request);
        if (!adminCheck.success) {
            return new Response(JSON.stringify({ success: false, message: adminCheck.message }), {
                status: adminCheck.status,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        let body;
        try {
            body = await request.json();
        } catch {
            body = {};
        }

        const { message } = body;
        
        if (!message) {
            return new Response(JSON.stringify({ error: 'Message is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Ambiguous short revenue question like: "Total pendapatan?" -> default to total revenue to date (paid-only)
        if (isAmbiguousTotalRevenueQuestion(message)) {
            const sql = buildTotalRevenueToDateSql();
            const validation = validateSqlIsSelectOnly(sql);
            if (!validation.ok) {
                return new Response(JSON.stringify({
                    intent: 'error',
                    message: `Query tidak diizinkan. ${validation.reason}.`,
                    data: null
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }

            const result = await env.DB.prepare(sql).all();
            const row = result.results?.[0] || {};

            const total = row.total ?? 0;
            const orderCount = row.order_count ?? 0;
            const startDate = row.start_date ? formatDateDdMmYyyy(row.start_date) : row.start_date;
            const endDate = row.end_date ? formatDateDdMmYyyy(row.end_date) : row.end_date;
            const range = startDate && endDate ? `${startDate} s/d ${endDate}` : 'hingga hari ini';

            return new Response(JSON.stringify({
                intent: 'query',
                message: formatDatesInText(
                    `Pertanyaan kamu belum menyebut periode. Aku pakai default: hingga hari ini (${range}). ` +
                    `Total pendapatan adalah ${total} dari ${orderCount} pesanan (paid-only).`
                ),
                data: formatDatesDeep([{ total, order_count: orderCount, start_date: startDate, end_date: endDate }]),
                count: 1
            }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Deterministic analysis mode (A-D)
        if (isAnalysisQuestion(message)) {
            const q = buildAnalysisQueries();
            const entries = Object.entries(q);
            for (const [, sql] of entries) {
                const validation = validateSqlIsSelectOnly(sql);
                if (!validation.ok) {
                    return new Response(JSON.stringify({
                        intent: 'error',
                        message: `Query tidak diizinkan. ${validation.reason}.`,
                        data: null
                    }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json', ...corsHeaders }
                    });
                }
            }

            const results = await Promise.all(entries.map(([, sql]) => env.DB.prepare(sql).all()));
            const byKey = Object.fromEntries(entries.map(([k], idx) => [k, formatDatesDeep(results[idx]?.results || [])]));

            const sections = [
                { key: 'summary', title: 'A. Ringkasan 30 hari / bulan ini / hari ini (paid-only)', rows: byKey.summary },
                { key: 'trendDaily30d', title: 'A. Tren harian 30 hari terakhir', rows: byKey.trendDaily30d },
                { key: 'operationalPayment', title: 'B. Operasional: status pembayaran (30 hari)', rows: byKey.operationalPayment },
                { key: 'operationalShipping', title: 'B. Operasional: status pengiriman (30 hari)', rows: byKey.operationalShipping },
                { key: 'shippedNotPaid', title: 'B. Perlu perhatian: sudah dikirim tapi belum paid (30 hari)', rows: byKey.shippedNotPaid },
                { key: 'topCustomers', title: 'C. Top customer (paid, 30 hari)', rows: byKey.topCustomers },
                { key: 'topProducts', title: 'C. Top produk (paid, 30 hari)', rows: byKey.topProducts },
                { key: 'highValueOrders', title: 'D. Anomali: order bernilai besar (30 hari)', rows: byKey.highValueOrders },
                { key: 'duplicateOrders30d', title: 'D. Anomali: kemungkinan order duplikat (detail item sama, 30 hari)', rows: byKey.duplicateOrders30d },
            ];

            return new Response(JSON.stringify({
                intent: 'analysis',
                message: formatDatesInText('Berikut analisis A–D berdasarkan data 30 hari terakhir (dengan revenue paid-only).'),
                data: { sections },
                count: sections.length
            }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Deterministic handling for common complex question to avoid LLM SQL mistakes
        if (isDuplicateOrdersQuestion(message)) {
            const sql = buildDuplicateOrdersSql();
            const validation = validateSqlIsSelectOnly(sql);
            if (!validation.ok) {
                return new Response(JSON.stringify({
                    intent: 'error',
                    message: `Query tidak diizinkan. ${validation.reason}.`,
                    data: null
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }

            const result = await env.DB.prepare(sql).all();
            return new Response(JSON.stringify({
                intent: 'query',
                message: formatDatesInText('Berikut daftar grup pesanan yang memiliki detail item identik pada hari yang sama:'),
                data: formatDatesDeep(result.results),
                count: result.results?.length || 0
            }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Deterministic weekly revenue (paid-only) to match dashboard definition
        if (isWeeklyRevenueQuestion(message)) {
            const sql = buildWeeklyRevenueSql();
            const validation = validateSqlIsSelectOnly(sql);
            if (!validation.ok) {
                return new Response(JSON.stringify({
                    intent: 'error',
                    message: `Query tidak diizinkan. ${validation.reason}.`,
                    data: null
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }

            const result = await env.DB.prepare(sql).all();
            const row = result.results?.[0] || {};
            const total = row.total ?? 0;
            const orderCount = row.order_count ?? 0;
            const startDate = row.start_date ? formatDateDdMmYyyy(row.start_date) : row.start_date;
            const endDate = row.end_date ? formatDateDdMmYyyy(row.end_date) : row.end_date;
            const range = startDate && endDate ? `${startDate} s/d ${endDate}` : 'minggu ini';
            return new Response(JSON.stringify({
                intent: 'query',
                message: formatDatesInText(`Total pendapatan minggu ini (${range}) adalah ${total} dari ${orderCount} pesanan (paid-only).`),
                data: formatDatesDeep([{ total, order_count: orderCount, start_date: startDate, end_date: endDate }]),
                count: 1
            }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        if (isTotalRevenueToDateQuestion(message)) {
            const sql = buildTotalRevenueToDateSql();
            const validation = validateSqlIsSelectOnly(sql);
            if (!validation.ok) {
                return new Response(JSON.stringify({
                    intent: 'error',
                    message: `Query tidak diizinkan. ${validation.reason}.`,
                    data: null
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }

            const result = await env.DB.prepare(sql).all();
            const row = result.results?.[0] || {};

            const total = row.total ?? 0;
            const orderCount = row.order_count ?? 0;
            const startDate = row.start_date ? formatDateDdMmYyyy(row.start_date) : row.start_date;
            const endDate = row.end_date ? formatDateDdMmYyyy(row.end_date) : row.end_date;
            const range = startDate && endDate ? `${startDate} s/d ${endDate}` : 'hingga hari ini';

            return new Response(JSON.stringify({
                intent: 'query',
                message: formatDatesInText(`Total pendapatan hingga hari ini (${range}) adalah ${total} dari ${orderCount} pesanan (paid-only).`),
                data: formatDatesDeep([{ total, order_count: orderCount, start_date: startDate, end_date: endDate }]),
                count: 1
            }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Deterministic average daily revenue (paid-only)
        if (isAverageDailyRevenueQuestion(message)) {
            const range = parseAverageDailyRange(message);
            const sql = buildAverageDailyRevenueSql(range);
            const validation = validateSqlIsSelectOnly(sql);
            if (!validation.ok) {
                return new Response(JSON.stringify({
                    intent: 'error',
                    message: `Query tidak diizinkan. ${validation.reason}.`,
                    data: null
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }

            const result = await env.DB.prepare(sql).all();
            const row = result.results?.[0] || {};

            const startDate = row.start_date ? formatDateDdMmYyyy(row.start_date) : row.start_date;
            const endDate = row.end_date ? formatDateDdMmYyyy(row.end_date) : row.end_date;
            const rangeLabel = startDate && endDate ? `${startDate} s/d ${endDate}` : 'rentang dipilih';

            const totalPaid = row.total_paid ?? 0;
            const ordersPaid = row.orders_paid ?? 0;
            const activeDays = row.active_days ?? 0;
            const calendarDays = row.calendar_days ?? 0;
            const avgCalendar = row.avg_per_calendar_day ?? 0;
            const avgActive = row.avg_per_active_day ?? 0;

            return new Response(JSON.stringify({
                intent: 'query',
                message: formatDatesInText(
                    `Rata-rata pendapatan per hari (${rangeLabel}) (paid-only):\n` +
                    `- Total paid: ${totalPaid} (dari ${ordersPaid} pesanan)\n` +
                    `- Rata-rata per hari kalender (${calendarDays} hari): ${avgCalendar}\n` +
                    `- Rata-rata per hari ada transaksi (${activeDays} hari): ${avgActive}`
                ),
                data: formatDatesDeep([
                    {
                        range_kind: range?.kind,
                        total_paid: totalPaid,
                        orders_paid: ordersPaid,
                        calendar_days: calendarDays,
                        active_days: activeDays,
                        avg_per_calendar_day: avgCalendar,
                        avg_per_active_day: avgActive,
                        start_date: startDate,
                        end_date: endDate,
                    }
                ]),
                count: 1
            }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Deterministic monthly revenue so result is always numeric (0 when no orders)
        if (isMonthlyRevenueQuestion(message)) {
            const parsed = parseMonthYearFromText(message);
            if (parsed) {
                if (hasLuarKotaKeyword(message)) {
                    const sqlAll = buildMonthlyRevenueLuarKotaAllSql(parsed.ym);
                    const sqlPaid = buildMonthlyRevenueLuarKotaPaidSql(parsed.ym);

                    const v1 = validateSqlIsSelectOnly(sqlAll);
                    if (!v1.ok) {
                        return new Response(JSON.stringify({
                            intent: 'error',
                            message: `Query tidak diizinkan. ${v1.reason}.`,
                            data: null
                        }), {
                            status: 400,
                            headers: { 'Content-Type': 'application/json', ...corsHeaders }
                        });
                    }
                    const v2 = validateSqlIsSelectOnly(sqlPaid);
                    if (!v2.ok) {
                        return new Response(JSON.stringify({
                            intent: 'error',
                            message: `Query tidak diizinkan. ${v2.reason}.`,
                            data: null
                        }), {
                            status: 400,
                            headers: { 'Content-Type': 'application/json', ...corsHeaders }
                        });
                    }

                    const [rAll, rPaid] = await Promise.all([
                        env.DB.prepare(sqlAll).all(),
                        env.DB.prepare(sqlPaid).all(),
                    ]);

                    const totalAll = rAll.results?.[0]?.total ?? 0;
                    const totalPaid = rPaid.results?.[0]?.total ?? 0;
                    const ymLabel = formatMonthYearMmYyyy(parsed.ym);

                    return new Response(JSON.stringify({
                        intent: 'query',
                        message: formatDatesInText(`Pendapatan luar kota bulan ${ymLabel}: total (semua status pembayaran) ${totalAll}; paid-only ${totalPaid}.`),
                        data: formatDatesDeep([{ total_all: totalAll, total_paid: totalPaid, month: ymLabel, shipping_area: 'luar-kota' }]),
                        count: 1
                    }), {
                        headers: { 'Content-Type': 'application/json', ...corsHeaders }
                    });
                }

                const sql = buildMonthlyRevenueSql(parsed.ym);
                const validation = validateSqlIsSelectOnly(sql);
                if (!validation.ok) {
                    return new Response(JSON.stringify({
                        intent: 'error',
                        message: `Query tidak diizinkan. ${validation.reason}.`,
                        data: null
                    }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json', ...corsHeaders }
                    });
                }

                const result = await env.DB.prepare(sql).all();
                const total = result.results?.[0]?.total ?? 0;
                const ymLabel = formatMonthYearMmYyyy(parsed.ym);
                return new Response(JSON.stringify({
                    intent: 'query',
                    message: formatDatesInText(`Total pendapatan bulan ${ymLabel} adalah ${total}`),
                    data: formatDatesDeep([{ total }]),
                    count: 1
                }), {
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }
        }

        if (!env?.AI) {
            return new Response(JSON.stringify({
                success: false,
                intent: 'error',
                message: 'Workers AI binding (env.AI) belum dikonfigurasi di Worker',
                data: null
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Step 1: Gunakan AI untuk parse intent dan generate SQL
        const aiResponse = await env.AI.run('@cf/qwen/qwen3-30b-a3b-fp8', {
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: message }
            ],
            max_tokens: 500
        });

        let parsedResponse;
        try {
            const aiText = extractAiText(aiResponse);
            // Extract JSON from AI response
            const jsonMatch = aiText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsedResponse = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseError) {
            // Fallback jika AI tidak return JSON valid
            return new Response(JSON.stringify({
                intent: 'info',
                message: 'Maaf, AI tidak dapat memproses pertanyaan ini. Coba tulis ulang dengan lebih spesifik.',
                data: null
            }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Step 2: Jika intent adalah query, execute SQL
        if (parsedResponse.intent === 'query' && parsedResponse.sql) {
            try {
                let sql = String(parsedResponse.sql || '').trim();
                sql = normalizeSoftDeleteFilterForOrders(sql);
                sql = addSoftDeleteFilterForOrders(sql);
                sql = addDefaultLimit(sql);

                const validation = validateSqlIsSelectOnly(sql);
                if (!validation.ok) {
                    return new Response(JSON.stringify({
                        intent: 'error',
                        message: `Query tidak diizinkan. ${validation.reason}.`,
                        data: null
                    }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json', ...corsHeaders }
                    });
                }

                // Execute query
                const result = await env.DB.prepare(sql).all();

                const responseMessage = formatDatesInText(parsedResponse.explanation || 'Berikut hasil pencarian:');
                
                return new Response(JSON.stringify({
                    intent: 'query',
                    message: responseMessage,
                    data: formatDatesDeep(result.results),
                    count: result.results?.length || 0
                }), {
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });

            } catch (dbError) {
                return new Response(JSON.stringify({
                    intent: 'error',
                    message: `Error menjalankan query: ${dbError.message}`,
                    data: null
                }), {
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }
        }

        // Return response untuk intent non-query
        const nonQueryMessage = formatDatesInText(parsedResponse.explanation || parsedResponse.message || 'OK');
        return new Response(JSON.stringify({
            intent: parsedResponse.intent || 'info',
            message: nonQueryMessage,
            data: null
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

    } catch (error) {
        return new Response(JSON.stringify({
            intent: 'error',
            message: `Error: ${error.message}`,
            data: null
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...(request.corsHeaders || {}) }
        });
    }
}
