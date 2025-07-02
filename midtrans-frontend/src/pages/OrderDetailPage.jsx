import { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Box, Heading, Text, VStack, HStack, Badge, Button,
  Table, Tbody, Tr, Td, Th, Thead, Divider, Spinner,
  Alert, AlertIcon, AlertTitle, Card, CardBody, CardHeader,
  Stat, StatLabel, StatNumber, StatGroup, useToast,
  Icon, Flex, Image, Grid, GridItem, Step, StepDescription,
  StepIcon, StepIndicator, StepNumber, StepSeparator,
  StepStatus, StepTitle, Stepper, useBreakpointValue,
  Tag, Container, Select, FormControl, FormLabel
} from '@chakra-ui/react';
import { orderService } from '../api/orderService';
import { updateOrderStatus } from '../api/api';

function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();
  // Setting stepper orientation based on screen size - pindah ke awal komponen
  const stepperOrientation = useBreakpointValue({ base: 'vertical', md: 'horizontal' });
  const stepperSize = useBreakpointValue({ base: 'sm', md: 'md' });
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [id]);

  useEffect(() => {
    if (order && order.shipping_status) {
      setSelectedStatus(order.shipping_status);
    }
  }, [order]);
  
  // Debug: Log struktur items jika order ada
  useEffect(() => {
    if (order && order.items) {
      console.log('🧩 Detail struktur items array:', order.items);
      console.log('🧩 Sample item 0:', order.items[0]);
      // Cek properti yang ada di item pertama
      if (order.items[0]) {
        console.log('🔑 Keys in first item:', Object.keys(order.items[0]));
      }
    }
  }, [order]);

  const fetchOrder = async () => {
    try {
      console.log('🔄 Fetching order details for ID:', id);
      setLoading(true);
      setError(null);
      const data = await orderService.getOrderById(id);
      console.log('📦 Order API Response:', data);
      
      if (data.success && data.order) {
        console.log('✅ Order found:', data.order);
        let finalOrder = data.order;
        // If payment_response exists, parse it to populate derived fields for consistent UI
        if (finalOrder.payment_response) {
          try {
            const paymentDetails = JSON.parse(finalOrder.payment_response);
            finalOrder = {
              ...finalOrder,
              payment_method: paymentDetails.payment_type || finalOrder.payment_method,
              payment_time: paymentDetails.settlement_time || finalOrder.payment_time,
              status: paymentDetails.transaction_status || finalOrder.status, // Midtrans status
            };
            console.log('📦 Order after parsing payment_response:', finalOrder);
          } catch (e) {
            console.error("Failed to parse payment_response on initial load:", e);
          }
        }
        setOrder(finalOrder);
      } else {
        console.error('⚠️ Order not found in response:', data);
        setError(`Pesanan tidak ditemukan. Response: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      console.error('❌ Error fetching order details:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      setError(`Gagal memuat detail pesanan: ${error.message}. Silakan coba lagi nanti.`);
    } finally {
      setLoading(false);
    }
  };

  const refreshStatus = async () => {
    try {
      setRefreshing(true);
      const newStatus = await orderService.checkTransactionStatus(id);
      console.log('[UI] Received new status from backend:', JSON.stringify(newStatus, null, 2));
      
      // The backend now sends our internal `payment_status`
      const currentInternalStatus = order.payment_status;
      const newInternalStatus = newStatus.payment_status;

      console.log(`[UI] Comparing statuses: Current='${currentInternalStatus}', New='${newInternalStatus}'`);

      // Explicitly map fields from the API response to our component's state.
      // This is the correct way to handle potential discrepancies in property names.
      setOrder(prevOrder => {
        const updatedOrder = {
          ...prevOrder,
          payment_status: newStatus.payment_status, // e.g., 'paid'
          status: newStatus.transaction_status, // e.g., 'settlement'
          payment_method: newStatus.payment_type, // e.g., 'qris'
          payment_time: newStatus.settlement_time, // e.g., '2025-07-02 09:59:53'
          payment_response: JSON.stringify(newStatus), // for debugging
        };
        console.log('[UI] Manually mapped and updated order state:', updatedOrder);
        return updatedOrder;
      });

      // Provide feedback to the user based on whether the status text actually changed.
      if (newInternalStatus && newInternalStatus !== currentInternalStatus) {
        toast({
          title: 'Status berhasil diperbarui',
          description: `Status pembayaran sekarang: ${newInternalStatus}.`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Status sudah yang terbaru',
          description: `Status pembayaran sudah ${newInternalStatus}.`,
          status: 'info',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('[UI] Error refreshing status:', error);
      toast({
        title: 'Gagal memperbarui status',
        description: error.response?.data?.error || error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedStatus || selectedStatus === order.shipping_status) {
      toast({
        title: 'Tidak ada perubahan',
        description: 'Status yang dipilih sama dengan status saat ini.',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsUpdatingStatus(true);
    try {
      await updateOrderStatus(id, selectedStatus);
      toast({
        title: 'Status Berhasil Diupdate',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      // Refresh order data to show the latest status
      await fetchOrder(); 
    } catch (err) {
      console.error('Failed to update status:', err);
      toast({
        title: 'Gagal Mengupdate Status',
        description: err.response?.data?.error || err.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <Badge colorScheme="yellow" display="flex" alignItems="center" px={2} py={1}>
            ⏱️ Menunggu Pembayaran
          </Badge>
        );
      case 'paid':
      case 'settlement':
      case 'capture':
        return (
          <Badge colorScheme="green" display="flex" alignItems="center" px={2} py={1}>
            ✅ Dibayar
          </Badge>
        );
      case 'cancel':
      case 'deny':
        return (
          <Badge colorScheme="red" display="flex" alignItems="center" px={2} py={1}>
            ❌ Dibatalkan
          </Badge>
        );
      case 'expire':
        return (
          <Badge colorScheme="red" display="flex" alignItems="center" px={2} py={1}>
            ⏰ Kedaluwarsa
          </Badge>
        );
      case 'refund':
      case 'partial_refund':
        return (
          <Badge colorScheme="purple" display="flex" alignItems="center" px={2} py={1}>
            🔄 Dikembalikan
          </Badge>
        );
      default:
        return (
          <Badge display="flex" alignItems="center" px={2} py={1}>
            ℹ️ Tidak Diketahui
          </Badge>
        );
    }
  };

  const getPaymentSteps = () => {
    const steps = [
      { title: 'Pemesanan', description: 'Pesanan dibuat' },
      { title: 'Pembayaran', description: 'Menunggu pembayaran' },
      { title: 'Pengiriman', description: 'Pesanan sedang diproses' },
      { title: 'Selesai', description: 'Pesanan telah diterima' },
    ];

    let activeStep = 0;
    if (!order) return { steps, activeStep };

    const paymentStatus = order.payment_status || order.status;

    // 1. Payment Status Logic
    if (paymentStatus === 'pending') {
      activeStep = 1;
    } else if (['paid', 'settlement', 'capture'].includes(paymentStatus)) {
      activeStep = 2; // Default to step 2 after payment
      steps[1].description = 'Pembayaran berhasil';
    } else if (['cancel', 'deny', 'expire', 'failed'].includes(paymentStatus)) {
      activeStep = 1; // Stuck at payment step
      steps[1].description = 'Pembayaran Gagal';
      return { steps, activeStep }; // Stop further evaluation if payment failed
    }

    // 2. Shipping Status Logic (only if payment is successful)
    if (activeStep >= 2) {
      const shippingStatus = order.shipping_status;
      if (['di kemas', 'siap kirim', 'siap ambil'].includes(shippingStatus)) {
        activeStep = 2;
        steps[2].description = `Status: ${shippingStatus}`;
      } else if (shippingStatus === 'sedang dikirim') {
        activeStep = 2;
        steps[2].description = 'Pesanan dalam perjalanan';
      } else if (['Sudah Di Terima', 'Sudah Di Ambil'].includes(shippingStatus)) {
        activeStep = 4; // Set to 4 to mark the last step (index 3) as complete
        steps[2].description = 'Pesanan telah dikirim';
        steps[3].description = `Status: ${shippingStatus}`;
      }
    }

    return { steps, activeStep };
  };

  const getPaymentIcon = (method) => {
    if (!method) return null;
    const methodLower = method.toLowerCase();
    if (methodLower.includes('qris')) return <Tag colorScheme="orange">QRIS</Tag>;
    if (methodLower.includes('card')) return <Tag colorScheme="purple">Credit Card</Tag>;
    return <Tag>{method}</Tag>;
  };

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
        <Text mt={4}>Memuat detail pesanan...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert status="error">
        <AlertIcon />
        <AlertTitle>{error}</AlertTitle>
      </Alert>
    );
  }

  const { steps, activeStep } = getPaymentSteps();

  if (!order) {
    return (
      <Alert status="warning">
        <AlertIcon />
        <AlertTitle>Pesanan tidak ditemukan</AlertTitle>
        <Button as={RouterLink} to="/orders" ml={4} colorScheme="blue">
          Kembali ke Daftar Pesanan
        </Button>
      </Alert>
    );
  }

  return (
    <Container maxW="container.xl" p={4}>
      <Card mb={8} overflow="hidden">
        <CardHeader bg="blue.50" py={4}>
          <HStack justify="space-between" wrap="wrap">
            <VStack align="start" spacing={1}>
              <HStack>
                <Heading size="lg">Pesanan #{order.id.substring(0, 8)}...</Heading>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(order.id);
                    toast({
                      title: "ID Disalin",
                      status: "success",
                      duration: 2000,
                    });
                  }}
                >
                  📋 Salin ID
                </Button>
              </HStack>
              <Text color="gray.600">Dibuat pada {new Date(order.created_at).toLocaleString('id-ID')}</Text>
            </VStack>
            
            <HStack mt={{base: 4, md: 0}}>
              <Button 
                as={RouterLink} 
                to="/orders" 
                variant="outline"
              >
                📋 Daftar Pesanan
              </Button>
              <Button 
                colorScheme="blue" 
                onClick={refreshStatus} 
                isLoading={refreshing}
                loadingText="Memperbarui..."
              >
                🔄 Perbarui Status
              </Button>
            </HStack>
          </HStack>
        </CardHeader>
        
        <CardBody pt={6}>
          {/* Timeline Status Pesanan */}
          <Box mb={8}>
            <Stepper index={activeStep} orientation={stepperOrientation} colorScheme="green" size={stepperSize}>
              {steps.map((step, index) => (
                <Step key={index}>
                  <StepIndicator>
                    <StepStatus
                      complete={<StepIcon />}
                      incomplete={<StepNumber />}
                      active={<StepNumber />}
                    />
                  </StepIndicator>
                  <Box flexShrink='0'>
                    <StepTitle>{step.title}</StepTitle>
                    <StepDescription>{step.description}</StepDescription>
                  </Box>
                  <StepSeparator />
                </Step>
              ))}
            </Stepper>

            {/* --- Admin: Update Shipping Status --- */}
            <Card variant="outline" w="100%">
              <CardBody>
                <FormControl>
                  <FormLabel htmlFor="shipping-status">Update Status Pengiriman</FormLabel>
                  <HStack>
                    <Select 
                      id="shipping-status"
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                    >
                      <option value="di kemas">Di Kemas</option>
                      <option value="siap kirim">Siap Kirim</option>
                      <option value="siap ambil">Siap Ambil</option>
                      <option value="sedang dikirim">Sedang Dikirim</option>
                      <option value="Sudah Di Terima">Sudah Di Terima</option>
                      <option value="Sudah Di Ambil">Sudah Di Ambil</option>
                    </Select>
                    <Button
                      onClick={handleStatusUpdate}
                      isLoading={isUpdatingStatus}
                      colorScheme="blue"
                    >
                      Update
                    </Button>
                  </HStack>
                </FormControl>
              </CardBody>
            </Card>
          </Box>

          <VStack spacing={6} align="stretch">
            <Card bg="white" variant="outline" borderWidth="1px">
              <CardBody>
                <StatGroup flexDirection={{ base: 'column', md: 'row' }} gap={{ base: 4, md: 0 }}>
                  <Stat>
                    <StatLabel>Status Pembayaran</StatLabel>
                    <StatNumber>{getStatusBadge(order.payment_status)}</StatNumber>
                  </Stat>
                  
                  <Stat>
                    <StatLabel>Total Pembayaran</StatLabel>
                    <StatNumber>Rp {order.total_amount?.toLocaleString('id-ID')}</StatNumber>
                  </Stat>
                  
                  <Stat>
                    <StatLabel>Metode Pembayaran</StatLabel>
                    <StatNumber>{getPaymentIcon(order.payment_method) || 'Belum dipilih'}</StatNumber>
                  </Stat>
                </StatGroup>
                
                {order.payment_url && order.status === 'pending' && (
                  <Button
                    colorScheme="teal"
                    size="lg"
                    mt={4}
                    w="100%"
                    onClick={() => window.open(order.payment_url, '_blank')}
                  >
                    💳 Bayar Sekarang
                  </Button>
                )}
              </CardBody>
            </Card>
            
            <Card variant="outline" borderWidth="1px">
              <CardBody>
                <Heading size="md" mb={4}>Informasi Pelanggan</Heading>
                <Box display={{ base: 'block', md: 'none' }}>
                  <VStack spacing={3} align="stretch">
                    <Box p={3} bg="gray.50" borderRadius="md">
                      <Text fontWeight="bold" fontSize="sm" color="gray.500">Nama</Text>
                      <Text mt={1}>{order.customer_name}</Text>
                    </Box>
                    <Box p={3} bg="gray.50" borderRadius="md">
                      <Text fontWeight="bold" fontSize="sm" color="gray.500">Email</Text>
                      <Text mt={1} wordBreak="break-all">{order.customer_email}</Text>
                    </Box>
                    <Box p={3} bg="gray.50" borderRadius="md">
                      <Text fontWeight="bold" fontSize="sm" color="gray.500">Telepon</Text>
                      <Text mt={1}>{order.customer_phone}</Text>
                    </Box>
                  </VStack>
                </Box>
                <Table variant="simple" display={{ base: 'none', md: 'table' }}>
                  <Tbody>
                    <Tr>
                      <Th>Nama</Th>
                      <Td>{order.customer_name}</Td>
                    </Tr>
                    <Tr>
                      <Th>Email</Th>
                      <Td>{order.customer_email}</Td>
                    </Tr>
                    <Tr>
                      <Th>Telepon</Th>
                      <Td>{order.customer_phone}</Td>
                    </Tr>
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
            
            <Card variant="outline" borderWidth="1px">
              <CardBody>
                <Heading size="md" mb={4}>Detail Item Pesanan</Heading>
                {/* Tampilan mobile untuk daftar item */}
                <Box display={{ base: 'block', md: 'none' }}>
                  <VStack spacing={4} align="stretch" mb={5}>
                    {order.items?.map((item, index) => (
                      <Box key={index} p={4} borderWidth="1px" borderRadius="md" shadow="sm">
                        <Text fontWeight="bold" fontSize="md" mb={2}>{item.product_name}</Text>
                        <Grid templateColumns="repeat(2, 1fr)" gap={2}>
                          <Box>
                            <Text fontSize="xs" color="gray.500">Harga Satuan</Text>
                            <Text>Rp {item.product_price?.toLocaleString('id-ID')}</Text>
                          </Box>
                          <Box>
                            <Text fontSize="xs" color="gray.500">Jumlah</Text>
                            <Text>{item.quantity}</Text>
                          </Box>
                          <Box gridColumn="span 2">
                            <Text fontSize="xs" color="gray.500">Subtotal</Text>
                            <Text fontWeight="bold">Rp {item.subtotal?.toLocaleString('id-ID')}</Text>
                          </Box>
                        </Grid>
                      </Box>
                    ))}
                  </VStack>
                  <Flex justify="space-between" p={3} bg="gray.50" borderRadius="md">
                    <Text fontWeight="bold">Total</Text>
                    <Text fontWeight="bold">Rp {order.total_amount?.toLocaleString('id-ID')}</Text>
                  </Flex>
                </Box>
                {/* Tampilan desktop untuk tabel */}
                <Table variant="simple" display={{ base: 'none', md: 'table' }}>
                  <Thead>
                    <Tr>
                      <Th>Nama Item</Th>
                      <Th>Harga Satuan</Th>
                      <Th>Jumlah</Th>
                      <Th>Subtotal</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {order.items?.map((item, index) => (
                      <Tr key={index}>
                        <Td>{item.product_name}</Td>
                        <Td>Rp {item.product_price?.toLocaleString('id-ID')}</Td>
                        <Td>{item.quantity}</Td>
                        <Td>Rp {item.subtotal?.toLocaleString('id-ID')}</Td>
                      </Tr>
                    ))}
                    <Tr>
                      <Td colSpan={3} fontWeight="bold">Total</Td>
                      <Td fontWeight="bold">Rp {order.total_amount?.toLocaleString('id-ID')}</Td>
                    </Tr>
                  </Tbody>
                </Table>
              </CardBody>
            </Card>
            
            {order.transaction_id && (
              <Card variant="outline" borderWidth="1px">
                <CardBody>
                  <Heading size="md" mb={4}>Informasi Transaksi</Heading>
                  
                  {/* Tampilan mobile untuk informasi transaksi */}
                  <Box display={{ base: 'block', md: 'none' }}>
                    <VStack spacing={3} align="stretch">
                      <Box p={3} bg="gray.50" borderRadius="md">
                        <Text fontWeight="bold" fontSize="sm" color="gray.500">Transaction ID</Text>
                        <Text mt={1} fontSize="sm" wordBreak="break-all">{order.transaction_id}</Text>
                        <Button 
                          size="xs" 
                          mt={1}
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(order.transaction_id);
                            toast({
                              title: "ID Disalin",
                              status: "success",
                              duration: 2000,
                            });
                          }}
                        >
                          Salin ID
                        </Button>
                      </Box>
                      <Box p={3} bg="gray.50" borderRadius="md">
                        <Text fontWeight="bold" fontSize="sm" color="gray.500">Status Terakhir</Text>
                        <Box mt={1}>{getStatusBadge(order.payment_status)}</Box>
                      </Box>
                      {order.payment_method && (
                        <Box p={3} bg="gray.50" borderRadius="md">
                          <Text fontWeight="bold" fontSize="sm" color="gray.500">Metode Pembayaran</Text>
                          <Box mt={1}>{getPaymentIcon(order.payment_method)}</Box>
                        </Box>
                      )}
                      {order.payment_time && (
                        <Box p={3} bg="gray.50" borderRadius="md">
                          <Text fontWeight="bold" fontSize="sm" color="gray.500">Waktu Pembayaran</Text>
                          <Text mt={1}>{new Date(order.payment_time).toLocaleString('id-ID')}</Text>
                        </Box>
                      )}
                    </VStack>
                  </Box>
                  
                  {/* Tampilan desktop untuk tabel */}
                  <Table variant="simple" display={{ base: 'none', md: 'table' }}>
                    <Tbody>
                      <Tr>
                        <Th>Transaction ID</Th>
                        <Td>{order.transaction_id}</Td>
                      </Tr>
                      <Tr>
                        <Th>Status Terakhir</Th>
                        <Td>{getStatusBadge(order.payment_status)}</Td>
                      </Tr>
                      {order.payment_method && (
                        <Tr>
                          <Th>Metode Pembayaran</Th>
                          <Td>{getPaymentIcon(order.payment_method)}</Td>
                        </Tr>
                      )}
                      {order.payment_time && (
                        <Tr>
                          <Th>Waktu Pembayaran</Th>
                          <Td>{new Date(order.payment_time).toLocaleString('id-ID')}</Td>
                        </Tr>
                      )}
                    </Tbody>
                  </Table>
                </CardBody>
              </Card>
            )}
          </VStack>
        </CardBody>
      </Card>
    </Container>
  );
}

export default OrderDetailPage;
