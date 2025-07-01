import axios from 'axios';

// Use the environment variable from Vite, with a fallback to the production URL.
// This makes the configuration flexible and respects the build environment.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://order-management-app-production.wahwooh.workers.dev';

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

// Add request interceptor to log all API requests
apiClient.interceptors.request.use(
  config => {
    console.log(`🌐 API Request: ${config.method.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  error => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

export default apiClient;
