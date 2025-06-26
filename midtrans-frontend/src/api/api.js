import axios from 'axios';

// API base URL - points to our Cloudflare Worker
// Gunakan URL production jika di production environment, atau localhost untuk development
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://order-management-app-production.wahwooh.workers.dev'
  : 'http://localhost:8787';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
});

export default apiClient;
