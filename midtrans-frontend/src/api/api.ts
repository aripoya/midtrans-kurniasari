import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// TypeScript interfaces for API responses and requests
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface OrderStatusUpdateRequest {
  status: string;
}

export interface OrderStatusUpdateResponse {
  success: boolean;
  order?: any;
  message?: string;
  error?: string;
}

export interface ShippingImage {
  id: string;
  order_id: string;
  image_type: string;
  image_url: string;
  created_at: string;
}

export interface ShippingImagesResponse {
  success: boolean;
  images: ShippingImage[];
  error?: string;
}

export interface MarkAsReceivedResponse {
  success: boolean;
  data?: any;
  order?: any;
  message?: string;
  error?: string;
}

// Use the environment variable from Vite, with a fallback to the production URL.
// Connect to production environment to ensure consistent authentication
const API_BASE_URL = 'https://order-management-app-production.wahwooh.workers.dev';

// Create axios instance with default config and TypeScript typing
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
});

// Debug: Log URL yang digunakan saat aplikasi start
console.log('🔌 API Client diinisialisasi dengan base URL:', API_BASE_URL);

// Add request interceptor to log all API requests and add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Log API request
    console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    
    // Get token from localStorage
    const token = sessionStorage.getItem('token');
    
    // If token exists, add it to the Authorization header
    if (token) {
      console.log('Adding Authorization token to request');
      if (config.headers) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    } else {
      console.log('No token available for request');
    }
    
    return config;
  },
  (error: any) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

/**
 * Update order status
 * @param orderId - The ID of the order to update
 * @param status - The new status for the order
 * @returns Promise with the API response
 */
export const updateOrderStatus = async (
  orderId: string, 
  status: string
): Promise<AxiosResponse<OrderStatusUpdateResponse>> => {
  const requestData: OrderStatusUpdateRequest = { status };
  return apiClient.patch(`/api/orders/${orderId}/status`, requestData);
};

/**
 * Refresh payment status from Midtrans
 * @param orderId - The ID of the order to refresh status for
 * @returns Promise with the API response
 */
export const refreshOrderStatus = async (
  orderId: string
): Promise<AxiosResponse<ApiResponse>> => {
  return apiClient.post(`/api/orders/${orderId}/refresh-status`);
};

/**
 * Mark an order as received by the customer
 * @param orderId - The ID of the order to mark as received
 * @returns Promise with operation result
 */
export const markOrderAsReceived = async (orderId: string): Promise<MarkAsReceivedResponse> => {
  try {
    // Validate input
    if (!orderId || typeof orderId !== 'string') {
      throw new Error('Order ID is required and must be a string');
    }

    // Gunakan API URL yang benar
    // Production backend only to prevent authentication conflicts
    const apiUrls: string[] = [
      'https://order-management-app-production.wahwooh.workers.dev'
      // Removed localhost fallback to ensure consistent production backend usage
      // This prevents authentication/session conflicts
    ];
    
    let lastError: any = null;
    let successResponse: AxiosResponse | null = null;
    
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
      } catch (err: any) {
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
        } catch (err: any) {
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
  } catch (error: any) {
    console.error('Error marking order as received:', error);
    return { 
      success: false, 
      error: error.response?.data?.error || error.message || 'Gagal menandai pesanan sebagai diterima'
    };
  }
};

/**
 * Get shipping images for customers (public endpoint)
 * @param orderId - The ID of the order to get images for
 * @returns Promise with shipping images response
 */
export const getShippingImages = async (
  orderId: string
): Promise<AxiosResponse<ShippingImagesResponse>> => {
  // Validate input
  if (!orderId || typeof orderId !== 'string') {
    throw new Error('Order ID is required and must be a string');
  }

  // Add cache-busting parameter to prevent browser caching
  const timestamp = Date.now();
  return apiClient.get(`/api/orders/${orderId}/shipping-images?_nocache=${timestamp}`);
};

/**
 * Generic API call wrapper with error handling
 * @param method - HTTP method
 * @param url - API endpoint URL
 * @param data - Request data (optional)
 * @returns Promise with typed API response
 */
export const apiCall = async <T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  data?: any
): Promise<ApiResponse<T>> => {
  try {
    let response: AxiosResponse<T>;
    
    switch (method) {
      case 'GET':
        response = await apiClient.get(url);
        break;
      case 'POST':
        response = await apiClient.post(url, data);
        break;
      case 'PUT':
        response = await apiClient.put(url, data);
        break;
      case 'PATCH':
        response = await apiClient.patch(url, data);
        break;
      case 'DELETE':
        response = await apiClient.delete(url);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
    
    return {
      success: true,
      data: response.data
    };
  } catch (error: any) {
    console.error(`API ${method} ${url} Error:`, error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || `Failed to ${method} ${url}`
    };
  }
};

/**
 * Type guard to check if response is successful
 * @param response - API response to check
 * @returns True if response indicates success
 */
export const isSuccessResponse = <T>(response: ApiResponse<T>): response is ApiResponse<T> & { success: true } => {
  return response.success === true;
};

/**
 * Extract error message from API response
 * @param response - API response to extract error from
 * @returns Error message string
 */
export const getErrorMessage = (response: ApiResponse): string => {
  return response.error || response.message || 'An unknown error occurred';
};

/**
 * Create authorization headers for API requests
 * @param token - Authorization token
 * @returns Headers object with Authorization
 */
export const createAuthHeaders = (token?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  
  const authToken = token || sessionStorage.getItem('token');
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  return headers;
};

export default apiClient;
