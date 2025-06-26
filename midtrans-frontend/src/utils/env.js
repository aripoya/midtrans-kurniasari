/**
 * Environment utilities
 * Provides safe access to environment variables with fallbacks
 */

// URL backend production yang stabil dan terjamin benar
const PRODUCTION_API_URL = 'https://order-management-app-production.wahwooh.workers.dev';

// API URL - SELALU gunakan URL production untuk menghindari error
export const API_URL = PRODUCTION_API_URL;

// Log API URL yang digunakan untuk debugging
console.log('🌐 env.js: Using API URL:', API_URL);

// Midtrans configuration
export const MIDTRANS_CLIENT_KEY = import.meta.env.VITE_MIDTRANS_CLIENT_KEY || '';
export const MIDTRANS_IS_PRODUCTION = true; // SELALU gunakan production

// Determines which Midtrans script URL to use
export const MIDTRANS_SNAP_URL = 'https://app.midtrans.com/snap/snap.js'; // SELALU gunakan production

// Helper function to check if Midtrans is configured
export const isMidtransConfigured = () => !!MIDTRANS_CLIENT_KEY;
