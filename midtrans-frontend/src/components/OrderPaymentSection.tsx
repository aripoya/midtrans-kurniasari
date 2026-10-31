import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Card,
  CardBody,
  Heading,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import { orderService } from '../api/orderService';
import type { PaymentInstruction, VaBank } from '../api/orderService';
import BankPicker from './BankPicker';
import PaymentInstructionPanel from './PaymentInstructionPanel';

interface OrderPaymentSectionProps {
  orderId: string;
  amount?: number;
  /** Paid orders have nothing left to show, so the section renders nothing */
  isPaid: boolean;
  /** Hide the bank picker for viewers who cannot charge (buyers on the public nota) */
  canSelectBank?: boolean;
}

/**
 * Payment block on the order detail page: the QR or Virtual Account already issued
 * for this order, or the bank choices when the order is still waiting for one.
 */
const OrderPaymentSection: React.FC<OrderPaymentSectionProps> = ({
  orderId,
  amount,
  isPaid,
  canSelectBank = true,
}) => {
  const [payment, setPayment] = useState<PaymentInstruction | null>(null);
  const [banks, setBanks] = useState<VaBank[]>([]);
  const [requiresBankSelection, setRequiresBankSelection] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadPaymentOptions = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await orderService.getPaymentOptions(orderId);
      if (!response.success) {
        throw new Error(response.error || 'Gagal mengambil data pembayaran');
      }
      setPayment(response.payment ?? null);
      setBanks(response.banks ?? []);
      setRequiresBankSelection(!!response.requires_bank_selection);
    } catch (e: any) {
      setError(e?.message || 'Gagal mengambil data pembayaran');
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (isPaid) {
      setIsLoading(false);
      return;
    }
    loadPaymentOptions();
  }, [isPaid, loadPaymentOptions]);

  if (isPaid) return null;

  // Nothing issued and no bank to pick means there is simply nothing to show yet
  if (!isLoading && !error && !payment && !requiresBankSelection) return null;

  return (
    <Card>
      <CardBody>
        <Heading size="md" mb={4}>Pembayaran</Heading>

        {isLoading && (
          <VStack py={4}>
            <Spinner />
            <Text fontSize="sm" color="gray.600">Memuat data pembayaran…</Text>
          </VStack>
        )}

        {!isLoading && error && (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <Text fontSize="sm">{error}</Text>
          </Alert>
        )}

        {!isLoading && !error && payment && (
          <PaymentInstructionPanel instruction={payment} amount={amount} />
        )}

        {!isLoading && !error && !payment && requiresBankSelection && (
          canSelectBank ? (
            <BankPicker orderId={orderId} banks={banks} onCharged={setPayment} />
          ) : (
            <Alert status="info" borderRadius="md">
              <AlertIcon />
              <Text fontSize="sm">
                Nomor Virtual Account belum dibuat. Hubungi admin untuk memilih bank transfer.
              </Text>
            </Alert>
          )
        )}
      </CardBody>
    </Card>
  );
};

export default OrderPaymentSection;
