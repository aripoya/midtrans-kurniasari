/**
 * API Configuration with comprehensive TypeScript support
 * Central configuration file for API endpoints and application constants
 */

// TypeScript interfaces for configuration
export interface ApiConfig {
  API_URL: string;
  APP_NAME: string;
  IS_PRODUCTION: boolean;
  ITEMS_PER_PAGE: number;
  NODE_ENV: 'development' | 'production' | 'test';
}

export interface EndpointConfig {
  auth: {
    login: string;
    register: string;
    profile: string;
    logout: string;
  };
  orders: {
    base: string;
    create: string;
    update: string;
    delete: string;
    status: string;
    outlet: string;
    delivery: string;
  };
  admin: {
    base: string;
    users: string;
    orders: string;
    outlets: string;
  };
  images: {
    upload: string;
    delete: string;
  };
  config: string;
  products: string;
}

/**
 * Get environment variable with type safety for Vite
 * @param key - Environment variable key
 * @param fallback - Fallback value
 * @returns Environment variable value or fallback
 */
const getEnvVar = (key: string, fallback: string = ''): string => {
  // In Vite, use import.meta.env instead of process.env
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key] as string;
  }
  // Fallback to process.env for Node.js environments
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  return fallback;
};

/**
 * Detect environment mode for Vite
 * @returns Current environment mode
 */
const getEnvironmentMode = (): ApiConfig['NODE_ENV'] => {
  // Vite sets import.meta.env.DEV to true in development
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env.DEV) {
      return 'development';
    }
    if (import.meta.env.PROD) {
      return 'production';
    }
  }
  
  // Fallback to NODE_ENV
  const nodeEnv = getEnvVar('NODE_ENV', 'production');
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return nodeEnv as ApiConfig['NODE_ENV'];
  }
  
  return 'production';
};

// Environment configurations
export const NODE_ENV: ApiConfig['NODE_ENV'] = getEnvironmentMode();

// API URL configuration - PRODUCTION BACKEND ONLY
// Frontend should ALWAYS use production backend for proper JWT secrets and database access
// Do NOT use wrangler dev for backend in production deployment
export const API_URL: string = (() => {
  const envApiUrl = getEnvVar('VITE_API_URL', '').trim();
  if (envApiUrl) return envApiUrl;

  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return 'http://localhost:8787';
    }
  }

  // Use custom domain for better DNS reliability on mobile ISP
  return 'https://api.kurniasari.co.id';
})();

// Development fallback (only for local development testing)
// export const API_URL: string = NODE_ENV === 'development' 
//   ? 'http://localhost:8787'  // Local Wrangler dev server
//   : 'https://order-management-app-production.wahwooh.workers.dev';  // Production server

// Constants for application
export const APP_NAME: string = 'Kurniasari Order Management';
export const IS_PRODUCTION: boolean = NODE_ENV === 'production';
export const IS_DEVELOPMENT: boolean = NODE_ENV === 'development';
export const IS_TEST: boolean = NODE_ENV === 'test';

// Pagination settings
export const ITEMS_PER_PAGE: number = 10;
export const MAX_ITEMS_PER_PAGE: number = 100;

// API endpoint configuration
export const API_ENDPOINTS: EndpointConfig = {
  auth: {
    login: '/api/auth/login',
    register: '/api/auth/register', 
    profile: '/api/auth/profile',
    logout: '/api/auth/logout',
  },
  orders: {
    base: '/api/orders',
    create: '/api/orders',
    update: '/api/orders',
    delete: '/api/orders',
    status: '/api/orders/:id/status',
    outlet: '/api/orders/outlet',
    delivery: '/api/orders/delivery',
  },
  admin: {
    base: '/api/admin',
    users: '/api/admin/users',
    orders: '/api/admin/orders',
    outlets: '/api/admin/outlets',
  },
  images: {
    upload: '/api/images/upload',
    delete: '/api/images/:id',
  },
  config: '/api/config',
  products: '/api/products',
};

// Request timeout configurations (in milliseconds)
export const TIMEOUTS = {
  DEFAULT: 30000,        // 30 seconds
  UPLOAD: 120000,        // 2 minutes for file uploads
  LONG_POLLING: 300000,  // 5 minutes for long polling
  DNS_TIMEOUT: 10000,    // 10 seconds for DNS resolution (mobile ISP)
} as const;

// Retry configuration for DNS issues on mobile ISP
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY: 1000,   // 1 second
  MAX_DELAY: 5000,       // 5 seconds
  BACKOFF_MULTIPLIER: 2, // Exponential backoff
} as const;

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// API response headers
export const API_HEADERS = {
  CONTENT_TYPE: 'Content-Type',
  AUTHORIZATION: 'Authorization',
  ACCEPT: 'Accept',
  USER_AGENT: 'User-Agent',
  X_REQUESTED_WITH: 'X-Requested-With',
} as const;

// Content types
export const CONTENT_TYPES = {
  JSON: 'application/json',
  FORM_DATA: 'multipart/form-data',
  URL_ENCODED: 'application/x-www-form-urlencoded',
  TEXT: 'text/plain',
} as const;

/**
 * Get complete API configuration
 * @returns Complete API configuration object
 */
export const getApiConfig = (): ApiConfig => {
  return {
    API_URL,
    APP_NAME,
    IS_PRODUCTION,
    ITEMS_PER_PAGE,
    NODE_ENV,
  };
};

/**
 * Build full API endpoint URL
 * @param endpoint - API endpoint path
 * @param params - Optional URL parameters to replace
 * @returns Complete API endpoint URL
 */
export const buildApiUrl = (endpoint: string, params?: Record<string, string | number>): string => {
  let url = `${API_URL}${endpoint}`;
  
  // Replace URL parameters (e.g., :id with actual id)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, String(value));
    });
  }
  
  return url;
};

/**
 * Get endpoint URL with parameter substitution
 * @param endpointPath - Dot notation path to endpoint (e.g., 'orders.status')
 * @param params - Parameters to substitute in URL
 * @returns Complete endpoint URL
 */
export const getEndpointUrl = (endpointPath: string, params?: Record<string, string | number>): string => {
  const pathParts = endpointPath.split('.');
  let endpoint: any = API_ENDPOINTS;
  
  // Navigate through the endpoint object
  for (const part of pathParts) {
    if (endpoint && typeof endpoint === 'object' && part in endpoint) {
      endpoint = endpoint[part];
    } else {
      throw new Error(`Invalid endpoint path: ${endpointPath}`);
    }
  }
  
  if (typeof endpoint !== 'string') {
    throw new Error(`Endpoint path does not resolve to a string: ${endpointPath}`);
  }
  
  return buildApiUrl(endpoint, params);
};

/**
 * Validate API URL format
 * @param url - URL to validate
 * @returns True if URL is valid
 */
export const isValidApiUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:';
  } catch {
    return false;
  }
};

/**
 * Check if current environment is development
 * @returns True if in development mode
 */
export const isDevelopment = (): boolean => IS_DEVELOPMENT;

/**
 * Check if current environment is production
 * @returns True if in production mode
 */
export const isProduction = (): boolean => IS_PRODUCTION;

/**
 * Check if current environment is test
 * @returns True if in test mode
 */
export const isTest = (): boolean => IS_TEST;

/**
 * Get appropriate timeout for request type
 * @param requestType - Type of request
 * @returns Timeout value in milliseconds
 */
export const getTimeout = (requestType: 'default' | 'upload' | 'long_polling' = 'default'): number => {
  switch (requestType) {
    case 'upload':
      return TIMEOUTS.UPLOAD;
    case 'long_polling':
      return TIMEOUTS.LONG_POLLING;
    default:
      return TIMEOUTS.DEFAULT;
  }
};

/**
 * Get default request headers
 * @param includeAuth - Whether to include authorization header
 * @returns Default headers object
 */
export const getDefaultHeaders = (includeAuth: boolean = true): Record<string, string> => {
  const headers: Record<string, string> = {
    [API_HEADERS.CONTENT_TYPE]: CONTENT_TYPES.JSON,
    [API_HEADERS.ACCEPT]: CONTENT_TYPES.JSON,
  };
  
  if (includeAuth && typeof window !== 'undefined') {
    const token = sessionStorage.getItem('token');
    if (token) {
      headers[API_HEADERS.AUTHORIZATION] = `Bearer ${token}`;
    }
  }
  
  return headers;
};

/**
 * Type guard to check if HTTP status indicates success
 * @param status - HTTP status code
 * @returns True if status indicates success
 */
export const isSuccessStatus = (status: number): boolean => {
  return status >= 200 && status < 300;
};

/**
 * Type guard to check if HTTP status indicates client error
 * @param status - HTTP status code
 * @returns True if status indicates client error
 */
export const isClientError = (status: number): boolean => {
  return status >= 400 && status < 500;
};

/**
 * Type guard to check if HTTP status indicates server error
 * @param status - HTTP status code
 * @returns True if status indicates server error
 */
export const isServerError = (status: number): boolean => {
  return status >= 500 && status < 600;
};

/**
 * Get human-readable status text
 * @param status - HTTP status code
 * @returns Status description
 */
export const getStatusText = (status: number): string => {
  const statusTexts: Record<number, string> = {
    [HTTP_STATUS.OK]: 'OK',
    [HTTP_STATUS.CREATED]: 'Created',
    [HTTP_STATUS.NO_CONTENT]: 'No Content',
    [HTTP_STATUS.BAD_REQUEST]: 'Bad Request',
    [HTTP_STATUS.UNAUTHORIZED]: 'Unauthorized',
    [HTTP_STATUS.FORBIDDEN]: 'Forbidden',
    [HTTP_STATUS.NOT_FOUND]: 'Not Found',
    [HTTP_STATUS.CONFLICT]: 'Conflict',
    [HTTP_STATUS.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
    [HTTP_STATUS.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
    [HTTP_STATUS.BAD_GATEWAY]: 'Bad Gateway',
    [HTTP_STATUS.SERVICE_UNAVAILABLE]: 'Service Unavailable',
    [HTTP_STATUS.GATEWAY_TIMEOUT]: 'Gateway Timeout',
  };
  
  return statusTexts[status] || `Status ${status}`;
};

/**
 * Retry fetch with exponential backoff for DNS/network issues
 * Useful for mobile ISP with DNS problems
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param retryCount - Current retry attempt
 * @returns Fetch response
 */
export const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  retryCount: number = 0
): Promise<Response> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.DNS_TIMEOUT);
    
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    // Check if it's a DNS/network error and we haven't exceeded max retries
    const isDnsError = error.name === 'AbortError' || 
                       error.message?.includes('Failed to fetch') ||
                       error.message?.includes('NetworkError') ||
                       error.message?.includes('DNS');
    
    if (isDnsError && retryCount < RETRY_CONFIG.MAX_RETRIES) {
      // Calculate delay with exponential backoff
      const delay = Math.min(
        RETRY_CONFIG.INITIAL_DELAY * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, retryCount),
        RETRY_CONFIG.MAX_DELAY
      );
      
      console.warn(`DNS/Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${RETRY_CONFIG.MAX_RETRIES})...`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Retry with incremented count
      return fetchWithRetry(url, options, retryCount + 1);
    }
    
    // If not a DNS error or max retries exceeded, throw the error
    throw error;
  }
};

// Export the configuration as default for compatibility
const apiConfig: ApiConfig = getApiConfig();
export default apiConfig;
