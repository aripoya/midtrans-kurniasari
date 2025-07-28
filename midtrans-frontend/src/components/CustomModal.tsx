import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
} from '@chakra-ui/react';
import React from 'react';
import { FaWhatsapp } from "react-icons/fa";

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

const CustomModal: React.FC<CustomModalProps> = ({
  isOpen,
  onClose,
  title = 'Konfirmasi',
  children,
  onConfirm,
  confirmText = 'OK',
  cancelText = 'Batal',
}) => {

    const shareToWhatsApp = () => {
        const currentUrl = window.location.href;
        const phoneNumber = '6287839131279'; 
        const message = `Halo, Tolong Check Pesanan di ${currentUrl}`;
        const encodedMessage = encodeURIComponent(message);
        const waUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
        window.open(waUrl, '_blank');
    };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>{children}</ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            {cancelText}
          </Button>
            <Button colorScheme="green" onClick={shareToWhatsApp}>
            <FaWhatsapp />
              &nbsp;{confirmText}
            </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CustomModal;
