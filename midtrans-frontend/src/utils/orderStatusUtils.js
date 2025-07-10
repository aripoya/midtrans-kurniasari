/**
 * Utility functions for handling order and shipping statuses
 */

/**
 * Normalizes shipping status to a consistent format
 * Used by both consumer and admin pages
 * @param {string} status - The shipping status from API
 * @returns {string} - Normalized status value
 */
export const normalizeShippingStatus = (status) => {
  if (!status) return "menunggu diproses";
  
  // Lowercase untuk konsistensi perbandingan
  const lowercaseStatus = status.toLowerCase();
  
  // Debug log to identify exact status value being received
  console.log(`[normalizeShippingStatus] Raw input: "${status}", lowercased: "${lowercaseStatus}"`);
  
  if (lowercaseStatus === "received" || 
      lowercaseStatus === "sudah di terima" || 
      lowercaseStatus === "diterima") {
    return "diterima";
  } else if (lowercaseStatus === "sedang dikirim" || 
             lowercaseStatus === "dalam pengiriman" ||
             lowercaseStatus === "dikirim") {
    return "dalam pengiriman";
  } else if (lowercaseStatus === "siap diambil" || 
             lowercaseStatus === "siap dikirim" || 
             lowercaseStatus === "siap kirim" ||
             lowercaseStatus === "siap di ambil") {
    console.log(`[normalizeShippingStatus] Matched siap di ambil -> siap kirim`);
    return "siap kirim";
  } else if (lowercaseStatus === "dikemas" || 
             lowercaseStatus === "diproses") {
    return "dikemas";
  } else {
    return "menunggu diproses";
  }
};

/**
 * Get color and display text for shipping status badge
 * @param {string} status - The shipping status (preferably normalized)
 * @returns {Object} - Badge configuration {color, text}
 */
export const getShippingStatusConfig = (status) => {
  const normalizedStatus = normalizeShippingStatus(status);
  
  const statusConfig = {
    "diterima": { color: "green", text: "Diterima" },
    "dalam pengiriman": { color: "orange", text: "Dalam Pengiriman" },
    "siap kirim": { color: "purple", text: "Siap Kirim" },
    "dikemas": { color: "blue", text: "Dikemas" },
    "menunggu diproses": { color: "gray", text: "Menunggu Diproses" }
  };
  
  return statusConfig[normalizedStatus] || { color: "gray", text: status || "Menunggu Diproses" };
};

/**
 * Get valid shipping status options for admin dropdown
 * @returns {Array} - Array of valid status options
 */
export const getShippingStatusOptions = () => [
  { value: "menunggu diproses", label: "Menunggu Diproses" },
  { value: "dikemas", label: "Dikemas" },
  { value: "siap kirim", label: "Siap Kirim" },
  { value: "dalam pengiriman", label: "Dalam Pengiriman" },
  { value: "diterima", label: "Diterima" }
];
