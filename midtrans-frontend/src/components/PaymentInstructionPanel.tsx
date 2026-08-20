import React from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  HStack,
  Image,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  useClipboard,
  useToast,
  VStack,
} from '@chakra-ui/react';
import type { PaymentInstruction } from '../api/orderService';

interface PaymentInstructionPanelProps {
  instruction: PaymentInstruction;
  /** Order total, shown above the instruction when provided */
  amount?: number;
}

const formatRupiah = (value: number): string => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

const formatExpiry = (expiry?: string | null): string | null => {
  if (!expiry) return null;
  // Midtrans sends "2026-08-10 21:30:00" (WIB), which Safari refuses to parse with Date()
  const parsed = new Date(expiry.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return expiry;
  return parsed.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

/** A number the buyer has to type into their banking app, with a copy button */
const CopyableCode: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const { onCopy, hasCopied } = useClipboard(value);
  const toast = useToast();

  const handleCopy = () => {
    onCopy();
    toast({ title: `${label} disalin`, status: 'success', duration: 1500, isClosable: true });
  };

  return (
    <Box w="100%" borderWidth="1px" borderRadius="md" p={3}>
      <Text fontSize="sm" color="gray.600">{label}</Text>
      <HStack justify="space-between" mt={1} spacing={3}>
        <Text fontSize="xl" fontWeight="bold" letterSpacing="wide" wordBreak="break-all">
          {value}
        </Text>
        <Button size="sm" onClick={handleCopy} flexShrink={0}>
          {hasCopied ? 'Tersalin' : 'Salin'}
        </Button>
      </HStack>
    </Box>
  );
};

/**
 * Renders what the buyer needs to pay: a QRIS code to scan, a Virtual Account
 * number, or a Mandiri bill payment code.
 */
const PaymentInstructionPanel: React.FC<PaymentInstructionPanelProps> = ({ instruction, amount }) => {
  const expiry = formatExpiry(instruction.expiry_time);

  return (
    <VStack spacing={4} align="stretch">
      {typeof amount === 'number' && (
        <Stat>
          <StatLabel>Total pembayaran</StatLabel>
          <StatNumber>{formatRupiah(amount)}</StatNumber>
        </Stat>
      )}

      {instruction.type === 'qris' && (
        <VStack spacing={3}>
          <Badge colorScheme="purple" fontSize="sm">QRIS</Badge>
          {instruction.qr_url ? (
            <Image
              src={instruction.qr_url}
              alt="Kode QRIS pembayaran"
              maxW="280px"
              w="100%"
              borderWidth="1px"
              borderRadius="md"
              p={2}
              bg="white"
            />
          ) : (
            <Alert status="warning" borderRadius="md">
              <AlertIcon />
              Kode QR belum tersedia. Coba muat ulang halaman nota.
            </Alert>
          )}
          <Text fontSize="sm" color="gray.600" textAlign="center">
            Scan dengan aplikasi bank atau e-wallet apa pun yang mendukung QRIS.
          </Text>
        </VStack>
      )}

      {instruction.type === 'bank_transfer' && (
        <VStack spacing={3} align="stretch">
          <Badge colorScheme="teal" fontSize="sm" alignSelf="flex-start">
            {instruction.bank_name || 'Virtual Account'}
          </Badge>
          <CopyableCode label="Nomor Virtual Account" value={instruction.va_number || '-'} />
          <Text fontSize="sm" color="gray.600">
            Bayar lewat ATM, m-banking, atau internet banking {instruction.bank_name || ''} ke nomor
            Virtual Account di atas. Status pesanan diperbarui otomatis setelah pembayaran masuk.
          </Text>
        </VStack>
      )}

      {instruction.type === 'echannel' && (
        <VStack spacing={3} align="stretch">
          <Badge colorScheme="yellow" fontSize="sm" alignSelf="flex-start">Bank Mandiri</Badge>
          <CopyableCode label="Kode Perusahaan (Biller Code)" value={instruction.biller_code || '-'} />
          <CopyableCode label="Kode Bayar (Bill Key)" value={instruction.bill_key || '-'} />
          <Text fontSize="sm" color="gray.600">
            Buka Mandiri Livin' atau ATM Mandiri, pilih Bayar &gt; Multipayment, lalu masukkan kode di atas.
          </Text>
        </VStack>
      )}

      {expiry && (
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          <Text fontSize="sm">Bayar sebelum {expiry}</Text>
        </Alert>
      )}
    </VStack>
  );
};

export default PaymentInstructionPanel;
