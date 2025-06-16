import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Modal, ModalOverlay, ModalContent, ModalHeader,
  ModalBody, ModalFooter, Button, Text, VStack,
  Spinner, Alert, AlertIcon, AlertTitle, AlertDescription,
  useToast
} from '@chakra-ui/react';
import { orderService } from '../api/orderService';
import { openMidtransSnap, loadMidtransScript } from '../utils/midtransHelper';

/**
 * PaymentProcessor component to handle Midtrans payment processing
 * This component will show a modal during payment process and handle
 * success/failure after payment
 * 
 * Usage:
 * <PaymentProcessor 
 *   isOpen={isPaymentOpen}
 *   onClose={closePayment}
 *   orderData={newOrderData}
 *   snapToken={snapToken}
 * />
 */
function PaymentProcessor({ isOpen, onClose, orderData, snapToken, onSuccess }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();

  // Load the Midtrans script when modal opens
  useEffect(() => {
    if (isOpen) {
      loadMidtransScript()
        .then(() => {
          setLoading(false);
          if (snapToken) {
            // Auto-start payment if token is provided
            startPayment();
          }
        })
        .catch(err => {
          console.error('Failed to load Midtrans script:', err);
          setError('Gagal memuat Midtrans. Silakan coba lagi nanti.');
          setLoading(false);
        });
    }
  }, [isOpen, snapToken]);

  // Function to handle starting the payment
  const startPayment = useCallback(async () => {
    if (!snapToken || !window.snap) {
      setError('Token pembayaran tidak valid atau Midtrans belum siap');
      return;
    }

    try {
      setLoading(true);
      
      const result = await openMidtransSnap(snapToken, {
        onSuccess: async function(result) {
          console.log('Payment success:', result);
          
          try {
            // Verify payment status with backend
            if (orderData?.id) {
              await orderService.checkTransactionStatus(orderData.id);
            }
            
            setPaymentResult({
              success: true,
              message: 'Pembayaran berhasil!',
              data: result
            });
            
            if (onSuccess) {
              onSuccess(result);
            }
          } catch (error) {
            console.error('Error verifying payment status:', error);
            // Still mark payment as successful even if verification fails
            setPaymentResult({
              success: true,
              message: 'Pembayaran berhasil, tetapi verifikasi status gagal.',
              data: result
            });
          }
        },
        onPending: function(result) {
          console.log('Payment pending:', result);
          setPaymentResult({
            success: true,
            pending: true,
            message: 'Pembayaran dalam proses!',
            data: result
          });
        },
        onError: function(result) {
          console.error('Payment error:', result);
          setPaymentResult({
            success: false,
            message: 'Pembayaran gagal!',
            data: result
          });
        },
        onClose: function() {
          // User closed the payment popup without completing payment
          console.log('Payment popup closed without completing');
          setLoading(false);
        }
      });
      
    } catch (error) {
      console.error('Error processing payment:', error);
      setError('Terjadi kesalahan saat memproses pembayaran');
    } finally {
      setLoading(false);
    }
  }, [snapToken, orderData, onSuccess]);

  // View order details after payment process
  const viewOrderDetails = () => {
    onClose();
    if (orderData?.id) {
      navigate(`/orders/${orderData.id}`);
    } else {
      navigate('/orders');
    }
  };

  // Try payment again
  const retryPayment = () => {
    setError(null);
    setPaymentResult(null);
    setLoading(true);
    startPayment();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} closeOnOverlayClick={false} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Proses Pembayaran</ModalHeader>
        <ModalBody>
          {loading ? (
            <VStack spacing={4} py={4}>
              <Spinner size="xl" />
              <Text>Mempersiapkan pembayaran...</Text>
            </VStack>
          ) : error ? (
            <Alert status="error">
              <AlertIcon />
              <AlertTitle>Error!</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : paymentResult ? (
            <Alert 
              status={paymentResult.success ? (paymentResult.pending ? 'warning' : 'success') : 'error'}
              variant="subtle"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              textAlign="center"
              height="200px"
            >
              <AlertIcon boxSize="40px" mr={0} />
              <AlertTitle mt={4} mb={1} fontSize="lg">
                {paymentResult.success 
                  ? (paymentResult.pending ? 'Pembayaran dalam proses!' : 'Pembayaran Berhasil!') 
                  : 'Pembayaran Gagal!'}
              </AlertTitle>
              <AlertDescription maxWidth="sm">
                {paymentResult.message}
                {paymentResult.pending && (
                  <Text mt={2}>
                    Silakan selesaikan pembayaran Anda dan status akan diperbarui secara otomatis.
                  </Text>
                )}
              </AlertDescription>
            </Alert>
          ) : snapToken ? (
            <VStack spacing={4} py={4}>
              <Text>Klik tombol di bawah untuk memulai pembayaran dengan Midtrans</Text>
              <Button colorScheme="teal" onClick={startPayment}>
                Bayar Sekarang
              </Button>
            </VStack>
          ) : (
            <Alert status="warning">
              <AlertIcon />
              <AlertTitle>Tidak ada token pembayaran!</AlertTitle>
              <AlertDescription>Token pembayaran tidak tersedia. Silakan coba lagi dengan membuat pesanan baru.</AlertDescription>
            </Alert>
          )}
        </ModalBody>

        <ModalFooter>
          {paymentResult ? (
            <>
              <Button variant="ghost" mr={3} onClick={onClose}>
                Tutup
              </Button>
              <Button colorScheme="blue" onClick={viewOrderDetails}>
                Lihat Detail Pesanan
              </Button>
            </>
          ) : error ? (
            <>
              <Button variant="ghost" mr={3} onClick={onClose}>
                Batal
              </Button>
              <Button colorScheme="blue" onClick={retryPayment}>
                Coba Lagi
              </Button>
            </>
          ) : (
            <Button variant="ghost" mr={3} onClick={onClose} isDisabled={loading}>
              Batal
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export default PaymentProcessor;
