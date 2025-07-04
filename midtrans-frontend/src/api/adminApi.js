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
  // Actualiza el estado de envío de un pedido
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
        error: error.response?.data?.error || error.message || 'Error al actualizar el estado'
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
        error: error.response?.data?.error || error.message || 'Error saat menghapus pesanan'
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
