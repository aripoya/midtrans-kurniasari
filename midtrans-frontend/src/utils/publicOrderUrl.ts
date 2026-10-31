/**
 * Canonical customer-facing URL of an order's nota.
 *
 * Deliberately not built from window.location.origin: staff often open the app
 * through a preview deployment or a workers.dev host, and a link copied from
 * there would be useless to the customer receiving it on WhatsApp.
 */
const DEFAULT_PUBLIC_BASE_URL = 'https://nota.kurniasari.co.id';

const readBaseUrl = (): string => {
  const configured =
    typeof import.meta.env === 'object' ? import.meta.env.VITE_PUBLIC_BASE_URL : undefined;
  const base = typeof configured === 'string' && configured.trim() ? configured.trim() : DEFAULT_PUBLIC_BASE_URL;
  return base.replace(/\/+$/, '');
};

export const PUBLIC_BASE_URL: string = readBaseUrl();

/**
 * @param orderId - Order id, e.g. ORDER-1787189957619-JOSMT
 * @returns Shareable nota URL, or empty string when there is no order yet
 */
export const getPublicOrderUrl = (orderId?: string | null): string => {
  const id = String(orderId || '').trim();
  return id ? `${PUBLIC_BASE_URL}/orders/${encodeURIComponent(id)}` : '';
};
