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

function hasLuarKotaKeyword(text) {
    const t = String(text || '').toLowerCase();
    return t.includes('luar kota') || t.includes('luarkota') || t.includes('luar-kota') || t.includes('luar_kota');
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
            const byKey = Object.fromEntries(entries.map(([k], idx) => [k, results[idx]?.results || []]));

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
                message: 'Berikut analisis A–D berdasarkan data 30 hari terakhir (dengan revenue paid-only).',
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
                message: 'Berikut daftar grup pesanan yang memiliki detail item identik pada hari yang sama:',
                data: result.results,
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
            const startDate = row.start_date;
            const endDate = row.end_date;
            const range = startDate && endDate ? `${startDate} s/d ${endDate}` : 'minggu ini';
            return new Response(JSON.stringify({
                intent: 'query',
                message: `Total pendapatan minggu ini (${range}) adalah ${total} dari ${orderCount} pesanan (paid-only).`,
                data: [{ total, order_count: orderCount, start_date: startDate, end_date: endDate }],
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

                    return new Response(JSON.stringify({
                        intent: 'query',
                        message: `Pendapatan luar kota bulan ${parsed.ym}: total (semua status pembayaran) ${totalAll}; paid-only ${totalPaid}.`,
                        data: [{ total_all: totalAll, total_paid: totalPaid, month: parsed.ym, shipping_area: 'luar-kota' }],
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
                return new Response(JSON.stringify({
                    intent: 'query',
                    message: `Total pendapatan bulan ${parsed.ym} adalah ${total}`,
                    data: [{ total }],
                    count: 1
                }), {
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }
        }

        // Step 1: Gunakan AI untuk parse intent dan generate SQL
        const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: message }
            ],
            max_tokens: 500
        });

        let parsedResponse;
        try {
            // Extract JSON from AI response
            const jsonMatch = aiResponse.response.match(/\{[\s\S]*\}/);
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
                
                return new Response(JSON.stringify({
                    intent: 'query',
                    message: parsedResponse.explanation || 'Berikut hasil pencarian:',
                    data: result.results,
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
        return new Response(JSON.stringify({
            intent: parsedResponse.intent || 'info',
            message: parsedResponse.explanation || parsedResponse.message || 'OK',
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
