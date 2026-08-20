// Midtrans Core API payment routing.
//
// Small orders are charged as QRIS the moment the order is created, so the buyer
// only has to scan. Orders above the ceiling are left uncharged until a bank is
// picked, because a Virtual Account number can only be issued per bank.
//
// Core API charges a transaction against our own order id, and Midtrans refuses a
// second charge for an order id it already knows (HTTP 406). That makes a charge a
// one-shot action per order - see chargeOrderPayment() for how we stay idempotent.

import { derivePaymentStatusFromData, normalizeTransactionStatus } from '../utils/payment-status.js';

// Totals up to and including this amount are paid with QRIS, above it with a VA.
export const QRIS_MAX_AMOUNT = 500000;

// "GoPay Dynamic QRIS" is the QRIS acquirer active on the Midtrans dashboard.
const QRIS_ACQUIRER = 'gopay';

// How long a buyer has to pay. Without this, QRIS via GoPay expires after only
// 15 minutes, which is far too short for an order someone pays later in the day.
// Midtrans accepts custom_expiry for every payment type except credit card;
// GoPay QRIS caps it at 7 days, so a single day is well inside the limit.
// order_time is left out on purpose - Midtrans then counts from the charge itself.
const PAYMENT_EXPIRY = { expiry_duration: 1, unit: 'day' };

// Mirrors the active payment methods on the Midtrans dashboard. Set `active` to
// false for a method Midtrans has not approved (or has suspended) for us yet.
export const VA_BANKS = [
  { code: 'bca', name: 'BCA', label: 'BCA Virtual Account', paymentType: 'bank_transfer', active: true },
  { code: 'bni', name: 'BNI', label: 'BNI Virtual Account', paymentType: 'bank_transfer', active: true },
  { code: 'bri', name: 'BRI', label: 'BRI Virtual Account', paymentType: 'bank_transfer', active: true },
  { code: 'cimb', name: 'CIMB Niaga', label: 'CIMB Niaga Virtual Account', paymentType: 'bank_transfer', active: true },
  { code: 'permata', name: 'PermataBank', label: 'Permata Virtual Account', paymentType: 'bank_transfer', active: true },
  { code: 'mandiri', name: 'Bank Mandiri', label: 'Mandiri Bill Payment', paymentType: 'echannel', active: true },
];

/**
 * Does this total require the buyer to pick a bank first?
 */
export function needsBankSelection(totalAmount) {
  return Number(totalAmount) > QRIS_MAX_AMOUNT;
}

/**
 * Banks offered in the selection UI, in dashboard order.
 */
export function getActiveVaBanks() {
  return VA_BANKS.filter(bank => bank.active).map(({ code, name, label }) => ({ code, name, label }));
}

export function findActiveBank(code) {
  const wanted = String(code || '').trim().toLowerCase();
  return VA_BANKS.find(bank => bank.active && bank.code === wanted) || null;
}

function chargeUrl(env) {
  return env.MIDTRANS_IS_PRODUCTION === 'true'
    ? 'https://api.midtrans.com/v2/charge'
    : 'https://api.sandbox.midtrans.com/v2/charge';
}

/**
 * Build the Core API charge body for an order.
 * @param {object} order - { orderId, totalAmount, customerName, email, phone, items }
 * @param {object|null} bank - entry from VA_BANKS, or null to charge QRIS
 */
export function buildChargePayload(order, bank) {
  const { orderId, totalAmount, customerName, email, phone, items } = order;

  const payload = {
    transaction_details: {
      order_id: orderId,
      gross_amount: Number(totalAmount),
    },
    customer_details: {
      first_name: customerName || '',
      email: email || '',
      phone: phone || '',
    },
    custom_expiry: { ...PAYMENT_EXPIRY },
  };

  // Midtrans rejects the charge when item_details do not add up to gross_amount,
  // so only send them when they reconcile exactly.
  const normalizedItems = (items || [])
    .map(item => {
      // Midtrans rejects an empty id outright, and caps name at 50 characters.
      const id = String(item.id ?? item.product_id ?? '').trim();
      const detail = {
        name: String(item.name ?? item.product_name ?? 'Item').slice(0, 50),
        price: Number(item.price ?? item.product_price ?? 0),
        quantity: Number(item.quantity ?? 0),
      };
      if (id) detail.id = id.slice(0, 50);
      return detail;
    })
    .filter(item => item.price > 0 && item.quantity > 0);
  const itemsTotal = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (normalizedItems.length > 0 && itemsTotal === Number(totalAmount)) {
    payload.item_details = normalizedItems;
  }

  if (!bank) {
    return { ...payload, payment_type: 'qris', qris: { acquirer: QRIS_ACQUIRER } };
  }

  if (bank.paymentType === 'echannel') {
    return {
      ...payload,
      payment_type: 'echannel',
      echannel: {
        bill_info1: 'Pembayaran',
        bill_info2: `Pesanan ${orderId}`,
      },
    };
  }

  return { ...payload, payment_type: 'bank_transfer', bank_transfer: { bank: bank.code } };
}

/**
 * POST /v2/charge against the Midtrans Core API.
 * @returns {Promise<object>} the raw Midtrans charge response
 */
export async function chargeMidtransTransaction(env, payload) {
  const serverKey = env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    throw new Error('Midtrans server key not configured.');
  }

  const response = await fetch(chargeUrl(env), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Basic ${btoa(`${serverKey}:`)}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  // Charge accepted is status_code 201 (pending); 200 shows up for instantly settled types.
  const statusCode = String(data?.status_code || '');
  if (!response.ok || !['200', '201'].includes(statusCode)) {
    const detail = Array.isArray(data?.validation_messages) ? data.validation_messages.join(', ') : '';
    const error = new Error(
      `Midtrans charge failed: ${data?.status_message || `HTTP ${response.status}`}${detail ? ` (${detail})` : ''}`
    );
    // Surfaced by the handler: a rejected payload must not be retried as a 500.
    error.midtransStatus = Number(statusCode) || response.status;
    throw error;
  }

  return data;
}

/**
 * Extract the QRIS image URL from a Midtrans charge or /v2/:order_id/status response.
 * Midtrans exposes it as an action named `generate-qr-code`; a few responses carry it
 * as a flat field instead. There is no documented URL that can be derived from the
 * transaction id, so when none of these are present the QR really is unavailable.
 */
export function extractQrisUrl(data) {
  const actions = Array.isArray(data?.actions) ? data.actions : [];
  const qrAction = actions.find(a => (a?.name || '').toLowerCase() === 'generate-qr-code');
  if (qrAction?.url) return qrAction.url;
  if (typeof data?.qr_code_url === 'string' && data.qr_code_url) return data.qr_code_url;
  if (typeof data?.qr_url === 'string' && data.qr_url) return data.qr_url;
  return null;
}

/**
 * Normalize a Midtrans charge/status response into what the UI needs to show.
 * @returns {object|null} instruction, or null when the response carries no payment detail
 */
export function extractPaymentInstruction(data) {
  if (!data) return null;
  const expiryTime = data.expiry_time || null;

  if (data.payment_type === 'qris') {
    const qrUrl = extractQrisUrl(data);
    return qrUrl ? { type: 'qris', qr_url: qrUrl, expiry_time: expiryTime } : null;
  }

  if (data.payment_type === 'echannel') {
    if (!data.bill_key && !data.biller_code) return null;
    return {
      type: 'echannel',
      bank: 'mandiri',
      bank_name: 'Bank Mandiri',
      biller_code: data.biller_code || null,
      bill_key: data.bill_key || null,
      expiry_time: expiryTime,
    };
  }

  if (data.payment_type === 'bank_transfer') {
    const va = Array.isArray(data.va_numbers) && data.va_numbers.length > 0 ? data.va_numbers[0] : null;
    const bankCode = va?.bank || (data.permata_va_number ? 'permata' : null);
    const vaNumber = va?.va_number || data.permata_va_number || null;
    if (!vaNumber) return null;
    return {
      type: 'bank_transfer',
      bank: bankCode,
      bank_name: VA_BANKS.find(bank => bank.code === bankCode)?.name || (bankCode || '').toUpperCase(),
      va_number: vaNumber,
      expiry_time: expiryTime,
    };
  }

  return null;
}

/**
 * Payment instruction already stored on an order row, if any.
 */
export function instructionFromOrder(order) {
  if (!order?.payment_response) return null;
  try {
    return extractPaymentInstruction(JSON.parse(order.payment_response));
  } catch (e) {
    console.warn('[payment] Could not parse payment_response:', e?.message || e);
    return null;
  }
}

const PAID_STATUSES = new Set(['settlement', 'capture']);

/**
 * POST /api/orders/:id/charge - issue a Virtual Account for a bank the buyer picked.
 * Body: { bank: 'bni' | 'bri' | 'cimb' | 'permata' | 'mandiri' }
 */
export async function chargeOrderPayment(request, env) {
  const corsHeaders = request.corsHeaders || {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  try {
    const url = new URL(request.url);
    const orderId = url.pathname.split('/')[3]; // /api/orders/:id/charge
    if (!orderId) {
      return json({ success: false, error: 'Order ID is required' }, 400);
    }

    const body = await request.json().catch(() => ({}));
    const bank = findActiveBank(body?.bank);
    if (!bank) {
      return json(
        {
          success: false,
          error: 'Bank tidak dikenal atau belum aktif',
          banks: getActiveVaBanks(),
        },
        400
      );
    }

    const order = await env.DB.prepare(
      `SELECT id, customer_name, customer_email, customer_phone, total_amount, payment_status, payment_response
       FROM orders WHERE id = ?`
    ).bind(orderId).first();

    if (!order) {
      return json({ success: false, error: 'Pesanan tidak ditemukan' }, 404);
    }

    if (PAID_STATUSES.has(derivePaymentStatusFromData(order))) {
      return json({ success: false, error: 'Pesanan ini sudah dibayar' }, 409);
    }

    // Midtrans rejects a second charge on the same order id, so an order that already
    // has payment details keeps them - returning the existing instruction instead.
    const existing = instructionFromOrder(order);
    if (existing) {
      return json({ success: true, already_charged: true, payment: existing });
    }

    if (!needsBankSelection(order.total_amount)) {
      return json(
        { success: false, error: `Pesanan di bawah Rp ${QRIS_MAX_AMOUNT.toLocaleString('id-ID')} dibayar dengan QRIS` },
        400
      );
    }

    const itemsResult = await env.DB.prepare(
      'SELECT id, product_name, product_price, quantity FROM order_items WHERE order_id = ?'
    ).bind(orderId).all();

    const chargeData = await chargeMidtransTransaction(
      env,
      buildChargePayload(
        {
          orderId,
          totalAmount: order.total_amount,
          customerName: order.customer_name,
          email: order.customer_email,
          phone: order.customer_phone,
          items: itemsResult?.results || [],
        },
        bank
      )
    );

    const instruction = extractPaymentInstruction(chargeData);
    if (!instruction) {
      console.error('[chargeOrderPayment] Charge succeeded but carried no payment detail:', chargeData);
      return json({ success: false, error: 'Midtrans tidak mengembalikan detail pembayaran', details: chargeData }, 502);
    }

    await env.DB.prepare(
      'UPDATE orders SET payment_status = ?, payment_response = ?, updated_at = ? WHERE id = ?'
    ).bind(
      normalizeTransactionStatus(chargeData.transaction_status, chargeData.fraud_status),
      JSON.stringify(chargeData),
      new Date().toISOString(),
      orderId
    ).run();

    return json({ success: true, payment: instruction });
  } catch (error) {
    console.error('[chargeOrderPayment] Error:', error);
    const midtransStatus = Number(error?.midtransStatus) || 0;
    const status = midtransStatus >= 400 && midtransStatus < 500 ? 400 : 500;
    return json({ success: false, error: error?.message || 'Gagal membuat pembayaran' }, status);
  }
}

/**
 * GET /api/orders/:id/payment - what the buyer needs to pay this order right now:
 * an existing instruction, or the bank choices when none has been issued yet.
 */
export async function getOrderPaymentOptions(request, env) {
  const corsHeaders = request.corsHeaders || {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  try {
    const url = new URL(request.url);
    const orderId = url.pathname.split('/')[3]; // /api/orders/:id/payment
    const order = await env.DB.prepare(
      'SELECT id, total_amount, payment_status, payment_response FROM orders WHERE id = ?'
    ).bind(orderId).first();

    if (!order) {
      return json({ success: false, error: 'Pesanan tidak ditemukan' }, 404);
    }

    const instruction = instructionFromOrder(order);
    const requiresBankSelection = !instruction && needsBankSelection(order.total_amount);

    return json({
      success: true,
      payment_status: derivePaymentStatusFromData(order),
      payment: instruction,
      requires_bank_selection: requiresBankSelection,
      banks: requiresBankSelection ? getActiveVaBanks() : [],
    });
  } catch (error) {
    console.error('[getOrderPaymentOptions] Error:', error);
    return json({ success: false, error: 'Gagal mengambil opsi pembayaran' }, 500);
  }
}
