/**
 * Environment utilities with comprehensive TypeScript support
 * Provides safe access to environment variables with fallbacks and type safety
 */

// Type definitions for environment configuration
export interface EnvironmentConfig {
  API_URL: string;
  MIDTRANS_CLIENT_KEY: string;
  MIDTRANS_IS_PRODUCTION: boolean;
  MIDTRANS_SNAP_URL: string;
  NODE_ENV: 'development' | 'production' | 'test';
  MODE: string;
}

export interface MidtransConfig {
  clientKey: string;
  isProduction: boolean;
  snapUrl: string;
  environment: 'sandbox' | 'production';
}

// Environment variable access helpers
type ViteEnv = {
  VITE_MIDTRANS_CLIENT_KEY?: string;
  VITE_API_BASE_URL?: string;
  MODE?: string;
};

/**
 * Get environment variable with type safety
 * @param key - Environment variable key
 * @param fallback - Fallback value if not found
 * @returns Environment variable value or fallback
 */
function getEnvVar(key: keyof ViteEnv, fallback: string = ''): string {
  if (typeof import.meta.env !== 'object') {
    console.warn('⚠️ import.meta.env is not available');
    return fallback;
  }
  
  const value = import.meta.env[key];
  return typeof value === 'string' ? value : fallback;
}

/**
 * Check if running in development mode
 * @returns True if in development mode
 */
export const isDevelopment = (): boolean => {
  return getEnvVar('MODE') === 'development';
};

/**
 * Check if running in production mode
 * @returns True if in production mode
 */
export const isProduction = (): boolean => {
  return getEnvVar('MODE') === 'production' || getEnvVar('MODE') !== 'development';
};

/**
 * Check if running in test mode
 * @returns True if in test mode
 */
export const isTest = (): boolean => {
  return getEnvVar('MODE') === 'test';
};

// URL backend production yang stabil dan terjamin benar
const PRODUCTION_API_URL = 'https://order-management-app-production.wahwooh.workers.dev';

// API URL - SELALU gunakan URL production untuk menghindari error
export const API_URL: string = PRODUCTION_API_URL;

// Log API URL yang digunakan untuk debugging
console.log('🌐 env.ts: Using API URL:', API_URL);

// Midtrans configuration with type safety
export const MIDTRANS_CLIENT_KEY: string = getEnvVar('VITE_MIDTRANS_CLIENT_KEY', '');
export const MIDTRANS_IS_PRODUCTION: boolean = true; // SELALU gunakan production

// Determines which Midtrans script URL to use
export const MIDTRANS_SNAP_URL: string = 'https://app.midtrans.com/snap/snap.js'; // SELALU gunakan production

/**
 * Helper function to check if Midtrans is configured
 * @returns True if Midtrans client key is configured
 */
export const isMidtransConfigured = (): boolean => {
  return !!MIDTRANS_CLIENT_KEY && MIDTRANS_CLIENT_KEY.length > 0;
};

/**
 * Get complete Midtrans configuration
 * @returns Midtrans configuration object
 */
export const getMidtransConfig = (): MidtransConfig => {
  return {
    clientKey: MIDTRANS_CLIENT_KEY,
    isProduction: MIDTRANS_IS_PRODUCTION,
    snapUrl: MIDTRANS_SNAP_URL,
    environment: MIDTRANS_IS_PRODUCTION ? 'production' : 'sandbox',
  };
};

/**
 * Get complete environment configuration
 * @returns Environment configuration object
 */
export const getEnvironmentConfig = (): EnvironmentConfig => {
  return {
    API_URL,
    MIDTRANS_CLIENT_KEY,
    MIDTRANS_IS_PRODUCTION,
    MIDTRANS_SNAP_URL,
    NODE_ENV: isProduction() ? 'production' : (isDevelopment() ? 'development' : 'test'),
    MODE: getEnvVar('MODE', 'production'),
  };
};

/**
 * Validate environment configuration
 * @returns Validation result with details
 */
export const validateEnvironmentConfig = (): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check API URL
  if (!API_URL) {
    errors.push('API_URL is not configured');
  } else if (!API_URL.startsWith('http')) {
    errors.push('API_URL must be a valid HTTP(S) URL');
  }

  // Check Midtrans configuration
  if (!MIDTRANS_CLIENT_KEY) {
    warnings.push('Midtrans client key is not configured - payment features will be disabled');
  } else if (MIDTRANS_CLIENT_KEY.length < 10) {
    warnings.push('Midtrans client key seems too short - please verify configuration');
  }

  // Check Snap URL
  if (!MIDTRANS_SNAP_URL.startsWith('https://')) {
    errors.push('Midtrans Snap URL must be HTTPS');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Log environment configuration for debugging
 * @param showSensitive - Whether to show sensitive values (default: false)
 */
export const logEnvironmentConfig = (showSensitive: boolean = false): void => {
  const config = getEnvironmentConfig();
  const validation = validateEnvironmentConfig();
  
  console.group('🌐 Environment Configuration');
  console.log('API URL:', config.API_URL);
  console.log('Mode:', config.MODE);
  console.log('Node Environment:', config.NODE_ENV);
  console.log('Midtrans Production Mode:', config.MIDTRANS_IS_PRODUCTION);
  console.log('Midtrans Snap URL:', config.MIDTRANS_SNAP_URL);
  
  if (showSensitive) {
    console.log('Midtrans Client Key:', config.MIDTRANS_CLIENT_KEY || 'NOT_CONFIGURED');
  } else {
    console.log('Midtrans Client Key:', config.MIDTRANS_CLIENT_KEY ? '***CONFIGURED***' : 'NOT_CONFIGURED');
  }
  
  console.log('Midtrans Configured:', isMidtransConfigured());
  console.log('Environment Valid:', validation.isValid);
  
  if (validation.errors.length > 0) {
    console.group('❌ Configuration Errors');
    validation.errors.forEach(error => console.error(error));
    console.groupEnd();
  }
  
  if (validation.warnings.length > 0) {
    console.group('⚠️ Configuration Warnings');
    validation.warnings.forEach(warning => console.warn(warning));
    console.groupEnd();
  }
  
  console.groupEnd();
};

/**
 * Type guard to check if value is a valid environment mode
 * @param value - Value to check
 * @returns True if value is valid environment mode
 */
export const isValidEnvironmentMode = (value: any): value is EnvironmentConfig['NODE_ENV'] => {
  return ['development', 'production', 'test'].includes(value);
};

/**
 * Get safe environment variable with validation
 * @param key - Environment variable key
 * @param validator - Optional validator function
 * @param fallback - Fallback value
 * @returns Validated environment variable value
 */
export const getSafeEnvVar = <T>(
  key: keyof ViteEnv,
  validator?: (value: string) => T | null,
  fallback?: T
): T | string => {
  const value = getEnvVar(key);
  
  if (!value && fallback !== undefined) {
    return fallback;
  }
  
  if (validator) {
    const validated = validator(value);
    if (validated !== null) {
      return validated;
    }
    
    if (fallback !== undefined) {
      console.warn(`⚠️ Invalid environment variable ${key}: "${value}". Using fallback.`);
      return fallback;
    }
  }
  
  return value;
};

/**
 * Environment variable validators
 */
export const envValidators = {
  /**
   * Validate URL format
   * @param value - Value to validate
   * @returns Valid URL or null
   */
  url: (value: string): string | null => {
    try {
      new URL(value);
      return value;
    } catch {
      return null;
    }
  },

  /**
   * Validate boolean string
   * @param value - Value to validate
   * @returns Boolean value or null
   */
  boolean: (value: string): boolean | null => {
    const lower = value.toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(lower)) return true;
    if (['false', '0', 'no', 'off'].includes(lower)) return false;
    return null;
  },

  /**
   * Validate number string
   * @param value - Value to validate
   * @returns Number value or null
   */
  number: (value: string): number | null => {
    const num = Number(value);
    return !isNaN(num) ? num : null;
  },

  /**
   * Validate enum value
   * @param allowedValues - Array of allowed values
   * @returns Validator function
   */
  enum: <T extends string>(allowedValues: T[]) => (value: string): T | null => {
    return allowedValues.includes(value as T) ? (value as T) : null;
  },
};

// Run validation on startup and log results
if (isDevelopment()) {
  logEnvironmentConfig(false);
}
