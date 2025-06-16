import axios from 'axios';

// API base URL - points to our Cloudflare Worker
const API_BASE_URL = 'https://order-management-app-production.wahwooh.workers.dev';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
});

export default apiClient;
