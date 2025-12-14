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

function validateSqlIsSelectOnly(sql) {
    const raw = (sql || '').trim();
    const lower = raw.toLowerCase();

    if (!raw) return { ok: false, reason: 'SQL kosong' };
    if (!lower.startsWith('select')) return { ok: false, reason: 'Hanya SELECT yang diperbolehkan' };
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
3. Untuk intent "query", WAJIB sertakan SQL yang valid untuk SQLite
4. Gunakan LIKE dengan % untuk pencarian nama (case-insensitive)
5. Format tanggal di database: YYYY-MM-DD
6. Batasi hasil dengan LIMIT 20 jika tidak disebutkan
7. Jangan gunakan JOIN kecuali benar-benar diperlukan
8. Saat query dari tabel orders, selalu tambahkan filter: (deleted_at IS NULL OR deleted_at = '')

Contoh:
- "pesanan hari ini" → SELECT * FROM orders WHERE DATE(created_at) = DATE('now') LIMIT 20
- "cari pesanan Budi" → SELECT * FROM orders WHERE customer_name LIKE '%Budi%' LIMIT 20
- "total penjualan bulan ini" → SELECT SUM(total_amount) as total FROM orders WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
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
                message: aiResponse.response,
                data: null
            }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Step 2: Jika intent adalah query, execute SQL
        if (parsedResponse.intent === 'query' && parsedResponse.sql) {
            try {
                let sql = String(parsedResponse.sql || '').trim();
                sql = addSoftDeleteFilterForOrders(sql);
                sql = addDefaultLimit(sql);

                const validation = validateSqlIsSelectOnly(sql);
                if (!validation.ok) {
                    return new Response(JSON.stringify({
                        intent: 'error',
                        message: `Query tidak diizinkan. ${validation.reason}.`,
                        sql,
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
                    sql,
                    data: result.results,
                    count: result.results?.length || 0
                }), {
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });

            } catch (dbError) {
                return new Response(JSON.stringify({
                    intent: 'error',
                    message: `Error menjalankan query: ${dbError.message}`,
                    sql: String(parsedResponse.sql || '').trim(),
                    data: null
                }), {
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }
        }

        // Return response untuk intent non-query
        return new Response(JSON.stringify({
            intent: parsedResponse.intent || 'info',
            message: parsedResponse.explanation || aiResponse.response,
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
