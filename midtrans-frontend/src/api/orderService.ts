import apiClient from './api';
import { markOrderAsReceived as apiMarkOrderAsReceived } from './api';
import { AxiosResponse } from 'axios';

// TypeScript interfaces for order service
export interface OrderItem {
  id?: string | null;
  // Frontend format
  product_name?: string;
  product_price?: number;
  // Backend format (after transformation)
  name?: string;
  price?: number;
  // Common fields
  quantity: number;
}

export interface OrderData {
  customer_name: string;
  phone: string;
  email: string;
  customer_address: string;
  lokasi_pengiriman?: string;
  lokasi_pengambilan?: string;
  shipping_area: 'dalam-kota' | 'luar-kota';
  pickup_method: string;
  courier_service?: string | null;
  shipping_notes?: string | null;
  tracking_number?: string;
  total_amount: number;
  items: OrderItem[];
  payment_method?: string;
  admin_note?: string;
}

export interface Order extends OrderData {
  id: string;
  payment_status: string;
  shipping_status: string;
  payment_url?: string;
  created_at: string;
  updated_at?: string;
}

export interface OrdersResponse {
  success: boolean;
  orders?: Order[];
  data?: Order[] | { orders: Order[] };
  total?: number;
  offset?: number;
  limit?: number;
  error?: string;
}

export interface OrderResponse {
  success: boolean;
  order?: Order;
  data?: Order;
  error?: string;
}

export interface CreateOrderResponse {
  success: boolean;
  orderId?: string;
  token?: string;
  redirect_url?: string;
  error?: string;
}

export interface TransactionStatusResponse {
  success: boolean;
  transaction_status: string;
  order_id: string;
  gross_amount: string;
  payment_type?: string;
  transaction_id?: string;
  error?: string;
}

export interface MarkAsReceivedResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface ValidatedOrderData extends OrderData {
  items: OrderItem[];
}

// Enhanced error interface for better error handling
export interface OrderServiceError extends Error {
  originalError?: any;
  responseData?: any;
}


// Type guard to validate order item
const isValidOrderItem = (item: OrderItem): boolean => {
  console.log('🔍 [DEBUG] Validating order item:', JSON.stringify(item, null, 2));
  console.log('🔍 [DEBUG] Item checks:');
  console.log('  - item exists:', !!item);
  console.log('  - product_name type:', typeof item?.product_name, '| value:', item?.product_name);
  console.log('  - name type:', typeof item?.name, '| value:', item?.name);
  console.log('  - quantity type:', typeof item?.quantity, '| value:', item?.quantity);
  console.log('  - product_price type:', typeof item?.product_price, '| value:', item?.product_price);
  console.log('  - price type:', typeof item?.price, '| value:', item?.price);
  console.log('  - price > 0:', (item?.product_price || item?.price || 0) > 0);
  console.log('  - quantity > 0:', (item?.quantity || 0) > 0);
  
  // Check if item exists and has required fields
  if (!item) {
    console.log('🔍 [DEBUG] Item is null/undefined');
    return false;
  }
  
  const name = item.product_name || item.name;
  const price = item.product_price || item.price;
  const quantity = item.quantity;
  
  const isValid = typeof name === 'string' &&
         typeof quantity === 'number' &&
         typeof price === 'number' &&
         price > 0 &&
         quantity > 0;
         
  console.log('🔍 [DEBUG] Item validation result:', isValid);
  return isValid;
};

// Validate and clean order data
const validateOrderData = (orderData: OrderData): ValidatedOrderData => {
  console.log('🚀 [DEBUG] validateOrderData called with:', JSON.stringify(orderData, null, 2));
  console.log('🚀 [DEBUG] orderData.items length:', orderData.items?.length);
  console.log('🚀 [DEBUG] orderData.items:', orderData.items);
  
  // Make sure all items have valid prices (greater than 0)
  const validItems = orderData.items.filter(isValidOrderItem);
  
  // If any items were filtered out, log a warning
  if (validItems.length !== orderData.items.length) {
    console.warn('[WARNING] Some items had invalid prices and were removed:', 
      orderData.items.filter(item => !isValidOrderItem(item)));
  }
  
  if (validItems.length === 0) {
    throw new Error('No valid items found in order');
  }
  
  // Update the order data with only valid items
  return {
    ...orderData,
    items: validItems
  };
};

// Create enhanced error object
const createOrderServiceError = (message: string, originalError?: any): OrderServiceError => {
  const error = new Error(message) as OrderServiceError;
  error.originalError = originalError;
  error.responseData = originalError?.response?.data;
  return error;
};

// Order service functions with full TypeScript support
export const orderService = {
  /**
   * Get all orders with pagination
   * @param offset - Starting index for pagination
   * @param limit - Maximum number of orders to return
   * @returns Promise with orders response
   */
  async getOrders(offset: number = 0, limit: number = 50): Promise<OrdersResponse> {
    try {
      if (offset < 0 || limit <= 0) {
        throw new Error('Invalid pagination parameters');
      }

      const response: AxiosResponse<OrdersResponse> = await apiClient.get(
        `/api/orders?offset=${offset}&limit=${limit}`
      );
      return response.data;
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      throw createOrderServiceError('Failed to fetch orders', error);
    }
  },

  /**
   * Get QRIS image URL for an order from backend
   * @param orderId - The ID of the order
   */
  async getQrisUrl(orderId: string): Promise<{ success: boolean; qris_url?: string; error?: string }> {
    try {
      if (!orderId || typeof orderId !== 'string') {
        throw new Error('Order ID is required and must be a string');
      }
      
      const url = `/api/orders/${orderId}/qris-url`;
      console.log('🔍 [FRONTEND] Making QRIS URL request:', {
        orderId,
        url,
        fullUrl: `${apiClient.defaults.baseURL}${url}`
      });
      
      const response: AxiosResponse<{ success: boolean; qris_url?: string; error?: string }> = await apiClient.get(url);
      
      console.log('🔍 [FRONTEND] QRIS URL response:', {
        status: response.status,
        data: response.data
      });
      
      return response.data;
    } catch (error: any) {
      console.error(`❌ [FRONTEND] Error fetching QRIS URL for ${orderId}:`, {
        error,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      throw createOrderServiceError(`Failed to fetch QRIS URL for ${orderId}`, error);
    }
  },
  
  /**
   * Get a single order by ID
   * @param orderId - The ID of the order to fetch
   * @returns Promise with order response
   */
  async getOrderById(orderId: string): Promise<OrderResponse> {
    try {
      if (!orderId || typeof orderId !== 'string') {
        throw new Error('Order ID is required and must be a string');
      }

      const response: AxiosResponse<OrderResponse> = await apiClient.get(
        `/api/orders/${orderId}`
      );
      
      // Ensure consistent response structure
      return {
        success: response.data.success,
        data: response.data.order || response.data.data,
        error: response.data.error
      };
    } catch (error: any) {
      console.error(`Error fetching order ${orderId}:`, error);
      throw createOrderServiceError(`Failed to fetch order ${orderId}`, error);
    }
  },
  
  /**
   * Create a new order
   * @param orderData - The order data to create
   * @returns Promise with created order response
   */
  async createOrder(orderData: OrderData): Promise<CreateOrderResponse> {
    try {
      // DEBUG: Log the baseURL from the apiClient instance right before making the call.
      console.log('[DEBUG] orderService.createOrder is using apiClient with baseURL:', apiClient.defaults.baseURL);
      
      // Validate and clean order data
      const validatedOrderData = validateOrderData(orderData);
      
      console.log('[DEBUG] Sending validated order data:', validatedOrderData);
      const response: AxiosResponse<CreateOrderResponse> = await apiClient.post('/api/orders', validatedOrderData);
      return response.data;
    } catch (error: any) {
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

      throw createOrderServiceError(errorMessage, error);
    }
  },
  
  /**
   * Check transaction status for an order
   * @param orderId - The ID of the order to check transaction status for
   * @returns Promise with transaction status response
   */
  async checkTransactionStatus(orderId: string): Promise<TransactionStatusResponse> {
    try {
      if (!orderId || typeof orderId !== 'string') {
        throw new Error('Order ID is required and must be a string');
      }

      const response: AxiosResponse<TransactionStatusResponse> = await apiClient.get(
        `/api/transaction/${orderId}/status`
      );
      return response.data;
    } catch (error: any) {
      console.error(`Error checking transaction status for ${orderId}:`, error);
      throw createOrderServiceError(`Failed to check transaction status for ${orderId}`, error);
    }
  },
  
  /**
   * Mark order as received by customer
   * @param orderId - The ID of the order to mark as received
   * @returns Promise with operation result
   */
  async markOrderAsReceived(orderId: string): Promise<any> {
    try {
      if (!orderId || typeof orderId !== 'string') {
        throw new Error('Order ID is required and must be a string');
      }

      console.log(`[orderService] Marking order as received: ${orderId}`);
      const result = await apiMarkOrderAsReceived(orderId);
      
      if (!result.success) {
        throw new Error(result.error || 'Gagal menandai pesanan sebagai diterima');
      }
      
      return result.data;
    } catch (error: any) {
      console.error(`Error marking order ${orderId} as received:`, error);
      throw createOrderServiceError(`Failed to mark order ${orderId} as received`, error);
    }
  },

  /**
   * Update order status
   * @param orderId - The ID of the order to update
   * @param status - The new status
   * @returns Promise with update result
   */
  async updateOrderStatus(orderId: string, status: string): Promise<OrderResponse> {
    try {
      if (!orderId || typeof orderId !== 'string') {
        throw new Error('Order ID is required and must be a string');
      }
      if (!status || typeof status !== 'string') {
        throw new Error('Status is required and must be a string');
      }

      const response: AxiosResponse<OrderResponse> = await apiClient.patch(
        `/api/orders/${orderId}/status`, 
        { status }
      );
      return response.data;
    } catch (error: any) {
      console.error(`Error updating order ${orderId} status:`, error);
      throw createOrderServiceError(`Failed to update order ${orderId} status`, error);
    }
  },

  /**
   * Get order count
   * @returns Promise with order count
   */
  async getOrderCount(): Promise<{ count: number; success: boolean; error?: string }> {
    try {
      const response: AxiosResponse<{ count: number; success: boolean }> = await apiClient.get('/api/orders/count');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching order count:', error);
      return { count: 0, success: false, error: error.message };
    }
  },

  /**
   * Search orders by customer name or order ID
   * @param query - Search query
   * @param offset - Starting index for pagination
   * @param limit - Maximum number of orders to return
   * @returns Promise with search results
   */
  async searchOrders(query: string, offset: number = 0, limit: number = 50): Promise<OrdersResponse> {
    try {
      if (!query || typeof query !== 'string') {
        throw new Error('Search query is required and must be a string');
      }
      if (offset < 0 || limit <= 0) {
        throw new Error('Invalid pagination parameters');
      }

      const response: AxiosResponse<OrdersResponse> = await apiClient.get(
        `/api/orders/search?q=${encodeURIComponent(query)}&offset=${offset}&limit=${limit}`
      );
      return response.data;
    } catch (error: any) {
      console.error('Error searching orders:', error);
      throw createOrderServiceError('Failed to search orders', error);
    }
  },

  /**
   * Type guard to check if an object is a valid Order
   * @param obj - Object to check
   * @returns True if the object is a valid Order
   */
  isOrder(obj: any): obj is Order {
    return obj && 
           typeof obj.id === 'string' &&
           typeof obj.customer_name === 'string' &&
           typeof obj.total_amount === 'number' &&
           Array.isArray(obj.items);
  },

  /**
   * Calculate total amount from order items
   * @param items - Array of order items
   * @returns Total amount
   */
  calculateTotal(items: OrderItem[]): number {
    return items.reduce((total, item) => {
      const price = item.price || item.product_price || 0;
      return total + (price * item.quantity);
    }, 0);
  }
};

export default orderService;
