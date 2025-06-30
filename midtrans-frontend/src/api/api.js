import axios from 'axios';

// Use the environment variable from Vite, with a fallback to the production URL.
// This makes the configuration flexible and respects the build environment.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://tagihan.kurniasari.co.id';

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
