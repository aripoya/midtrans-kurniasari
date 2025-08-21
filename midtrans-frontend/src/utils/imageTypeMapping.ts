/**
 * Centralized image type mapping utilities for shipping images
 * Handles conversion between backend and frontend image type formats
 */

export interface UploadedImages {
  readyForPickup: string | null;
  pickedUp: string | null;
  received: string | null;
  shipmentProof: string | null;
  packagedProduct: string | null;
}

/**
 * Maps backend image types to frontend keys
 */
export const mapBackendToFrontendFormat = (backendType: string): keyof UploadedImages | null => {
  const typeMapping: Record<string, keyof UploadedImages> = {
    // English types (found in production database)
    'ready_for_pickup': 'readyForPickup',
    'picked_up': 'pickedUp', 
    'delivered': 'received',
    'shipment_proof': 'shipmentProof',
    'packaged_product': 'packagedProduct',
    // Indonesian types (from delivery dashboard)
    'siap_kirim': 'readyForPickup',
    'pengiriman': 'pickedUp',
    'diterima': 'received',
    'produk_dikemas': 'packagedProduct',
    // Additional possible delivery success types
    'delivery_success': 'received',
    'sukses_kirim': 'received',
    'berhasil_kirim': 'received',
    'selesai': 'received'
  };
  
  console.log(`🔗 [MAPPING] Backend type: "${backendType}" → Frontend key: "${typeMapping[backendType] || 'NULL'}"`);
  return typeMapping[backendType] || null;
};

/**
 * Maps frontend type keys to backend type keys
 */
export const mapFrontendToBackendFormat = (frontendType: keyof UploadedImages): string => {
  const typeMapping: Record<keyof UploadedImages, string> = {
    'readyForPickup': 'ready_for_pickup',
    'pickedUp': 'picked_up',
    'received': 'delivered',
    'shipmentProof': 'shipment_proof',
    'packagedProduct': 'packaged_product'
  };
  
  return typeMapping[frontendType] || frontendType;
};

/**
 * Gets display label for frontend image type
 */
export const getImageTypeDisplayLabel = (frontendType: keyof UploadedImages): string => {
  const labelMapping: Record<keyof UploadedImages, string> = {
    'readyForPickup': 'Siap Kirim',
    'pickedUp': 'Sedang Dikirim',
    'received': 'Diterima',
    'shipmentProof': 'Bukti Pengiriman',
    'packagedProduct': 'Produk Dikemas'
  };
  
  return labelMapping[frontendType] || frontendType;
};

/**
 * Validates if an image type is valid for upload by admin
 */
export const isAdminUploadAllowed = (
  frontendType: keyof UploadedImages, 
  shippingArea: string, 
  shippingStatus: string
): boolean => {
  const isLuarKota = shippingArea === 'luar-kota';
  
  // For luar kota orders: allow upload of packagedProduct and pickedUp
  if (isLuarKota && (frontendType === 'packagedProduct' || frontendType === 'pickedUp')) {
    return true;
  }
  
  // Legacy: Admin can upload shipmentProof for orders with siap kirim status
  if (frontendType === 'shipmentProof') {
    return shippingStatus === 'siap kirim';
  }
  
  return false;
};
