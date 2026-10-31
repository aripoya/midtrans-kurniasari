import React from 'react';
import { Button } from '@chakra-ui/react';
import type { ButtonProps } from '@chakra-ui/react';
import { buildOrderWhatsAppMessage, buildWhatsAppShareUrl } from '../utils/whatsapp';

interface SendWhatsAppButtonProps extends Omit<ButtonProps, 'children'> {
  orderId?: string | null;
  customerName?: string | null;
  /** Customer phone as stored on the order; local format is fine */
  phone?: string | null;
  amount?: number | null;
  label?: string;
}

/**
 * Opens WhatsApp with the nota link already written out, addressed to the
 * customer's own number when the order has one.
 *
 * Rendered as a link rather than a window.open() click handler so mobile
 * browsers hand off to the WhatsApp app instead of blocking a popup.
 */
const SendWhatsAppButton: React.FC<SendWhatsAppButtonProps> = ({
  orderId,
  customerName,
  phone,
  amount,
  label = 'Kirim via WhatsApp',
  ...buttonProps
}) => {
  const id = String(orderId || '').trim();
  if (!id) return null;

  const message = buildOrderWhatsAppMessage({ orderId: id, customerName, amount });
  const href = buildWhatsAppShareUrl(phone, message);

  return (
    <Button as="a" href={href} target="_blank" rel="noopener noreferrer" {...buttonProps}>
      {label}
    </Button>
  );
};

export default SendWhatsAppButton;
