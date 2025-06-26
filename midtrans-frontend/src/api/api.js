import axios from 'axios';

// FINAL DEBUG: Hardcoding the production URL to isolate the issue.
// This eliminates environment variables as a potential cause.
const API_BASE_URL = 'https://order-management-app-production.wahwooh.workers.dev';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
});

// Debug: Log URL yang digunakan saat aplikasi start
console.log('🔌 API Client diinisialisasi dengan base URL:', API_BASE_URL);

export default apiClient;
