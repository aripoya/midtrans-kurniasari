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
      
      // Make sure all items have valid prices (greater than 0)
      const validItems = orderData.items.filter(item => Number(item.price) > 0);
      
      // If any items were filtered out, log a warning
      if (validItems.length !== orderData.items.length) {
        console.warn('[WARNING] Some items had invalid prices and were removed:', 
          orderData.items.filter(item => Number(item.price) <= 0));
      }
      
      // Update the order data with only valid items
      const validatedOrderData = {
        ...orderData,
        items: validItems
      };
      
      console.log('[DEBUG] Sending validated order data:', validatedOrderData);
      const response = await apiClient.post('/api/orders', validatedOrderData);
      return response.data;
    } catch (error) {
      console.error('❌ Error creating order:', error);

      // Extract detailed error message from response if available
      let errorMessage = 'Failed to create order';
      if (error.response) {
        console.error('[DEBUG] Error response data:', error.response.data);
        if (error.response.data && error.response.data.error) {
          errorMessage = error.response.data.error;
        }
      }

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

      // Create a more informative error object
      const enhancedError = new Error(errorMessage);
      enhancedError.originalError = error;
      enhancedError.responseData = error.response?.data;
      throw enhancedError;
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
