/**
 * Midtrans Helper Utility with comprehensive TypeScript support
 * 
 * This utility provides type-safe functions to handle Midtrans Snap Payment integration.
 * Documentation: https://docs.midtrans.com/snap/integration-guide
 */

// TypeScript interfaces for Midtrans integration
export interface MidtransPaymentResult {
  order_id: string;
  status_code: string;
  gross_amount: string;
  payment_type: string;
  transaction_time: string;
  transaction_status: 'capture' | 'settlement' | 'pending' | 'deny' | 'cancel' | 'expire' | 'failure';
  fraud_status?: 'accept' | 'challenge' | 'deny';
  status_message?: string;
  transaction_id?: string;
  masked_card?: string;
  bank?: string;
  va_numbers?: Array<{
    bank: string;
    va_number: string;
  }>;
  bca_va_number?: string;
  permata_va_number?: string;
  bill_key?: string;
  biller_code?: string;
  pdf_url?: string;
  finish_redirect_url?: string;
}

export interface SnapCallbackOptions {
  onSuccess?: (result: MidtransPaymentResult) => void;
  onPending?: (result: MidtransPaymentResult) => void;
  onError?: (result: MidtransPaymentResult) => void;
  onClose?: () => void;
}

export interface PaymentProcessResult {
  success: boolean;
  pending?: boolean;
  closed?: boolean;
  redirected?: boolean;
  result?: MidtransPaymentResult;
  error?: any;
}

export interface OrderResponse {
  snap_token?: string;
  payment_url?: string;
  order_id?: string;
  gross_amount?: number;
  transaction_status?: string;
}

export interface MidtransSnapWindow extends Window {
  snap?: {
    pay: (snapToken: string, options: SnapCallbackOptions) => void;
    hide: () => void;
    show: () => void;
  };
}

export interface MidtransScriptLoadError extends Error {
  type: 'script_load_error';
  url?: string;
}

export interface MidtransPaymentError extends Error {
  type: 'payment_error';
  paymentResult?: MidtransPaymentResult;
}

// Declare global window with Midtrans snap
declare global {
  interface Window {
    snap?: {
      pay: (snapToken: string, options: SnapCallbackOptions) => void;
      hide: () => void;
      show: () => void;
    };
  }
}

/**
 * Get environment variable with fallback
 * @param key - Environment variable key
 * @returns Environment variable value or empty string
 */
const getEnvVar = (key: string): string => {
  if (typeof import.meta.env === 'object' && import.meta.env[key]) {
    return import.meta.env[key] as string;
  }
  return '';
};

/**
 * Loads the Midtrans Snap JS script with type safety
 * @param clientKey - Optional client key override
 * @returns Promise that resolves when script is loaded
 */
export const loadMidtransScript = (clientKey?: string): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    try {
      // Check if the script is already loaded
      const existingScript = document.getElementById('midtrans-script');
      if (existingScript && (window as MidtransSnapWindow).snap) {
        console.log('Midtrans Snap script already loaded');
        resolve();
        return;
      }

      // Remove existing script if present but not working
      if (existingScript) {
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.id = 'midtrans-script';
      script.type = 'text/javascript';
      
      // Use production URL since we're using production credentials
      const snapUrl = 'https://app.midtrans.com/snap/snap.js';
      script.src = snapUrl;
      
      const finalClientKey = clientKey || getEnvVar('VITE_MIDTRANS_CLIENT_KEY');
      if (!finalClientKey) {
        const error = new Error('Midtrans client key is required') as MidtransScriptLoadError;
        error.type = 'script_load_error';
        reject(error);
        return;
      }
      
      script.setAttribute('data-client-key', finalClientKey);
      
      script.onload = () => {
        console.log('✅ Midtrans Snap script loaded successfully');
        // Give a small delay to ensure the script is fully initialized
        setTimeout(() => {
          if ((window as MidtransSnapWindow).snap) {
            resolve();
          } else {
            const error = new Error('Midtrans Snap object not available after script load') as MidtransScriptLoadError;
            error.type = 'script_load_error';
            error.url = snapUrl;
            reject(error);
          }
        }, 100);
      };

      script.onerror = (event) => {
        console.error('❌ Error loading Midtrans Snap script:', event);
        const error = new Error('Failed to load Midtrans Snap script') as MidtransScriptLoadError;
        error.type = 'script_load_error';
        error.url = snapUrl;
        reject(error);
      };

      // Add script to document
      document.head.appendChild(script);
      
    } catch (error) {
      console.error('❌ Unexpected error in loadMidtransScript:', error);
      const scriptError = new Error('Unexpected error loading Midtrans script') as MidtransScriptLoadError;
      scriptError.type = 'script_load_error';
      reject(scriptError);
    }
  });
};

/**
 * Opens Midtrans Snap payment popup using the provided token
 * @param snapToken - Snap token received from the backend
 * @param options - Snap configuration options with callbacks
 * @returns Promise that resolves with payment result
 */
export const openMidtransSnap = (
  snapToken: string, 
  options: SnapCallbackOptions = {}
): Promise<PaymentProcessResult> => {
  return new Promise<PaymentProcessResult>(async (resolve, reject) => {
    try {
      if (!snapToken || typeof snapToken !== 'string') {
        throw new Error('Valid snap token is required');
      }

      // Load the script if not already loaded
      console.log('🔄 Loading Midtrans Snap script...');
      await loadMidtransScript();
      
      const snapWindow = window as MidtransSnapWindow;
      if (!snapWindow.snap) {
        throw new Error('Midtrans Snap is not available after script load');
      }

      console.log('🚀 Opening Midtrans Snap payment popup...');

      // Default configuration with type safety
      const defaultOptions: SnapCallbackOptions = {
        onSuccess: (result: MidtransPaymentResult) => {
          console.log('✅ Payment success:', result);
          resolve({ success: true, result });
        },
        onPending: (result: MidtransPaymentResult) => {
          console.log('⏳ Payment pending:', result);
          resolve({ success: true, pending: true, result });
        },
        onError: (result: MidtransPaymentResult) => {
          console.error('❌ Payment error:', result);
          resolve({ success: false, error: result });
        },
        onClose: () => {
          console.log('🔲 Payment popup closed by user');
          resolve({ success: false, closed: true });
        }
      };

      // Merge default options with provided options
      const snapOptions: SnapCallbackOptions = { ...defaultOptions };
      
      // Override with custom callbacks if provided
      if (options.onSuccess) {
        const customOnSuccess = options.onSuccess;
        snapOptions.onSuccess = (result: MidtransPaymentResult) => {
          customOnSuccess(result);
          defaultOptions.onSuccess!(result);
        };
      }
      
      if (options.onPending) {
        const customOnPending = options.onPending;
        snapOptions.onPending = (result: MidtransPaymentResult) => {
          customOnPending(result);
          defaultOptions.onPending!(result);
        };
      }
      
      if (options.onError) {
        const customOnError = options.onError;
        snapOptions.onError = (result: MidtransPaymentResult) => {
          customOnError(result);
          defaultOptions.onError!(result);
        };
      }
      
      if (options.onClose) {
        const customOnClose = options.onClose;
        snapOptions.onClose = () => {
          customOnClose();
          defaultOptions.onClose!();
        };
      }
      
      // Open the Snap payment popup
      snapWindow.snap.pay(snapToken, snapOptions);
      
    } catch (error: any) {
      console.error('❌ Error opening Midtrans Snap:', error);
      const paymentError = new Error(error.message || 'Failed to open payment popup') as MidtransPaymentError;
      paymentError.type = 'payment_error';
      reject(paymentError);
    }
  });
};

/**
 * Process direct payment using the Midtrans Snap popup
 * @param orderResponse - Response from order creation API
 * @param onComplete - Optional callback function after payment process completes
 * @returns Promise with payment processing result
 */
export const processPayment = async (
  orderResponse: OrderResponse,
  onComplete?: (result: PaymentProcessResult) => void
): Promise<PaymentProcessResult> => {
  try {
    console.log('🔄 Processing payment with order response:', orderResponse);

    // Validate order response
    if (!orderResponse || typeof orderResponse !== 'object') {
      throw new Error('Invalid order response provided');
    }

    // If we have a snap token directly
    if (orderResponse.snap_token) {
      console.log('✅ Using snap token from order response');
      const result = await openMidtransSnap(orderResponse.snap_token);
      
      if (onComplete) {
        onComplete(result);
      }
      
      return result;
    }
    // If we have a payment URL but no snap token
    else if (orderResponse.payment_url) {
      console.log('🔄 Extracting token from payment URL');
      
      try {
        // Extract token from the URL if needed
        const url = new URL(orderResponse.payment_url);
        const token = url.searchParams.get('snap_token');
        
        if (token) {
          console.log('✅ Token extracted from payment URL');
          const result = await openMidtransSnap(token);
          
          if (onComplete) {
            onComplete(result);
          }
          
          return result;
        } else {
          // Redirect to the payment URL if no token is available
          console.log('🔀 Redirecting to payment URL');
          window.location.href = orderResponse.payment_url;
          
          const result: PaymentProcessResult = { success: true, redirected: true };
          
          if (onComplete) {
            onComplete(result);
          }
          
          return result;
        }
      } catch (urlError) {
        console.error('❌ Error parsing payment URL:', urlError);
        throw new Error('Invalid payment URL format');
      }
    } else {
      throw new Error('No payment information available in order response');
    }
    
  } catch (error: any) {
    console.error('❌ Payment processing error:', error);
    
    const result: PaymentProcessResult = { 
      success: false, 
      error: {
        message: error.message || 'Payment processing failed',
        type: error.type || 'processing_error'
      }
    };
    
    if (onComplete) {
      onComplete(result);
    }
    
    return result;
  }
};

/**
 * Hide Midtrans Snap payment popup if open
 * @returns True if popup was hidden successfully
 */
export const hideMidtransSnap = (): boolean => {
  try {
    const snapWindow = window as MidtransSnapWindow;
    if (snapWindow.snap && typeof snapWindow.snap.hide === 'function') {
      snapWindow.snap.hide();
      console.log('🔲 Midtrans Snap popup hidden');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Error hiding Midtrans Snap popup:', error);
    return false;
  }
};

/**
 * Show Midtrans Snap payment popup if hidden
 * @returns True if popup was shown successfully
 */
export const showMidtransSnap = (): boolean => {
  try {
    const snapWindow = window as MidtransSnapWindow;
    if (snapWindow.snap && typeof snapWindow.snap.show === 'function') {
      snapWindow.snap.show();
      console.log('📱 Midtrans Snap popup shown');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Error showing Midtrans Snap popup:', error);
    return false;
  }
};

/**
 * Check if Midtrans Snap is loaded and available
 * @returns True if Midtrans Snap is available
 */
export const isMidtransSnapAvailable = (): boolean => {
  const snapWindow = window as MidtransSnapWindow;
  return !!(snapWindow.snap && typeof snapWindow.snap.pay === 'function');
};

/**
 * Validate snap token format
 * @param token - Token to validate
 * @returns True if token appears to be valid
 */
export const isValidSnapToken = (token: string): boolean => {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // Basic validation - Midtrans tokens are typically long alphanumeric strings
  return token.length > 20 && /^[a-zA-Z0-9-_]+$/.test(token);
};

/**
 * Format payment amount for display
 * @param amount - Amount in smallest currency unit (e.g., cents)
 * @param currency - Currency code (default: 'IDR')
 * @returns Formatted amount string
 */
export const formatPaymentAmount = (amount: number | string, currency: string = 'IDR'): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return 'Invalid Amount';
  }
  
  if (currency === 'IDR') {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(numAmount);
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(numAmount);
};

/**
 * Get payment status display name
 * @param status - Transaction status from Midtrans
 * @returns Human-readable status name
 */
export const getPaymentStatusDisplayName = (status: MidtransPaymentResult['transaction_status']): string => {
  const statusNames: Record<MidtransPaymentResult['transaction_status'], string> = {
    capture: 'Captured',
    settlement: 'Settled',
    pending: 'Pending',
    deny: 'Denied',
    cancel: 'Cancelled',
    expire: 'Expired',
    failure: 'Failed'
  };
  
  return statusNames[status] || status;
};

/**
 * Type guard to check if payment result indicates success
 * @param result - Payment result to check
 * @returns True if payment was successful
 */
export const isPaymentSuccessful = (result: PaymentProcessResult): boolean => {
  return result.success === true && !result.closed && !!result.result;
};

/**
 * Type guard to check if payment result indicates pending status
 * @param result - Payment result to check
 * @returns True if payment is pending
 */
export const isPaymentPending = (result: PaymentProcessResult): boolean => {
  return result.success === true && result.pending === true && !!result.result;
};

/**
 * Extract order ID from payment result
 * @param result - Payment result
 * @returns Order ID or null if not found
 */
export const getOrderIdFromPaymentResult = (result: PaymentProcessResult): string | null => {
  return result.result?.order_id || null;
};
