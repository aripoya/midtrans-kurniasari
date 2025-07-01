/**
 * Midtrans Helper Utility
 * 
 * This utility provides functions to handle Midtrans Snap Payment integration.
 * Documentation: https://docs.midtrans.com/snap/integration-guide
 */

/**
 * Loads the Midtrans Snap JS script
 * @returns {Promise} Resolves when script is loaded
 */
export const loadMidtransScript = () => {
  return new Promise((resolve, reject) => {
    // Check if the script is already loaded
    if (document.getElementById('midtrans-script')) {
      if (window.snap) {
        resolve();
        return;
      }
    }

    const script = document.createElement('script');
    script.id = 'midtrans-script';
    // Use production URL since we're using production credentials
    script.src = 'https://app.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', import.meta.env.VITE_MIDTRANS_CLIENT_KEY || '');
    
    script.onload = () => {
      console.log('Midtrans Snap script loaded');
      resolve();
    };
    script.onerror = (error) => {
      console.error('Error loading Midtrans Snap script:', error);
      reject(error);
    };

    document.body.appendChild(script);
  });
};

/**
 * Opens Midtrans Snap payment popup using the provided token
 * @param {string} snapToken - Token received from the backend
 * @param {Object} options - Snap configuration options
 * @returns {Promise} Resolves when payment process completes or fails
 */
export const openMidtransSnap = (snapToken, options = {}) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Load the script if not already loaded
      await loadMidtransScript();
      
      if (!window.snap) {
        throw new Error('Midtrans Snap is not loaded');
      }

      // Default configuration
      const defaultOptions = {
        onSuccess: function(result) {
          console.log('Payment success:', result);
          resolve({ success: true, result });
        },
        onPending: function(result) {
          console.log('Payment pending:', result);
          resolve({ success: true, pending: true, result });
        },
        onError: function(result) {
          console.error('Payment error:', result);
          resolve({ success: false, error: result });
        },
        onClose: function() {
          console.log('Payment popup closed');
          resolve({ success: false, closed: true });
        }
      };

      // Merge default options with provided options
      const snapOptions = { ...defaultOptions, ...options };
      
      // Open the Snap payment popup
      window.snap.pay(snapToken, snapOptions);
      
    } catch (error) {
      console.error('Error opening Midtrans Snap:', error);
      reject(error);
    }
  });
};

/**
 * Process direct payment using the Midtrans Snap popup
 * @param {Object} orderResponse - Response from order creation API
 * @param {Function} onComplete - Callback function after payment process completes
 */
export const processPayment = async (orderResponse, onComplete) => {
  try {
    // If we have a snap token directly
    if (orderResponse.snap_token) {
      const result = await openMidtransSnap(orderResponse.snap_token);
      if (onComplete) {
        onComplete(result);
      }
      return result;
    }
    // If we have a payment URL but no snap token
    else if (orderResponse.payment_url) {
      // Extract token from the URL if needed
      const url = new URL(orderResponse.payment_url);
      const token = url.searchParams.get('snap_token');
      
      if (token) {
        const result = await openMidtransSnap(token);
        if (onComplete) {
          onComplete(result);
        }
        return result;
      } else {
        // Redirect to the payment URL if no token is available
        window.location.href = orderResponse.payment_url;
        return { redirected: true };
      }
    } else {
      throw new Error('No payment information available');
    }
  } catch (error) {
    console.error('Payment processing error:', error);
    if (onComplete) {
      onComplete({ success: false, error });
    }
    return { success: false, error };
  }
};
