import axios from 'axios';

// Use the environment variable from Vite, with a fallback to the production URL.
// This makes the configuration flexible and respects the build environment.
// Determine if we're in development mode
const isDev = import.meta.env.MODE === 'development';
// Use localhost for dev mode, otherwise use the environment variable with production fallback
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isDev ? 'http://localhost:8787' : 'https://order-management-app-production.wahwooh.workers.dev');

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

// New service for customers to// Menandai pesanan sebagai sudah diterima oleh pelanggan
export const markOrderAsReceived = async (orderId) => {
  try {
    // Gunakan multiple API URLs, sama seperti di OrderDetailPage
    const isDev = import.meta.env.MODE === 'development';
    // Use multiple possible backend URLs to maximize chances of success
    const apiUrls = [
      'https://tagihan.kurniasari.co.id',
      'https://order-management-app-production.wahwooh.workers.dev',
      isDev ? 'http://localhost:8787' : null
    ].filter(Boolean);
    
    let lastError = null;
    let successResponse = null;
    
    // Try each URL until one works
    for (const baseUrl of apiUrls) {
      try {
        console.log(`🌐 Trying API URL for markOrderAsReceived: ${baseUrl}`);
        // Perbaikan: Menggunakan POST method sesuai dengan backend
        const response = await axios.post(
          `${baseUrl}/api/orders/${orderId}/received`,
          {}, // empty body
          {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (response.data && (response.data.success || response.data.order || response.data.data)) {
          successResponse = response;
          console.log(`✅ Successful response from ${baseUrl}`);
          break;
        }
      } catch (err) {
        console.log(`❌ Error with ${baseUrl}:`, err.message);
        lastError = err;
      }
    }
    
    // Jika tidak berhasil dengan /received, coba dengan /mark-received (backward compatibility)
    if (!successResponse) {
      for (const baseUrl of apiUrls) {
        try {
          console.log(`🌐 Trying alternative endpoint for markOrderAsReceived: ${baseUrl}`);
          const response = await axios.post(
            `${baseUrl}/api/orders/${orderId}/mark-received`,
            {},
            {
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (response.data && (response.data.success || response.data.order || response.data.data)) {
            successResponse = response;
            console.log(`✅ Successful response from alternative endpoint: ${baseUrl}`);
            break;
          }
        } catch (err) {
          console.log(`❌ Error with alternative endpoint ${baseUrl}:`, err.message);
          lastError = err;
        }
      }
    }
    
    if (!successResponse && lastError) {
      throw lastError;
    } else if (!successResponse) {
      throw new Error('Tidak bisa terhubung ke server');
    }
    
    return { success: true, data: successResponse.data };
  } catch (error) {
    console.error('Error marking order as received:', error);
    return { 
      success: false, 
      error: error.response?.data?.error || error.message || 'Gagal menandai pesanan sebagai diterima'
    };
  }
};

// Get shipping images for customers (public endpoint)
export const getShippingImages = (orderId) => {
  // Add cache-busting parameter to prevent browser caching
  const timestamp = Date.now();
  return apiClient.get(`/api/orders/${orderId}/shipping-images?_nocache=${timestamp}`);
};

export default apiClient;
