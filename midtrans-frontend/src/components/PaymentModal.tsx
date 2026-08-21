import React, { useEffect, useState } from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from '@chakra-ui/react';
import type { PaymentInstruction, VaBank } from '../api/orderService';
import BankPicker from './BankPicker';
import PaymentInstructionPanel from './PaymentInstructionPanel';

interface PaymentModalProps {
  isOpen: boolean;
  orderId: string;
  amount?: number;
  /** Set when the order was already charged (QRIS), otherwise the buyer picks a bank */
  initialPayment?: PaymentInstruction | null;
  banks?: VaBank[];
  /** Called when the modal is dismissed - the caller decides where to go next */
  onClose: () => void;
}

/**
 * Shows how to pay an order right after it is created.
 *
 * Orders up to the QRIS ceiling arrive here already charged, so the QR is shown
 * straight away. Bigger orders arrive with a bank list: picking one issues the
 * Virtual Account and swaps the modal over to the instruction.
 */
const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  orderId,
  amount,
  initialPayment,
  banks = [],
  onClose,
}) => {
  const [payment, setPayment] = useState<PaymentInstruction | null>(initialPayment ?? null);
  const [isCharging, setIsCharging] = useState<boolean>(false);

  useEffect(() => {
    setPayment(initialPayment ?? null);
    setIsCharging(false);
  }, [initialPayment, orderId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" closeOnOverlayClick={!isCharging} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{payment ? 'Pembayaran' : 'Pilih Bank Transfer'}</ModalHeader>
        <ModalCloseButton isDisabled={isCharging} />
        <ModalBody>
          {payment ? (
            <PaymentInstructionPanel instruction={payment} amount={amount} />
          ) : (
            <BankPicker
              orderId={orderId}
              banks={banks}
              onCharged={setPayment}
              onChargingChange={setIsCharging}
            />
          )}
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose} isDisabled={isCharging} colorScheme={payment ? 'teal' : 'gray'}>
            {payment ? 'Lihat Nota' : 'Nanti Saja'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default PaymentModal;
