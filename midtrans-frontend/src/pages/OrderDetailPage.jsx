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
  Tag, Container
} from '@chakra-ui/react';
import { orderService } from '../api/orderService';

function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();
  // Setting stepper orientation based on screen size - pindah ke awal komponen
  const stepperOrientation = useBreakpointValue({ base: 'vertical', md: 'horizontal' });

  useEffect(() => {
    fetchOrder();
  }, [id]);
  
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
        setOrder(data.order);
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
      const status = await orderService.checkTransactionStatus(id);
      
      if (status.success && status.transaction_status) {
        toast({
          title: 'Status berhasil diperbarui',
          description: 'Status pembayaran telah diperbarui',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });

        // Refresh order data
        fetchOrder();
      } else {
        toast({
          title: 'Status tidak berubah',
          description: 'Tidak ada perubahan status pembayaran',
          status: 'info',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error refreshing status:', error);
      toast({
        title: 'Gagal memperbarui status',
        description: 'Terjadi kesalahan saat memperbarui status',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setRefreshing(false);
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
      { label: 'Pemesanan', description: 'Pesanan dibuat', status: 'complete' },
      { label: 'Pembayaran', description: 'Menunggu pembayaran', status: 'incomplete' },
      { label: 'Pengiriman', description: 'Menunggu pengiriman', status: 'incomplete' }
    ];

    if (order) {
      // Set step status berdasarkan status pembayaran
      const paymentStatus = order.payment_status || order.status;
      if (paymentStatus === 'settlement' || paymentStatus === 'capture' || paymentStatus === 'paid') {
        steps[1].status = 'complete';
        steps[1].description = 'Pembayaran selesai';
        steps[2].status = 'current';
        steps[2].description = 'Sedang diproses';
      } else if (paymentStatus === 'cancel' || paymentStatus === 'deny' || paymentStatus === 'expire' || paymentStatus === 'failed') {
        steps[1].status = 'error';
        steps[1].description = paymentStatus === 'expire' ? 'Pembayaran kedaluwarsa' : 'Pembayaran gagal/ditolak';
        steps[2].description = 'Tidak dapat diproses';
      } else if (paymentStatus === 'refund' || paymentStatus === 'partial_refund' || paymentStatus === 'refunded') {
        steps[1].status = 'complete';
        steps[1].description = 'Pembayaran dikembalikan';
        steps[2].status = 'error';
        steps[2].description = 'Pengiriman dibatalkan';
      }
    }
    
    return steps;
  };

  const getPaymentIcon = (method) => {
    if (!method) return null;
    
    const method_lower = method.toLowerCase();
    
    if (method_lower.includes('credit') || method_lower.includes('card')) {
      return <Tag colorScheme="purple" size="md">Credit Card</Tag>
    } else if (method_lower.includes('gopay')) {
      return <Tag colorScheme="green" size="md">GoPay</Tag>
    } else if (method_lower.includes('bank') || method_lower.includes('transfer')) {
      return <Tag colorScheme="blue" size="md">Bank Transfer</Tag>
    } else if (method_lower.includes('qris')) {
      return <Tag colorScheme="orange" size="md">QRIS</Tag>
    } else if (method_lower.includes('alfamart') || method_lower.includes('indomaret')) {
      return <Tag colorScheme="red" size="md">{method}</Tag>
    }
    
    return <Tag size="md">{method}</Tag>;
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

  // Get payment steps based on order status
  const steps = getPaymentSteps();
  
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
            <Stepper
              index={order.status === 'settlement' || order.status === 'capture' ? 2 : 1}
              orientation={stepperOrientation}
              colorScheme="teal"
              size="lg"
            >
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
                    <StepTitle>{step.label}</StepTitle>
                    <StepDescription>{step.description}</StepDescription>
                  </Box>
                  <StepSeparator />
                </Step>
              ))}
            </Stepper>
          </Box>

          <VStack spacing={6} align="stretch">
            <Card bg="white" variant="outline" borderWidth="1px">
              <CardBody>
                <StatGroup flexDirection={{ base: 'column', md: 'row' }} gap={{ base: 4, md: 0 }}>
                  <Stat>
                    <StatLabel>Status Pembayaran</StatLabel>
                    <StatNumber>{getStatusBadge(order.status)}</StatNumber>
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
                        <Box mt={1}>{getStatusBadge(order.status)}</Box>
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
                        <Td>{getStatusBadge(order.status)}</Td>
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
