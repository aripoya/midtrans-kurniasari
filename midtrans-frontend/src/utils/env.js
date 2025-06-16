/**
 * Environment utilities
 * Provides safe access to environment variables with fallbacks
 */

// API URL - default to production Worker URL if not specified
export const API_URL = import.meta.env.VITE_API_URL || 'https://order-management-app-production.wahwooh.workers.dev';

// Midtrans configuration
export const MIDTRANS_CLIENT_KEY = import.meta.env.VITE_MIDTRANS_CLIENT_KEY || '';
export const MIDTRANS_IS_PRODUCTION = import.meta.env.VITE_MIDTRANS_IS_PRODUCTION === 'true';

// Determines which Midtrans script URL to use
export const MIDTRANS_SNAP_URL = MIDTRANS_IS_PRODUCTION
  ? 'https://app.midtrans.com/snap/snap.js'
  : 'https://app.sandbox.midtrans.com/snap/snap.js';

// Helper function to check if Midtrans is configured
export const isMidtransConfigured = () => !!MIDTRANS_CLIENT_KEY;
