import { markOrderAsReceived as unifiedMarkOrderAsReceived } from './orders.js';
// DEPRECATED: This handler now delegates to the unified implementation in orders.js
// Function for customers to mark their order as received
export async function markOrderAsReceived(request, env) {
  // Delegate to unified implementation to ensure consistent verification, logging, and notifications
  return unifiedMarkOrderAsReceived(request, env);
}
