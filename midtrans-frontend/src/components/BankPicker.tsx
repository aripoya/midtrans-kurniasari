import React, { useState } from 'react';
import { Alert, AlertIcon, Button, SimpleGrid, Text, VStack } from '@chakra-ui/react';
import { orderService } from '../api/orderService';
import type { PaymentInstruction, VaBank } from '../api/orderService';

interface BankPickerProps {
  orderId: string;
  banks: VaBank[];
  /** Called with the instruction once Midtrans has issued the Virtual Account */
  onCharged: (instruction: PaymentInstruction) => void;
  /** Notifies the parent while a charge is in flight, so it can lock its own controls */
  onChargingChange?: (charging: boolean) => void;
}

/**
 * Bank list for orders above the QRIS ceiling. Picking a bank charges the order
 * through the Core API and hands the resulting Virtual Account to the parent.
 */
const BankPicker: React.FC<BankPickerProps> = ({ orderId, banks, onCharged, onChargingChange }) => {
  const [chargingBank, setChargingBank] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelectBank = async (bank: VaBank): Promise<void> => {
    setChargingBank(bank.code);
    onChargingChange?.(true);
    setError(null);
    try {
      const response = await orderService.chargePayment(orderId, bank.code);
      if (!response.success || !response.payment) {
        throw new Error(response.error || 'Gagal membuat nomor Virtual Account');
      }
      onCharged(response.payment);
    } catch (e: any) {
      setError(e?.message || 'Gagal membuat nomor Virtual Account');
    } finally {
      setChargingBank(null);
      onChargingChange?.(false);
    }
  };

  return (
    <VStack spacing={4} align="stretch">
      <Text fontSize="sm" color="gray.600">
        Pesanan ini dibayar lewat Virtual Account. Pilih bank tujuan transfer:
      </Text>

      {error && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <Text fontSize="sm">{error}</Text>
        </Alert>
      )}

      {banks.length === 0 ? (
        <Alert status="warning" borderRadius="md">
          <AlertIcon />
          <Text fontSize="sm">Belum ada bank yang aktif. Hubungi admin.</Text>
        </Alert>
      ) : (
        <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
          {banks.map(bank => (
            <Button
              key={bank.code}
              onClick={() => handleSelectBank(bank)}
              isLoading={chargingBank === bank.code}
              isDisabled={!!chargingBank && chargingBank !== bank.code}
              variant="outline"
              colorScheme="teal"
              size="lg"
              whiteSpace="normal"
              h="auto"
              py={3}
            >
              {bank.name}
            </Button>
          ))}
        </SimpleGrid>
      )}
    </VStack>
  );
};

export default BankPicker;
