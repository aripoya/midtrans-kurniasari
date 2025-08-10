/**
 * Utility functions for handling order and shipping statuses
 */

// TypeScript interfaces for type safety
export interface StatusConfig {
  color: string;
  text: string;
}

export interface StatusOption {
  value: string;
  label: string;
}

// Type for normalized shipping status values
export type NormalizedShippingStatus =
  | "menunggu diproses"
  | "dikemas"
  | "siap kirim"
  | "siap di ambil"
  | "dalam pengiriman"
  | "diterima";

/**
 * Normalizes shipping status to a consistent format
 * Used by both consumer and admin pages
 * @param status - The shipping status from API
 * @returns Normalized status value
 */
export const normalizeShippingStatus = (
  status: string | null | undefined
): NormalizedShippingStatus => {
  if (!status) return "menunggu diproses";

  // Lowercase untuk konsistensi perbandingan
  const lowercaseStatus = status.toLowerCase();

  if (
    lowercaseStatus === "received" ||
    lowercaseStatus === "sudah di terima" ||
    lowercaseStatus === "diterima" ||
    lowercaseStatus === "delivered"
  ) {
    return "diterima";
  } else if (
    lowercaseStatus === "sedang dikirim" ||
    lowercaseStatus === "dalam pengiriman" ||
    lowercaseStatus === "dikirim"
  ) {
    return "dalam pengiriman";
  } else if (
    lowercaseStatus === "siap dikirim" ||
    lowercaseStatus === "siap kirim"
  ) {
    console.log(`[normalizeShippingStatus] Matched -> siap kirim`);
    return "siap kirim";
  } else if (
    lowercaseStatus === "siap diambil" ||
    lowercaseStatus === "siap ambil" ||
    lowercaseStatus === "siap di ambil"
  ) {
    console.log(`[normalizeShippingStatus] Matched -> siap di ambil`);
    return "siap di ambil";
  } else if (lowercaseStatus === "dikemas" || lowercaseStatus === "diproses") {
    return "dikemas";
  } else {
    return "menunggu diproses";
  }
};

/**
 * Get color and display text for shipping status badge
 * @param status - The shipping status (preferably normalized)
 * @returns Badge configuration with color and text
 */
export const getShippingStatusConfig = (
  status: string | null | undefined
): StatusConfig => {
  const normalizedStatus = normalizeShippingStatus(status);

  const statusConfig: Record<NormalizedShippingStatus, StatusConfig> = {
    diterima: { color: "green", text: "Diterima" },
    "dalam pengiriman": { color: "orange", text: "Dalam Pengiriman" },
    "siap kirim": { color: "purple", text: "Siap Kirim" },
    "siap di ambil": { color: "teal", text: "Siap Ambil" },
    dikemas: { color: "blue", text: "Dikemas" },
    "menunggu diproses": { color: "gray", text: "Menunggu Diproses" },
  };

  return (
    statusConfig[normalizedStatus] || {
      color: "gray",
      text: status || "Menunggu Diproses",
    }
  );
};

/**
 * Get valid shipping status options for admin dropdown
 * @returns Array of valid status options with value and label
 */
export const getShippingStatusOptions = (): StatusOption[] => [
  { value: "dikemas", label: "Dikemas" },
  { value: "siap kirim", label: "Siap Kirim" },
  { value: "siap di ambil", label: "Siap Ambil" },
  { value: "dalam pengiriman", label: "Dalam Pengiriman" },
  { value: "diterima", label: "Diterima" },
];

/**
 * Get shipping status options filtered by shipping area
 * For "luar kota" areas, only specific statuses are allowed
 * @param shippingArea - The shipping area (e.g., "LUAR KOTA", "Outlet Bonbin")
 * @returns Array of valid status options for the specific area
 */
export const getShippingStatusOptionsByArea = (shippingArea?: string): StatusOption[] => {
  // Check for "luar-kota" value (exact match from RadioGroup)
  if (shippingArea === 'luar-kota') {
    // For luar kota areas, only return these 3 statuses
    return [
      { value: "siap kirim", label: "Siap Kirim" },
      { value: "dalam pengiriman", label: "Dalam Pengiriman" }, 
      { value: "diterima", label: "Diterima" },
    ];
  }
  
  // For all other areas (dalam-kota, etc.), return all status options
  return getShippingStatusOptions();
};

/**
 * Type guard to check if a string is a valid normalized shipping status
 * @param status - The status to check
 * @returns True if the status is a valid normalized shipping status
 */
export const isNormalizedShippingStatus = (
  status: string
): status is NormalizedShippingStatus => {
  const validStatuses: NormalizedShippingStatus[] = [
    "menunggu diproses",
    "dikemas",
    "siap kirim",
    "siap di ambil",
    "dalam pengiriman",
    "diterima",
  ];
  return validStatuses.includes(status as NormalizedShippingStatus);
};

/**
 * Get the next logical status for order progression
 * @param currentStatus - The current shipping status
 * @returns The next logical status in the order lifecycle
 */
export const getNextStatus = (
  currentStatus: string | null | undefined
): NormalizedShippingStatus => {
  const normalized = normalizeShippingStatus(currentStatus);

  const statusProgression: Record<
    NormalizedShippingStatus,
    NormalizedShippingStatus
  > = {
    "menunggu diproses": "dikemas",
    dikemas: "siap kirim",
    "siap kirim": "dalam pengiriman",
    "siap di ambil": "diterima",
    "dalam pengiriman": "diterima",
    diterima: "diterima", // Final status
  };

  return statusProgression[normalized];
};

/**
 * Check if a status transition is valid
 * @param fromStatus - The current status
 * @param toStatus - The target status
 * @returns True if the transition is valid
 */
export const isValidStatusTransition = (
  fromStatus: string | null | undefined,
  toStatus: string | null | undefined
): boolean => {
  if (!fromStatus || !toStatus) return false;

  const normalizedFrom = normalizeShippingStatus(fromStatus);
  const normalizedTo = normalizeShippingStatus(toStatus);

  // Define valid transitions
  const validTransitions: Record<
    NormalizedShippingStatus,
    NormalizedShippingStatus[]
  > = {
    "menunggu diproses": ["dikemas", "siap kirim", "siap di ambil"],
    dikemas: ["siap kirim", "siap di ambil", "dalam pengiriman"],
    "siap kirim": ["dalam pengiriman", "diterima"],
    "siap di ambil": ["diterima"],
    "dalam pengiriman": ["diterima"],
    diterima: [], // Final status, no further transitions
  };

  return validTransitions[normalizedFrom]?.includes(normalizedTo) || false;
};
