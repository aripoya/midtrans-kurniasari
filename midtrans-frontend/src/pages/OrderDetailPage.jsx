import { useEffect, useState } from 'react';
import { useParams, Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Box, Heading, Text, VStack, HStack, Badge, Button,
  Table, Tbody, Tr, Td, Th, Thead, Divider, Spinner,
  Alert, AlertIcon, Card, CardBody, CardHeader,
  useToast, Flex, Grid, GridItem, Step, StepDescription,
  StepIcon, StepIndicator, StepNumber, StepSeparator,
  StepStatus, StepTitle, Stepper, useBreakpointValue,
  Tag, Container
} from '@chakra-ui/react';
import { orderService } from '../api/orderService';
import { refreshOrderStatus, markOrderAsReceived } from '../api/api';
import { useAuth } from '../auth/AuthContext';
import axios from 'axios';

function OrderDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const auth = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingAsReceived, setIsMarkingAsReceived] = useState(false);
  const toast = useToast();
  const stepperOrientation = useBreakpointValue({ base: 'vertical', md: 'horizontal' });
  const stepperSize = useBreakpointValue({ base: 'sm', md: 'md' });
  
  // Check if this is a public order page (ID starts with ORDER-)
  const isPublicOrderPage = id && id.startsWith('ORDER-');

  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Different fetch approach based on public vs protected route
      let data;
      
      if (isPublicOrderPage) {
        // For public pages, use direct axios call without auth headers
        const apiUrl = import.meta.env.VITE_API_URL || 'https://pesanan.kurniasari.co.id';
        const response = await axios.get(`${apiUrl}/api/orders/${id}`);
        data = response.data;
      } else {
        // For protected pages, use orderService which includes auth
        data = await orderService.getOrderById(id);
      }
      
      if (data.success && data.order) {
        let finalOrder = data.order;
        if (finalOrder.payment_response) {
          try {
            const paymentDetails = JSON.parse(finalOrder.payment_response);
            finalOrder = {
              ...finalOrder,
              payment_method: paymentDetails.payment_type || finalOrder.payment_method,
              payment_time: paymentDetails.settlement_time || finalOrder.payment_time,
              status: paymentDetails.transaction_status || finalOrder.status,
            };
          } catch (e) {
            console.error("Failed to parse payment_response on initial load:", e);
          }
        }
        setOrder(finalOrder);
      } else {
        setError(`Pesanan tidak ditemukan.`);
      }
    } catch (err) {
      setError(`Gagal memuat detail pesanan: ${err.message}.`);
    } finally {
      setLoading(false);
    }
  };

  // Special effect to ensure public order pages never show admin UI
  useEffect(() => {
    if (isPublicOrderPage) {
      // Find and remove admin UI elements if present
      // This ensures clean UI regardless of how the page was accessed
      const adminHeader = document.querySelector('.admin-header');
      const logoutBtn = document.querySelector('.logout-btn');
      
      if (adminHeader) adminHeader.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'none';
      
      // Force public layout by removing any admin elements
      document.querySelectorAll('.admin-element').forEach(el => {
        el.style.display = 'none';
      });
    }
  }, [isPublicOrderPage, location.pathname]);

  useEffect(() => {
    fetchOrder();
  }, [id]);

  useEffect(() => {
    // Auto-refresh status jika ada parameter dari redirect pembayaran
    const searchParams = new URLSearchParams(location.search);
    const shouldRefresh = searchParams.get('refresh') === 'payment' || 
                         searchParams.get('status_code') || 
                         searchParams.get('transaction_status');
    
    if (shouldRefresh && order && !loading) {
      console.log('Auto-refreshing payment status after redirect from payment');
      setTimeout(() => {
        handleRefreshStatus();
      }, 1000); // Delay 1 detik agar UI tidak terlalu cepat
    }
  }, [order, location.search, loading]);

  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    try {
      let data;
      
      if (isPublicOrderPage) {
        // For public pages, use direct axios call
        const apiUrl = import.meta.env.VITE_API_URL || 'https://pesanan.kurniasari.co.id';
        const response = await axios.post(`${apiUrl}/api/orders/${id}/refresh-status`);
        data = response.data;
      } else {
        // For protected pages, use the service with auth
        const response = await refreshOrderStatus(id);
        data = response.data;
      }
      
      if (data.success) {
        await fetchOrder(); // Refetch to get all updated data
        toast({
          title: "Status Diperbarui",
          description: `Status pembayaran sekarang adalah: ${data.payment_status}.`,
          status: "success",
          duration: 5000,
          isClosable: true,
        });
      } else {
        throw new Error(data.error || 'Gagal memperbarui status.');
      }
    } catch (err) {
      toast({
        title: "Gagal Memperbarui",
        description: err.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleMarkAsReceived = async () => {
    setIsMarkingAsReceived(true);
    try {
      let data;
      
      if (isPublicOrderPage) {
        // For public pages, use direct axios call
        const apiUrl = import.meta.env.VITE_API_URL || 'https://pesanan.kurniasari.co.id';
        const response = await axios.post(`${apiUrl}/api/orders/${id}/received`);
        data = response.data;
      } else {
        // For protected pages, use the service with auth
        const response = await markOrderAsReceived(id);
        data = response.data;
      }
      
      if (data.success) {
        await fetchOrder(); // Refetch to get all updated data
        toast({
          title: "Pesanan Diterima",
          description: "Status pesanan berhasil diperbarui menjadi 'Sudah Diterima'.",
          status: "success",
          duration: 5000,
          isClosable: true,
        });
      } else {
        throw new Error(data.error || 'Gagal memperbarui status pesanan.');
      }
    } catch (err) {
      toast({
        title: "Gagal Memperbarui",
        description: err.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsMarkingAsReceived(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { scheme: 'yellow', text: 'Menunggu Pembayaran' },
      paid: { scheme: 'green', text: 'Dibayar' },
      settlement: { scheme: 'green', text: 'Dibayar' },
      capture: { scheme: 'green', text: 'Dibayar' },
      cancel: { scheme: 'red', text: 'Dibatalkan' },
      deny: { scheme: 'red', text: 'Ditolak' },
      expire: { scheme: 'red', text: 'Kedaluwarsa' },
      refund: { scheme: 'purple', text: 'Dikembalikan' },
      partial_refund: { scheme: 'purple', text: 'Dikembalikan Sebagian' },
    };
    const { scheme = 'gray', text = 'Tidak Diketahui' } = statusMap[status] || {};
    return <Badge colorScheme={scheme}>{text}</Badge>;
  };

  const getPaymentSteps = () => {
    const steps = [
      { title: 'Pemesanan', description: 'Pesanan dibuat' },
      { title: 'Pembayaran', description: 'Menunggu pembayaran' },
      { title: 'Pengiriman', description: 'Pesanan diproses' },
      { title: 'Selesai', description: 'Pesanan diterima' },
    ];

    if (!order) return { steps, activeStep: 0 };

    let activeStep = 0;
    const paymentStatus = order.payment_status || order.status;
    const shippingStatus = order.shipping_status;

    if (['paid', 'settlement', 'capture'].includes(paymentStatus)) {
      activeStep = 2;
      steps[1].description = 'Pembayaran berhasil';
      if (['shipped', 'delivered', 'received', 'Sudah Di Terima', 'Sudah Di Ambil'].includes(shippingStatus)) {
        activeStep = 3;
        steps[2].description = 'Pesanan dikirim';
        if (['received', 'Sudah Di Terima', 'Sudah Di Ambil'].includes(shippingStatus)) {
          activeStep = 4;
          steps[3].description = 'Pesanan telah diterima';
        }
      }
    } else if (paymentStatus === 'pending') {
      activeStep = 1;
    } else {
      activeStep = 1; 
      steps[1].description = 'Pembayaran Gagal';
    }

    return { steps, activeStep };
  };

  if (loading) {
    return <Flex justify="center" align="center" h="100vh"><Spinner size="xl" /></Flex>;
  }

  if (error) {
    return <Alert status="error"><AlertIcon />{error}</Alert>;
  }

  if (!order) {
    return <Alert status="warning"><AlertIcon />Pesanan tidak dapat ditemukan.</Alert>;
  }

  const { steps, activeStep } = getPaymentSteps();
  const isPaid = ['paid', 'settlement', 'capture'].includes(order.payment_status);
  const isReceived = order.shipping_status === 'received';

  return (
    <Container maxW="container.lg" py={8}>
      <VStack spacing={6} align="stretch">
        <Card>
          <CardHeader>
            <Flex justify="space-between" align="center">
              <Heading size="md">Detail Pesanan #{order.id.substring(0, 8)}</Heading>
            </Flex>
          </CardHeader>
          <CardBody>
            <Stepper index={activeStep} orientation={stepperOrientation} colorScheme="green" size={stepperSize} mb={8}>
              {steps.map((step, index) => (
                <Step key={index}>
                  <StepIndicator>
                    <StepStatus complete={<StepIcon />} incomplete={<StepNumber />} active={<StepNumber />} />
                  </StepIndicator>
                  <Box flexShrink='0'>
                    <StepTitle>{step.title}</StepTitle>
                    <StepDescription>{step.description}</StepDescription>
                  </Box>
                  <StepSeparator />
                </Step>
              ))}
            </Stepper>
            
            <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={6}>
              <GridItem>
                <Heading size="sm" mb={4}>Informasi Pelanggan</Heading>
                <Text><strong>Nama:</strong> {order.customer_name}</Text>
                <Text><strong>Email:</strong> {order.customer_email}</Text>
                <Text><strong>Telepon:</strong> {order.customer_phone}</Text>
                {order.customer_address && (
                  <Text whiteSpace="pre-wrap"><strong>Alamat:</strong> {order.customer_address}</Text>
                )}
              </GridItem>
              <GridItem>
                <Heading size="sm" mb={4}>Detail Pembayaran</Heading>
                <Text><strong>Total:</strong> Rp {order.total_amount?.toLocaleString('id-ID')}</Text>
                <Text><strong>Status:</strong> {getStatusBadge(order.payment_status)}</Text>
                <Text><strong>Metode:</strong> <Tag>{order.payment_method || 'N/A'}</Tag></Text>
              </GridItem>
            </Grid>

            <Divider my={6} />

            <Heading size="sm" mb={4}>Barang Pesanan</Heading>
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Produk</Th>
                  <Th isNumeric>Jumlah</Th>
                  <Th isNumeric>Harga</Th>
                </Tr>
              </Thead>
              <Tbody>
                {order.items && order.items.map((item, index) => (
                  <Tr key={index}>
                    <Td>{item.product_name}</Td>
                    <Td isNumeric>{item.quantity}</Td>
                    <Td isNumeric>Rp {item.product_price?.toLocaleString('id-ID')}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>

            <Divider my={6} />
            
            <HStack spacing={4} justify="center">
              {!isPaid && order.payment_url && (
                <Button as="a" href={order.payment_url} target="_blank" colorScheme="teal" size="lg">
                  Lanjutkan Pembayaran
                </Button>
              )}
              <Button onClick={handleRefreshStatus} isLoading={isRefreshing} variant="outline">
                Perbarui Status
              </Button>
              {isPaid && !isReceived && (
                <Button onClick={handleMarkAsReceived} isLoading={isMarkingAsReceived} colorScheme="green">
                  Pesanan Sudah Diterima
                </Button>
              )}
            </HStack>
          </CardBody>
        </Card>
      </VStack>
    </Container>
  );
}

export default OrderDetailPage;
