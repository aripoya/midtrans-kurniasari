import axios from 'axios';
import apiClient from './api';

// Use the same API URL as the main api client to ensure consistency
// Determine if we're in development mode
const isDev = import.meta.env.MODE === 'development';
// Use localhost for dev mode, otherwise use the environment variable with production fallback
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (isDev ? 'http://localhost:8787' : 'https://order-management-app-production.wahwooh.workers.dev');

// Helper function to get admin token from localStorage
const getAdminToken = () => {
  return localStorage.getItem('adminToken');
};

// Admin API endpoints
export const adminApi = {
  // Update status pengiriman pesanan
  updateOrderStatus: async (orderId, status, adminNote = '') => {
    try {
      const response = await axios.patch(
        `${API_BASE_URL}/api/orders/${orderId}/status`,
        { 
          status, 
          admin_note: adminNote 
        },
        {
          headers: {
            Authorization: `Bearer ${getAdminToken()}`
          }
        }
      );
      return { data: response.data, error: null };
    } catch (error) {
      console.error('Error updating order status:', error);
      return {
        data: null,
        error: error.response?.data?.error || error.message || 'Error saat memperbarui status'
      };
    }
  },

  // Update detail pesanan termasuk status pengiriman, area pengiriman dan metode pengambilan
  updateOrderDetails: async (orderId, shippingData) => {
    try {
      // Debug logs untuk membantu troubleshooting
      console.group('updateOrderDetails - Request Details');
      console.log('Order ID:', orderId);
      console.log('API URL:', `${API_BASE_URL}/api/orders/${orderId}/details`);
      console.log('Request Payload:', JSON.stringify(shippingData, null, 2));
      console.groupEnd();
      
      // shippingData berisi status, admin_note, shipping_area, dan pickup_method
      const response = await axios.patch(
        `${API_BASE_URL}/api/orders/${orderId}/details`,
        shippingData,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getAdminToken()}`
          }
        }
      );
      
      // Debug log for response
      console.log('updateOrderDetails - Response:', response.data);
      
      return { data: response.data, error: null };
    } catch (error) {
      console.group('updateOrderDetails - Error Details');
      console.error('Error updating order details:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error message:', error.message);
      console.groupEnd();
      
      return {
        data: null,
        error: error.response?.data?.error || error.message || 'Error saat memperbarui detail pesanan'
      };
    }
  },

  // Mendapatkan daftar lengkap pesanan untuk admin
  // NOTE: Menggunakan endpoint biasa /api/orders dengan parameter offset dan limit
  // karena endpoint admin khusus mungkin tidak tersedia di produksi
  getAdminOrders: async () => {
    try {
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      // Gunakan endpoint reguler dengan parameter yang lebih besar
      const requestUrl = `${API_BASE_URL}/api/orders?offset=0&limit=100&_t=${timestamp}`;
      console.log(`[DEBUG] Using standard orders endpoint: ${requestUrl}`);
      
      // Mendapatkan token admin untuk penggunaan di masa mendatang
      // (meskipun endpoint ini mungkin tidak memerlukannya)
      const adminToken = getAdminToken();
      console.log('[DEBUG] Admin token present:', adminToken ? 'Yes' : 'No');
      
      // Gunakan axios untuk permintaan yang lebih sederhana
      const response = await axios.get(requestUrl, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      console.log('[DEBUG] Orders API response status:', response.status);
      console.log('[DEBUG] Orders API response structure:', Object.keys(response.data));
      
      // Bentuk ulang respons untuk kompatibilitas dengan kode yang ada
      // Format asli mungkin: { success: true, data: [...] } atau { success: true, orders: [...] }
      let orders = [];
      
      if (response.data?.success) {
        // Ekstrak data pesanan dari berbagai kemungkinan struktur
        if (Array.isArray(response.data.data)) {
          orders = response.data.data;
        } else if (Array.isArray(response.data.orders)) {
          orders = response.data.orders;
        } else if (response.data.data?.orders && Array.isArray(response.data.data.orders)) {
          orders = response.data.data.orders;
        }
        
        console.log(`[DEBUG] Successfully parsed ${orders.length} orders`);
        
        // Bentuk respons kompatibel dengan struktur yang diharapkan
        return { 
          data: { 
            success: true, 
            orders: orders 
          }, 
          error: null 
        };
      } else {
        console.error('[DEBUG] Invalid or unexpected API response structure');
        throw new Error('Format respons API tidak valid');
      }
    } catch (error) {
      console.error('Error fetching admin orders:', error);
      return {
        data: null,
        error: error.message || 'Error saat mengambil daftar pesanan'
      };
    }
  },

  // Hapus pesanan (delete order)
  deleteOrder: async (orderId) => {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/api/orders/${orderId}`,
        {
          headers: {
            Authorization: `Bearer ${getAdminToken()}`
          }
        }
      );
      return { success: true, data: response.data, error: null };
    } catch (error) {
      console.error('Error deleting order:', error);
      return {
        success: false,
        data: null,
        error: error.response?.data?.error || error.message || 'Error deleting order'
      };
    }
  },
  
  // Upload gambar status pengiriman
  uploadShippingImage: async (orderId, imageType, imageFile) => {
    try {
      // Validasi parameter
      if (!orderId || !imageType || !imageFile) {
        throw new Error('Missing required parameters');
      }
      
      // Validasi tipe gambar
      const validTypes = ['ready_for_pickup', 'picked_up', 'delivered', 'shipment_proof'];
      if (!validTypes.includes(imageType)) {
        throw new Error(`Invalid image type. Must be one of: ${validTypes.join(', ')}`);
      }
      
      // Validasi file gambar
      const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!validMimeTypes.includes(imageFile.type)) {
        throw new Error(`Invalid file type. Must be one of: ${validMimeTypes.join(', ')}`);
      }
      
      // Buat FormData untuk upload
      const formData = new FormData();
      formData.append('image', imageFile);
      
      const response = await axios.post(
        `${API_BASE_URL}/api/shipping/images/${orderId}/${imageType}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${getAdminToken()}`
          }
        }
      );
      
      return { success: true, data: response.data, error: null };
    } catch (error) {
      console.error('Error uploading shipping image:', error);
      return {
        success: false,
        data: null,
        error: error.response?.data?.error || error.message || 'Error uploading image'
      };
    }
  },
  
  // Mendapatkan gambar status pengiriman
  getShippingImages: async (orderId) => {
    try {
      // Add cache-busting parameter to ensure fresh data after refresh
      const timestamp = Date.now();
      const response = await axios.get(
        `${API_BASE_URL}/api/shipping/images/${orderId}?_nocache=${timestamp}`,
        {
          headers: {
            Authorization: `Bearer ${getAdminToken()}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }
      );
      
      console.log('DEBUG: Shipping images fetched with timestamp:', timestamp, response.data);
      return { success: true, data: response.data.data, error: null };
    } catch (error) {
      console.error('Error getting shipping images:', error);
      return {
        success: false,
        data: null,
        error: error.response?.data?.error || error.message || 'Error saat mengambil gambar pengiriman'
      };
    }
  },
  
  // Menghapus gambar status pengiriman
  deleteShippingImage: async (orderId, imageType) => {
    try {
      // Validasi parameter
      if (!orderId || !imageType) {
        throw new Error('Missing required parameters');
      }
      
      // Validasi tipe gambar
      const validTypes = ['ready_for_pickup', 'picked_up', 'delivered', 'shipment_proof'];
      if (!validTypes.includes(imageType)) {
        throw new Error(`Invalid image type. Must be one of: ${validTypes.join(', ')}`);
      }
      
      const response = await axios.delete(
        `${API_BASE_URL}/api/shipping/images/${orderId}/${imageType}`,
        {
          headers: {
            Authorization: `Bearer ${getAdminToken()}`
          }
        }
      );
      
      return { success: true, data: response.data, error: null };
    } catch (error) {
      console.error('Error deleting shipping image:', error);
      return {
        success: false,
        data: null,
        error: error.response?.data?.error || error.message || 'Error saat menghapus gambar pengiriman'
      };
    }
  },

  // Login admin (simulado para demo, en producción debería conectar con backend)
  login: async (username, password) => {
    try {
      // En una implementación real, este sería un endpoint de backend
      if (username === 'admin' && password === 'admin123') {
        // Token simulado - en producción sería generado por el backend
        const mockToken = 'admin-jwt-token-' + Date.now();
        localStorage.setItem('adminToken', mockToken);
        return { 
          success: true,
          data: { token: mockToken },
          error: null
        };
      } else {
        throw new Error('Credenciales inválidas');
      }
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        data: null,
        error: error.message || 'Error de autenticación'
      };
    }
  },

  // Cierre de sesión
  logout: () => {
    localStorage.removeItem('adminToken');
    return { success: true };
  },

  // Verifica si el usuario está autenticado como admin
  isAuthenticated: () => {
    return localStorage.getItem('adminToken') !== null;
  },
  
  // Mengambil daftar lokasi (kode area)
  getLocations: async () => {
    try {
      console.log('[DEBUG] Fetching locations from:', `${API_BASE_URL}/api/locations`);
      const response = await axios.get(
        `${API_BASE_URL}/api/locations`,
        {
          headers: {
            'Accept': 'application/json'
          },
          // Timeout setelah 5 detik untuk mencegah loading yang terlalu lama
          timeout: 5000
        }
      );
      
      console.log('[DEBUG] Locations API response:', response.data);
      return { success: true, data: response.data.locations || [], error: null };
    } catch (error) {
      console.error('[DEBUG] Error fetching locations:', error);
      // Kembalikan array kosong sebagai fallback jika tabel locations tidak ada
      // Ini mencegah aplikasi crash karena error
      return {
        success: true, // Tetap kembalikan success = true untuk mencegah error di UI
        data: [], // Array kosong sebagai fallback
        errorMessage: error.response?.data?.error || error.message || 'Gagal mengambil data lokasi',
        originalError: error
      };
    }
  }
};

export default adminApi;
