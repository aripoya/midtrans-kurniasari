import React from 'react';
import { Button, useClipboard, useToast } from '@chakra-ui/react';
import type { ButtonProps } from '@chakra-ui/react';
import { getPublicOrderUrl } from '../utils/publicOrderUrl';

interface CopyOrderLinkButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  orderId?: string | null;
  /** Label before copying; after copying it always reads "Link Tersalin" */
  label?: string;
}

/**
 * Copies the customer-facing nota link so staff can paste it into WhatsApp
 * without hunting through the address bar.
 */
const CopyOrderLinkButton: React.FC<CopyOrderLinkButtonProps> = ({
  orderId,
  label = 'Salin Link Nota',
  ...buttonProps
}) => {
  const url = getPublicOrderUrl(orderId);
  const { onCopy, hasCopied } = useClipboard(url);
  const toast = useToast();

  if (!url) return null;

  const handleCopy = (): void => {
    try {
      onCopy();
      toast({
        title: 'Link nota disalin',
        description: 'Tinggal tempel di WhatsApp pelanggan.',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (e) {
      // Clipboard access can be blocked (in-app browsers, denied permission),
      // so show the link instead of failing silently.
      toast({
        title: 'Gagal menyalin otomatis',
        description: url,
        status: 'warning',
        duration: 9000,
        isClosable: true,
      });
    }
  };

  return (
    <Button onClick={handleCopy} {...buttonProps}>
      {hasCopied ? 'Link Tersalin' : label}
    </Button>
  );
};

export default CopyOrderLinkButton;
