// Utility to unify payment status derivation across endpoints
// We prefer Midtrans transaction_status from payment_response JSON when available
// Fallback to orders.payment_status column

/**
 * Normalize Midtrans transaction status with fraud status context
 * @param {string} txStatus - Midtrans transaction_status
 * @param {string} [fraudStatus] - Midtrans fraud_status (used when txStatus === 'capture')
 * @returns {string} normalized status suitable for storage and filtering
 */
export function normalizeTransactionStatus(txStatus, fraudStatus) {
  if (!txStatus) return 'pending';
  const s = String(txStatus).toLowerCase();
  if (s === 'capture') {
    // Keep 'challenge' distinct if present for visibility; otherwise treat as 'capture'
    if (String(fraudStatus || '').toLowerCase() === 'challenge') return 'challenge';
    return 'capture';
  }
  // Pass-through known Midtrans statuses
  const known = new Set([
    'settlement',
    'pending',
    'cancel',
    'deny',
    'expire',
    'refund',
    'partial_refund',
    'challenge',
  ]);
  if (known.has(s)) return s;
  // Fallback: return original to avoid losing information
  return s;
}

/**
 * Derive a consistent payment_status for an order record
 * - Prefers payment_response.transaction_status when present
 * - Falls back to order.payment_status
 * @param {{ payment_status?: string, payment_response?: string }} orderOrObj
 * @returns {string}
 */
export function derivePaymentStatusFromData(orderOrObj) {
  if (!orderOrObj) return 'pending';
  try {
    if (orderOrObj.payment_response) {
      const pr = JSON.parse(orderOrObj.payment_response);
      return normalizeTransactionStatus(pr.transaction_status, pr.fraud_status);
    }
  } catch (e) {
    // ignore parse errors, fallback to column
  }
  return normalizeTransactionStatus(orderOrObj.payment_status || 'pending');
}

/**
 * Convenience helper to determine if a status is effectively "paid"
 * @param {string} status
 * @returns {boolean}
 */
export function isPaidStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'settlement') return true;
  if (s === 'capture') return true; // treat capture-accept as paid at UI level
  return false;
}
