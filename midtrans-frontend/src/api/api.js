import axios from 'axios';

// Use the environment variable from Vite, with a fallback to the production URL.
// This makes the configuration flexible and respects the build environment.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://pesanan.kurniasari.co.id';

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


export const updateOrderStatus = (orderId, status) => {
  return apiClient.patch(`/api/orders/${orderId}/status`, { status });
};

// New service to refresh payment status from Midtrans
export const refreshOrderStatus = (orderId) => {
  return apiClient.post(`/api/orders/${orderId}/refresh-status`);
};

// New service for customers to mark an order as received
export const markOrderAsReceived = (orderId) => {
  return apiClient.post(`/api/orders/${orderId}/mark-received`);
};

// Get shipping images for customers (public endpoint)
export const getShippingImages = (orderId) => {
  return apiClient.get(`/api/shipping/images/${orderId}`);
};

export default apiClient;
