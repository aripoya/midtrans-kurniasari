import apiClient from './api';

// Order service functions
export const orderService = {
  // Get all orders with pagination
  async getOrders(offset = 0, limit = 50) {
    try {
      const response = await apiClient.get(`/api/orders?offset=${offset}&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  },
  
  // Get a single order by ID
  async getOrderById(orderId) {
    try {
      const response = await apiClient.get(`/api/orders/${orderId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching order ${orderId}:`, error);
      throw error;
    }
  },
  
  // Create a new order
  async createOrder(orderData) {
    try {
      // DEBUG: Log the baseURL from the apiClient instance right before making the call.
      console.log('[DEBUG] orderService.createOrder is using apiClient with baseURL:', apiClient.defaults.baseURL);
      const response = await apiClient.post('/api/orders', orderData);
      return response.data;
    } catch (error) {
      console.error('❌ Error creating order:', error);

      // DEBUG: If the request fails, log the full config object from the error.
      if (error.config) {
        console.error('[DEBUG] Axios request config that failed:', {
          url: error.config.url,
          baseURL: error.config.baseURL,
          method: error.config.method,
          headers: error.config.headers,
          data: error.config.data,
        });
      }

      throw error;
    }
  },
  
  // Check transaction status
  async checkTransactionStatus(orderId) {
    try {
      const response = await apiClient.get(`/api/transaction/${orderId}/status`);
      return response.data;
    } catch (error) {
      console.error(`Error checking transaction status for ${orderId}:`, error);
      throw error;
    }
  }
};
