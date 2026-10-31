import { getPublicOrderUrl } from './publicOrderUrl';

/**
 * Convert a locally written Indonesian number into the international form
 * wa.me expects (628xxx). Mirrors the normalisation the worker already does
 * when it sends outlet notifications.
 * @param phone - e.g. "087839131279", "+62 878-3913-1279", "87839131279"
 * @returns digits starting with 62, or empty string when there is no number
 */
export const normalizeIndonesianPhone = (phone?: string | null): string => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('62')) return digits;
  return `62${digits}`;
};

const formatRupiah = (value?: number | null): string =>
  `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

/**
 * The message staff send to a customer, with the nota link included.
 */
export const buildOrderWhatsAppMessage = (params: {
  orderId: string;
  customerName?: string | null;
  amount?: number | null;
}): string => {
  const { orderId, customerName, amount } = params;
  const greeting = customerName ? `Halo ${customerName},` : 'Halo,';
  const lines = [
    greeting,
    '',
    'Berikut nota pesanan Anda:',
    getPublicOrderUrl(orderId),
    '',
    `No. Pesanan: ${orderId}`,
  ];
  if (typeof amount === 'number' && amount > 0) {
    lines.push(`Total: ${formatRupiah(amount)}`);
  }
  lines.push('', 'Terima kasih 🙏');
  return lines.join('\n');
};

/**
 * wa.me link that opens a chat with the message ready to send.
 * Without a phone number WhatsApp still opens and lets the sender pick the
 * contact, which is more useful than hiding the button.
 */
export const buildWhatsAppShareUrl = (phone: string | null | undefined, message: string): string => {
  const to = normalizeIndonesianPhone(phone);
  const text = encodeURIComponent(message);
  return to ? `https://wa.me/${to}?text=${text}` : `https://wa.me/?text=${text}`;
};
