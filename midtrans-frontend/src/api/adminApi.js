import axios from 'axios';
import apiClient from './api';

// Use the same API URL as the main api client to ensure consistency
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://pesanan.kurniasari.co.id';

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

  // Obtiene la lista completa de pedidos para admin (con más información)
  getAdminOrders: async () => {
    try {
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      console.log(`[DEBUG] Using API endpoint: ${API_BASE_URL}/api/admin/orders?_t=${timestamp}`);
      
      // Try with fetch API instead of axios for more control
      const response = await fetch(
        `${API_BASE_URL}/api/admin/orders?_t=${timestamp}`,
        {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',  // Don't send credentials
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        }
      );
      
      if (!response.ok) {
        console.error('API response not OK:', response.status, response.statusText);
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching admin orders:', error);
      return {
        data: null,
        error: error.message || 'Error al obtener pedidos'
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
      const validTypes = ['ready_for_pickup', 'picked_up', 'delivered'];
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
      const response = await axios.get(
        `${API_BASE_URL}/api/shipping/images/${orderId}`,
        {
          headers: {
            Authorization: `Bearer ${getAdminToken()}`
          }
        }
      );
      
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
      const validTypes = ['ready_for_pickup', 'picked_up', 'delivered'];
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
  }
};

export default adminApi;
