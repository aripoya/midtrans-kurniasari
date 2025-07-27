/**
 * Handle Update Status utility with comprehensive TypeScript support
 * Handles admin order status updates with validation and error handling
 */

import { CreateToastFnReturn } from '@chakra-ui/react';

// TypeScript interfaces for handleUpdateStatus
export interface Order {
  id: string;
  shipping_status?: string;
  shipping_area?: string;
  pickup_method?: string;
  admin_note?: string;
  customer_name?: string;
  customer_phone?: string;
  total_amount?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: any; // Allow for additional fields
}

export interface ShippingData {
  status?: string;
  admin_note?: string | null;
  shipping_area?: string;
  pickup_method?: string | null;
}

export interface UpdateOrderResponse {
  success: boolean;
  order?: Order;
  error?: string;
  message?: string;
}

export interface AdminApi {
  updateOrderDetails: (orderId: string, data: ShippingData) => Promise<UpdateOrderResponse>;
}

export type SetOrderFunction = React.Dispatch<React.SetStateAction<Order>>;
export type SetIsUpdatingFunction = React.Dispatch<React.SetStateAction<boolean>>;
export type SetSavedAdminNoteFunction = React.Dispatch<React.SetStateAction<string>>;

// Allowed values for validation
export const ALLOWED_STATUSES = ['dikemas', 'siap kirim', 'sedang dikirim', 'received'] as const;
export const ALLOWED_SHIPPING_AREAS = ['dalam-kota', 'luar-kota'] as const;
export const ALLOWED_PICKUP_METHODS = ['sendiri', 'ojek-online'] as const;

export type AllowedStatus = typeof ALLOWED_STATUSES[number];
export type AllowedShippingArea = typeof ALLOWED_SHIPPING_AREAS[number];
export type AllowedPickupMethod = typeof ALLOWED_PICKUP_METHODS[number];

export interface HandleUpdateStatusParams {
  id: string;
  shippingStatus?: string;
  adminNote?: string;
  shippingArea?: string;
  pickupMethod?: string;
  adminApi: AdminApi;
  setIsUpdating: SetIsUpdatingFunction;
  setOrder: SetOrderFunction;
  setSavedAdminNote: SetSavedAdminNoteFunction;
  toast: CreateToastFnReturn;
}

export interface ValidationError extends Error {
  field?: string;
  allowedValues?: string[];
}

/**
 * Validate shipping status
 * @param status - Status to validate
 * @returns True if status is valid
 */
export const isValidStatus = (status: string): status is AllowedStatus => {
  return ALLOWED_STATUSES.includes(status as AllowedStatus);
};

/**
 * Validate shipping area
 * @param area - Area to validate
 * @returns True if area is valid
 */
export const isValidShippingArea = (area: string): area is AllowedShippingArea => {
  return ALLOWED_SHIPPING_AREAS.includes(area as AllowedShippingArea);
};

/**
 * Validate pickup method
 * @param method - Method to validate
 * @returns True if method is valid
 */
export const isValidPickupMethod = (method: string): method is AllowedPickupMethod => {
  return ALLOWED_PICKUP_METHODS.includes(method as AllowedPickupMethod);
};

/**
 * Normalize string value - trim and return null for empty strings
 * @param value - Value to normalize
 * @returns Normalized string or null
 */
const normalizeString = (value?: string): string | null => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * Validate shipping data before sending to server
 * @param data - Shipping data to validate
 * @throws ValidationError if data is invalid
 */
const validateShippingData = (data: ShippingData): void => {
  const { status, shipping_area, pickup_method } = data;

  // Validate status
  if (status && !isValidStatus(status)) {
    const error = new Error(
      `Status tidak valid. Nilai yang diperbolehkan: ${ALLOWED_STATUSES.join(', ')}`
    ) as ValidationError;
    error.field = 'status';
    error.allowedValues = [...ALLOWED_STATUSES];
    throw error;
  }

  // Validate shipping area
  if (shipping_area && !isValidShippingArea(shipping_area)) {
    const error = new Error(
      `Area pengiriman tidak valid. Nilai yang diperbolehkan: ${ALLOWED_SHIPPING_AREAS.join(', ')}`
    ) as ValidationError;
    error.field = 'shipping_area';
    error.allowedValues = [...ALLOWED_SHIPPING_AREAS];
    throw error;
  }

  // Validate pickup method if shipping area is dalam-kota
  if (shipping_area === 'dalam-kota') {
    if (pickup_method && !isValidPickupMethod(pickup_method)) {
      const error = new Error(
        `Metode pengambilan tidak valid. Nilai yang diperbolehkan: ${ALLOWED_PICKUP_METHODS.join(', ')}`
      ) as ValidationError;
      error.field = 'pickup_method';
      error.allowedValues = [...ALLOWED_PICKUP_METHODS];
      throw error;
    }
  }
};

/**
 * Function for updating shipping status using adminApi with comprehensive type safety
 * @param params - All parameters needed for status update
 */
const handleUpdateStatus = async (params: HandleUpdateStatusParams): Promise<void> => {
  const {
    id,
    shippingStatus,
    adminNote,
    shippingArea,
    pickupMethod,
    adminApi,
    setIsUpdating,
    setOrder,
    setSavedAdminNote,
    toast
  } = params;

  // Validate required parameters
  if (!id || typeof id !== 'string') {
    throw new Error('Order ID is required and must be a string');
  }

  if (!adminApi || typeof adminApi.updateOrderDetails !== 'function') {
    throw new Error('Admin API is required with updateOrderDetails method');
  }

  setIsUpdating(true);
  
  try {
    // Normalisasi nilai untuk memastikan sesuai dengan ekspektasi backend
    // Backend mengharapkan nilai string yang valid atau null, bukan undefined
    const normalizedStatus = normalizeString(shippingStatus);
    const normalizedAdminNote = normalizeString(adminNote);
    const normalizedShippingArea = normalizeString(shippingArea);
    const normalizedPickupMethod = 
      normalizedShippingArea === 'dalam-kota' && pickupMethod ? normalizeString(pickupMethod) : null;

    // Buat objek data dengan nilai yang sudah dinormalisasi
    const shippingData: ShippingData = {};
    
    // Hanya tambahkan field yang memiliki nilai
    if (normalizedStatus) shippingData.status = normalizedStatus;
    if (normalizedAdminNote !== null) shippingData.admin_note = normalizedAdminNote;
    if (normalizedShippingArea) shippingData.shipping_area = normalizedShippingArea;
    if (normalizedPickupMethod) shippingData.pickup_method = normalizedPickupMethod;
    
    // Validasi apakah ada data yang akan diupdate
    if (Object.keys(shippingData).length === 0) {
      throw new Error('Tidak ada data yang diubah. Masukkan minimal satu field untuk diperbarui.');
    }

    // Validate shipping data
    validateShippingData(shippingData);
    
    console.log('Mengirim data update ke server:', {
      orderId: id,
      shippingData
    });
    
    // Debugging: tampilkan URL yang akan dipanggil
    if (typeof import.meta.env === 'object' && import.meta.env.VITE_API_BASE_URL) {
      console.log(`API URL: ${import.meta.env.VITE_API_BASE_URL}/api/orders/${id}/details`);
    }
    
    const response = await adminApi.updateOrderDetails(id, shippingData);
    console.log('Response dari server:', response);
    
    if (response.error) {
      console.error('Error response dari server:', response.error);
      throw new Error(response.error);
    }

    // Update local state if successful
    setOrder((prev: Order) => {
      const updated: Order = {
        ...prev,
        shipping_status: normalizedStatus || prev.shipping_status,
        shipping_area: normalizedShippingArea || prev.shipping_area,
        pickup_method: normalizedPickupMethod || prev.pickup_method
      };
      console.log('State order diperbarui:', updated);
      return updated;
    });
    
    setSavedAdminNote(normalizedAdminNote || '');
    
    // Show success notification
    toast({
      title: "Status pesanan berhasil diperbarui",
      description: `Data pesanan berhasil diperbarui`,
      status: "success",
      duration: 3000,
      isClosable: true,
    });
    
  } catch (err: any) {
    console.error('Error saat memperbarui status pesanan:', err);
    
    let errorMessage = 'Terjadi kesalahan pada server';
    
    if (err instanceof Error) {
      errorMessage = err.message;
    } else if (typeof err === 'string') {
      errorMessage = err;
    } else if (err && typeof err === 'object' && err.message) {
      errorMessage = err.message;
    }
    
    toast({
      title: "Gagal memperbarui informasi pesanan",
      description: errorMessage,
      status: "error",
      duration: 5000,
      isClosable: true,
    });
    
  } finally {
    setIsUpdating(false);
  }
};

/**
 * Legacy function signature for backward compatibility
 * @deprecated Use the object parameter version instead
 */
export const handleUpdateStatusLegacy = async (
  id: string,
  shippingStatus?: string,
  adminNote?: string,
  shippingArea?: string,
  pickupMethod?: string,
  adminApi?: AdminApi,
  setIsUpdating?: SetIsUpdatingFunction,
  setOrder?: SetOrderFunction,
  setSavedAdminNote?: SetSavedAdminNoteFunction,
  toast?: CreateToastFnReturn
): Promise<void> => {
  if (!adminApi || !setIsUpdating || !setOrder || !setSavedAdminNote || !toast) {
    throw new Error('All parameters are required for handleUpdateStatus');
  }

  return handleUpdateStatus({
    id,
    shippingStatus,
    adminNote,
    shippingArea,
    pickupMethod,
    adminApi,
    setIsUpdating,
    setOrder,
    setSavedAdminNote,
    toast
  });
};

/**
 * Create a typed version of the update status handler
 * @param adminApi - Admin API instance
 * @returns Partially applied update status handler
 */
export const createUpdateStatusHandler = (adminApi: AdminApi) => {
  return (params: Omit<HandleUpdateStatusParams, 'adminApi'>) => {
    return handleUpdateStatus({ ...params, adminApi });
  };
};

/**
 * Get shipping status display name
 * @param status - Status value
 * @returns Human-readable status name
 */
export const getStatusDisplayName = (status: string): string => {
  const statusNames: Record<string, string> = {
    'dikemas': 'Dikemas',
    'siap kirim': 'Siap Kirim',
    'sedang dikirim': 'Sedang Dikirim',
    'received': 'Diterima'
  };
  
  return statusNames[status] || status;
};

/**
 * Get shipping area display name
 * @param area - Area value
 * @returns Human-readable area name
 */
export const getShippingAreaDisplayName = (area: string): string => {
  const areaNames: Record<string, string> = {
    'dalam-kota': 'Dalam Kota',
    'luar-kota': 'Luar Kota'
  };
  
  return areaNames[area] || area;
};

/**
 * Get pickup method display name
 * @param method - Pickup method value
 * @returns Human-readable method name
 */
export const getPickupMethodDisplayName = (method: string): string => {
  const methodNames: Record<string, string> = {
    'sendiri': 'Ambil Sendiri',
    'ojek-online': 'Ojek Online'
  };
  
  return methodNames[method] || method;
};

/**
 * Check if pickup method is required for shipping area
 * @param shippingArea - Shipping area
 * @returns True if pickup method is required
 */
export const isPickupMethodRequired = (shippingArea?: string): boolean => {
  return shippingArea === 'dalam-kota';
};

export default handleUpdateStatus;
