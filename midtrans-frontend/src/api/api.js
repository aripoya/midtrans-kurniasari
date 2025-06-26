import axios from 'axios';

// API base URL - points to our Cloudflare Worker
// Selalu gunakan backend production untuk menghindari error koneksi
const API_BASE_URL = 'https://order-management-app-production.wahwooh.workers.dev';

// Kode original (dinonaktifkan untuk sementara):
// const API_BASE_URL = process.env.NODE_ENV === 'production' 
//   ? 'https://order-management-app-production.wahwooh.workers.dev'
//   : 'http://localhost:8787';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
});

export default apiClient;
