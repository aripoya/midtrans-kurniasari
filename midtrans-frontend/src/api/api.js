import axios from 'axios';

// URL backend production - JANGAN DIUBAH
const PRODUCTION_API_URL = 'https://order-management-app-production.wahwooh.workers.dev';

// API base URL - SELALU gunakan production URL untuk menghindari error
const API_BASE_URL = PRODUCTION_API_URL;

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
