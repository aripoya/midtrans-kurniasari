import apiClient from './api';

// TypeScript interfaces for configuration service
export interface AppConfig {
  app_name?: string;
  version?: string;
  environment?: 'development' | 'production' | 'staging';
  api_base_url?: string;
  payment_gateway?: {
    midtrans?: {
      client_key?: string;
      server_key?: string;
      environment?: 'sandbox' | 'production';
    };
  };
  features?: {
    real_time_sync?: boolean;
    notifications?: boolean;
    photo_upload?: boolean;
    audit_trail?: boolean;
  };
  limits?: {
    max_file_size?: number;
    max_orders_per_page?: number;
    session_timeout?: number;
  };
  ui?: {
    theme?: 'light' | 'dark' | 'auto';
    language?: 'id' | 'en';
    currency?: 'IDR' | 'USD';
  };
}

export interface ConfigResponse {
  success: boolean;
  config?: AppConfig;
  error?: string;
  message?: string;
}

export interface ConfigServiceError extends Error {
  response?: {
    status: number;
    data: any;
  };
}

/**
 * Configuration service for application settings and configuration management
 * Provides type-safe access to application configuration from the backend
 */
class ConfigService {
  /**
   * Get application configuration from the server
   * @returns Promise with application configuration data
   */
  async getConfig(): Promise<ConfigResponse> {
    try {
      const response = await apiClient.get<ConfigResponse>('/api/config');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching application config:', error);
      
      const configError = new Error(
        error.response?.data?.message || 
        error.message || 
        'Failed to fetch application configuration'
      ) as ConfigServiceError;
      
      configError.response = error.response;
      throw configError;
    }
  }

  /**
   * Type guard to check if config response is successful
   * @param response - Config response to check
   * @returns True if response indicates success
   */
  isSuccessResponse(response: ConfigResponse): response is ConfigResponse & { success: true; config: AppConfig } {
    return response.success === true && !!response.config;
  }

  /**
   * Extract error message from config response
   * @param response - Config response to extract error from
   * @returns Error message string
   */
  getErrorMessage(response: ConfigResponse): string {
    return response.error || response.message || 'An unknown configuration error occurred';
  }

  /**
   * Get default configuration values
   * @returns Default configuration object
   */
  getDefaultConfig(): AppConfig {
    return {
      app_name: 'Kurniasari Order Management',
      version: '1.0.0',
      environment: 'production',
      features: {
        real_time_sync: true,
        notifications: true,
        photo_upload: true,
        audit_trail: true,
      },
      limits: {
        max_file_size: 5 * 1024 * 1024, // 5MB
        max_orders_per_page: 50,
        session_timeout: 60 * 60 * 1000, // 1 hour
      },
      ui: {
        theme: 'light',
        language: 'id',
        currency: 'IDR',
      },
    };
  }

  /**
   * Merge server config with default config
   * @param serverConfig - Configuration from server
   * @returns Merged configuration object
   */
  mergeWithDefaults(serverConfig: AppConfig): AppConfig {
    const defaultConfig = this.getDefaultConfig();
    return {
      ...defaultConfig,
      ...serverConfig,
      features: {
        ...defaultConfig.features,
        ...serverConfig.features,
      },
      limits: {
        ...defaultConfig.limits,
        ...serverConfig.limits,
      },
      ui: {
        ...defaultConfig.ui,
        ...serverConfig.ui,
      },
      payment_gateway: {
        ...defaultConfig.payment_gateway,
        ...serverConfig.payment_gateway,
        midtrans: {
          ...defaultConfig.payment_gateway?.midtrans,
          ...serverConfig.payment_gateway?.midtrans,
        },
      },
    };
  }

  /**
   * Check if a feature is enabled in configuration
   * @param config - Application configuration
   * @param feature - Feature key to check
   * @returns True if feature is enabled
   */
  isFeatureEnabled(config: AppConfig, feature: keyof AppConfig['features']): boolean {
    return config.features?.[feature] === true;
  }

  /**
   * Get configuration value with fallback
   * @param config - Application configuration
   * @param key - Configuration key path (e.g., 'ui.theme')
   * @param fallback - Fallback value if key not found
   * @returns Configuration value or fallback
   */
  getConfigValue<T>(config: AppConfig, key: string, fallback: T): T {
    try {
      const keys = key.split('.');
      let value: any = config;
      
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          return fallback;
        }
      }
      
      return value !== undefined ? value : fallback;
    } catch (error) {
      console.warn(`Error getting config value for key '${key}':`, error);
      return fallback;
    }
  }

  /**
   * Validate configuration object
   * @param config - Configuration to validate
   * @returns True if configuration is valid
   */
  isValidConfig(config: any): config is AppConfig {
    if (!config || typeof config !== 'object') {
      return false;
    }

    // Check for required environment values
    if (config.environment && !['development', 'production', 'staging'].includes(config.environment)) {
      return false;
    }

    // Check UI theme if present
    if (config.ui?.theme && !['light', 'dark', 'auto'].includes(config.ui.theme)) {
      return false;
    }

    // Check language if present
    if (config.ui?.language && !['id', 'en'].includes(config.ui.language)) {
      return false;
    }

    // Check currency if present
    if (config.ui?.currency && !['IDR', 'USD'].includes(config.ui.currency)) {
      return false;
    }

    return true;
  }

  /**
   * Check if running in development mode
   * @param config - Application configuration
   * @returns True if in development mode
   */
  isDevelopment(config: AppConfig): boolean {
    return config.environment === 'development';
  }

  /**
   * Check if running in production mode
   * @param config - Application configuration
   * @returns True if in production mode
   */
  isProduction(config: AppConfig): boolean {
    return config.environment === 'production';
  }

  /**
   * Get Midtrans configuration
   * @param config - Application configuration
   * @returns Midtrans configuration or null
   */
  getMidtransConfig(config: AppConfig): AppConfig['payment_gateway']['midtrans'] | null {
    return config.payment_gateway?.midtrans || null;
  }

  /**
   * Check if Midtrans is configured
   * @param config - Application configuration
   * @returns True if Midtrans is properly configured
   */
  isMidtransConfigured(config: AppConfig): boolean {
    const midtransConfig = this.getMidtransConfig(config);
    return !!(midtransConfig?.client_key && midtransConfig?.server_key);
  }
}

// Create and export singleton instance
export const configService = new ConfigService();

// Export default for compatibility with existing imports
export default configService;
