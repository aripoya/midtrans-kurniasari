import axios, { AxiosResponse } from 'axios';

// Get API base URL from environment or default
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://order-management-app-production.wahwooh.workers.dev';

// Define response types for public API
export interface PublicApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PublicOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  items: Array<{
    id: string;
    product_name: string;
    price: number;
    quantity: number;
    subtotal: number;
  }>;
  total_amount: number;
  shipping_cost: number;
  status: string;
  payment_status: string;
  shipping_status: string;
  shipping_area: string;
  pickup_method: string;
  courier_service?: string;
  tracking_number?: string;
  lokasi_pengiriman?: string;
  lokasi_pengambilan?: string;
  admin_note?: string;
  courier_name?: string;
  created_at: string;
  shipping_images?: Array<{
    id: string;
    order_id: string;
    image_url: string;
    image_type: string;
    uploaded_at: string;
  }>;
}

// Public API service for accessing order data without authentication
export const publicApi = {
  // Get order by ID - public endpoint, no auth required
  getOrderById: async (orderId: string): Promise<PublicApiResponse<PublicOrder>> => {
    try {
      console.log("📤 [Public API] Fetching order with ID:", orderId);
      
      const response: AxiosResponse<PublicApiResponse<PublicOrder>> = await axios.get(
        `${API_BASE_URL}/api/orders/${orderId}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      console.log("📥 [Public API] Response received:", response.data);
      return response.data;
    } catch (error: any) {
      console.error("❌ [Public API] Error fetching order:", error);
      
      if (error.response) {
        return {
          success: false,
          error: error.response.data?.error || `HTTP ${error.response.status}: ${error.response.statusText}`,
        };
      }
      
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  },
};

export default publicApi;
