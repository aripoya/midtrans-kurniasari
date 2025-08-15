import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link as RouterLink } from 'react-router-dom';
import {
  Box, Container, VStack, HStack, Text, Heading, Card, CardBody, 
  Divider, Badge, Button, Alert, AlertIcon, Spinner, Center,
  Stack, useBreakpointValue, Flex
} from '@chakra-ui/react';
import { CheckCircleIcon, InfoIcon } from '@chakra-ui/icons';
import { formatCurrency } from '../utils/formatters';
import { formatDate } from '../utils/date';
import publicApi, { PublicOrder } from '../api/publicApi';

const PaymentSuccessPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Responsive design
  const isMobile = useBreakpointValue({ base: true, md: false });
  const cardDirection = useBreakpointValue({ base: 'column', md: 'row' }) as 'column' | 'row';
  const stackSpacing = useBreakpointValue({ base: 4, md: 6 });

  // Extract payment info from URL params
  const transactionId = searchParams.get('transaction_id');
  const orderId = searchParams.get('order_id');

  useEffect(() => {
    const fetchOrderData = async () => {
      try {
        if (!id && !orderId) {
          setError('Order ID tidak ditemukan');
          setLoading(false);
          return;
        }

        const orderIdToFetch = id || orderId;
        const response = await publicApi.getOrderById(orderIdToFetch!);
        
        if (response.success && response.data) {
          setOrder(response.data);
        } else {
          setError(response.error || 'Gagal memuat data pesanan');
        }
      } catch (err) {
        console.error('Error fetching order:', err);
        setError('Terjadi kesalahan saat memuat data pesanan');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderData();
  }, [id, orderId]);

  const getPaymentStatusBadge = (status: string) => {
    if (status === 'settlement' || status === 'paid') {
      return <Badge colorScheme="green" variant="solid">Pembayaran Berhasil</Badge>;
    } else if (status === 'pending') {
      return <Badge colorScheme="yellow" variant="solid">Menunggu Pembayaran</Badge>;
    } else {
      return <Badge colorScheme="red" variant="solid">Pembayaran Gagal</Badge>;
    }
  };

  const getPickupMethodLabel = (method: string) => {
    switch (method) {
      case 'deliveryman': return 'Kurir Toko';
      case 'pickup_sendiri': return 'Ambil Sendiri di Outlet';
      case 'ojek_online': return 'Ojek Online';
      case 'alamat_customer': return 'Antar ke Alamat';
      default: return method;
    }
  };

  if (loading) {
    return (
      <Container maxW="lg" py={8}>
        <Center>
          <VStack spacing={4}>
            <Spinner size="xl" color="blue.500" />
            <Text>Memuat data pesanan...</Text>
          </VStack>
        </Center>
      </Container>
    );
  }

  if (error || !order) {
    return (
      <Container maxW="lg" py={8}>
        <Alert status="error" borderRadius="lg">
          <AlertIcon />
          <VStack align="start" spacing={2}>
            <Text fontWeight="bold">Terjadi Kesalahan</Text>
            <Text>{error || 'Data pesanan tidak ditemukan'}</Text>
            <Button as={RouterLink} to="/orders" size="sm" colorScheme="blue" mt={2}>
              Lihat Pesanan Lain
            </Button>
          </VStack>
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxW="2xl" py={8} px={4}>
      <VStack spacing={stackSpacing} align="stretch">
        
        {/* Success Header */}
        <Card bg="green.50" borderColor="green.200" borderWidth="1px">
          <CardBody>
            <VStack spacing={4} textAlign="center">
              <CheckCircleIcon boxSize={12} color="green.500" />
              <Heading size={isMobile ? "lg" : "xl"} color="green.700">
                🎉 Terima Kasih!
              </Heading>
              <Text fontSize={isMobile ? "md" : "lg"} color="green.600">
                Pesanan Anda telah berhasil dibuat dan pembayaran telah dikonfirmasi.
              </Text>
              {transactionId && (
                <Text fontSize="sm" color="gray.600">
                  ID Transaksi: {transactionId}
                </Text>
              )}
            </VStack>
          </CardBody>
        </Card>

        {/* Order Information */}
        <Card>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <Flex justify="space-between" align="center" wrap="wrap" gap={2}>
                <Heading size="md" color="blue.600">
                  <InfoIcon mr={2} />
                  Informasi Pesanan
                </Heading>
                {getPaymentStatusBadge(order.payment_status)}
              </Flex>

              <Stack direction={cardDirection} spacing={4} divider={<Divider />}>
                
                {/* Customer Info */}
                <Box flex="1">
                  <Text fontWeight="bold" mb={2} color="gray.700">Data Konsumen</Text>
                  <VStack align="start" spacing={1} fontSize="sm">
                    <HStack justify="space-between" w="full">
                      <Text color="gray.600">Nama:</Text>
                      <Text fontWeight="medium">{order.customer_name}</Text>
                    </HStack>
                    <HStack justify="space-between" w="full">
                      <Text color="gray.600">Telepon:</Text>
                      <Text fontWeight="medium">{order.customer_phone}</Text>
                    </HStack>
                    {order.customer_email && (
                      <HStack justify="space-between" w="full">
                        <Text color="gray.600">Email:</Text>
                        <Text fontWeight="medium">{order.customer_email}</Text>
                      </HStack>
                    )}
                    {/* Address field not available in PublicOrder interface */}
                  </VStack>
                </Box>

                {/* Order Details */}
                <Box flex="1">
                  <Text fontWeight="bold" mb={2} color="gray.700">Detail Pesanan</Text>
                  <VStack align="start" spacing={1} fontSize="sm">
                    <HStack justify="space-between" w="full">
                      <Text color="gray.600">No. Pesanan:</Text>
                      <Text fontWeight="medium" fontSize="xs">{order.id}</Text>
                    </HStack>
                    <HStack justify="space-between" w="full">
                      <Text color="gray.600">Tanggal:</Text>
                      <Text fontWeight="medium">{formatDate(order.created_at)}</Text>
                    </HStack>
                    <HStack justify="space-between" w="full">
                      <Text color="gray.600">Total:</Text>
                      <Text fontWeight="bold" color="green.600">
                        {formatCurrency(order.total_amount)}
                      </Text>
                    </HStack>
                    {/* Payment method not available in PublicOrder interface */}
                    <HStack justify="space-between" w="full">
                      <Text color="gray.600">Metode Pengambilan:</Text>
                      <Text fontWeight="medium">{getPickupMethodLabel(order.pickup_method)}</Text>
                    </HStack>
                  </VStack>
                </Box>

              </Stack>
            </VStack>
          </CardBody>
        </Card>

        {/* Order Items */}
        <Card>
          <CardBody>
            <Heading size="md" mb={4} color="blue.600">
              Item Pesanan ({order.items?.length || 0} item)
            </Heading>
            <VStack spacing={3} align="stretch">
              {order.items?.map((item, index) => (
                <Box key={item.id || index} p={3} bg="gray.50" borderRadius="md">
                  <HStack justify="space-between" wrap="wrap">
                    <VStack align="start" spacing={1} flex="1">
                      <VStack align="start" spacing={1} flex={1}>
                        <Text fontWeight="semibold">{item.product_name}</Text>
                        {/* Size and notes fields not available in current order items interface */}
                      </VStack>
                      <Text fontSize="sm" color="gray.700">
                        {item.quantity} x {formatCurrency(item.price)}
                      </Text>
                    </VStack>
                    <Text fontWeight="bold" color="green.600">
                      {formatCurrency(item.quantity * item.price)}
                    </Text>
                  </HStack>
                </Box>
              ))}
            </VStack>
          </CardBody>
        </Card>

        {/* Shipping Information */}
        <Card>
          <CardBody>
            <Heading size="md" mb={4} color="blue.600">
              Informasi Pengiriman
            </Heading>
            <VStack align="start" spacing={2}>
              <HStack justify="space-between" w="full">
                <Text color="gray.600">Area:</Text>
                <Text fontWeight="medium">
                  {order.shipping_area === 'dalam-kota' ? 'Dalam Kota' : 'Luar Kota'}
                </Text>
              </HStack>
              <HStack justify="space-between" w="full">
                <Text color="gray.600">Status:</Text>
                <Badge colorScheme="blue" variant="outline">
                  {order.shipping_status || 'Menunggu Diproses'}
                </Badge>
              </HStack>
              {order.pickup_method === 'pickup_sendiri' && order.lokasi_pengambilan && (
                <HStack justify="space-between" w="full">
                  <Text color="gray.600">Lokasi Pengambilan:</Text>
                  <Text fontWeight="medium" fontSize="sm">{order.lokasi_pengambilan}</Text>
                </HStack>
              )}
              {order.courier_service && (
                <HStack justify="space-between" w="full">
                  <Text color="gray.600">Layanan Kurir:</Text>
                  <Text fontWeight="medium">{order.courier_service}</Text>
                </HStack>
              )}
            </VStack>
          </CardBody>
        </Card>

        {/* Next Steps */}
        <Card bg="blue.50" borderColor="blue.200" borderWidth="1px">
          <CardBody>
            <VStack spacing={4} align="center">
              <Heading size="md" color="blue.700">
                Langkah Selanjutnya
              </Heading>
              <VStack spacing={3} textAlign="center">
                <Text fontSize="sm" color="blue.700">
                  • Anda akan menerima notifikasi WhatsApp untuk update status pesanan
                </Text>
                <Text fontSize="sm" color="blue.700">
                  • Simpan nomor pesanan untuk tracking: <Text as="span" fontWeight="bold">{order.id}</Text>
                </Text>
                <Text fontSize="sm" color="blue.700">
                  • Tim kami akan memproses pesanan Anda secepatnya
                </Text>
              </VStack>
              <HStack spacing={4} wrap="wrap" justify="center">
                <Button 
                  as={RouterLink} 
                  to={`/orders/${order.id}`}
                  colorScheme="blue" 
                  size={isMobile ? "sm" : "md"}
                >
                  Lihat Detail Pesanan
                </Button>
                <Button 
                  as={RouterLink} 
                  to="/orders"
                  variant="outline"
                  colorScheme="blue"
                  size={isMobile ? "sm" : "md"}
                >
                  Pesanan Lainnya
                </Button>
              </HStack>
            </VStack>
          </CardBody>
        </Card>

        {/* Footer */}
        <Box textAlign="center" py={6}>
          <Text fontSize="sm" color="gray.500">
            Terima kasih telah mempercayai layanan kami! 🙏
          </Text>
          <Text fontSize="xs" color="gray.400" mt={2}>
            Kurniasari - Solusi Terpercaya untuk Kebutuhan Anda
          </Text>
        </Box>

      </VStack>
    </Container>
  );
};

export default PaymentSuccessPage;
