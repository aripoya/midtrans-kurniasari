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
      const response = await apiClient.post('/api/orders', orderData);
      return response.data;
    } catch (error) {
      console.error('Error creating order:', error);
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
