import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Card,
  CardBody,
  CardHeader,
  VStack,
  HStack,
  Text,
  Heading,
  Badge,
  Button,
  Grid,
  GridItem,
  Box,
  Divider,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Center,
  Spinner,
  Alert,
  AlertIcon,
  Step,
  StepDescription,
  StepIcon,
  StepIndicator,
  StepNumber,
  StepSeparator,
  StepStatus,
  StepTitle,
  Stepper,
  useSteps,
  useToast
} from '@chakra-ui/react';
import { publicApi, PublicOrder } from '../api/publicApi';
import { formatDate } from '../utils/date';
import { API_URL } from '../api/config';
import { formatCurrency } from '../utils/formatters';
import { normalizeShippingStatus } from '../utils/orderStatusUtils';
import ShippingImageDisplay from '../components/ShippingImageDisplay';



const PublicOrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingReceived, setMarkingReceived] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const fetchOrder = async () => {
      if (!id) {
        setError('Order ID tidak ditemukan');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await publicApi.getOrderById(id);
        setOrder(response.data || null);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching order:', err);
        setError(err.message || 'Gagal mengambil data pesanan');
        setOrder(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id]);



  const getShippingStatusBadge = (order: PublicOrder) => {
    const normalizedStatus = normalizeShippingStatus(order.shipping_status);
    let colorScheme = 'gray';
    let statusText = order.shipping_status?.toUpperCase() || 'UNKNOWN';

    switch (normalizedStatus) {
      case 'menunggu diproses':
        colorScheme = 'yellow';
        statusText = 'PENDING';
        break;
      case 'dikemas':
        colorScheme = 'blue';
        statusText = 'DIKEMAS';
        break;
      case 'siap kirim':
        colorScheme = 'orange';
        statusText = 'SIAP KIRIM';
        break;
      case 'dalam pengiriman':
        colorScheme = 'purple';
        statusText = 'DALAM PENGIRIMAN';
        break;
      case 'diterima':
        colorScheme = 'green';
        statusText = 'DITERIMA';
        break;
    }

    return (
      <Badge colorScheme={colorScheme}>
        {statusText}
      </Badge>
    );
  };

  const getOrderProgressSteps = () => {
    if (!order) return [];
    
    const isPaid = order.payment_status === 'paid' || order.payment_status === 'settlement';
    const normalizedStatus = normalizeShippingStatus(order.shipping_status);
    const isProcessing = normalizedStatus === 'dikemas' || normalizedStatus === 'siap kirim';
    const isShipping = normalizedStatus === 'dalam pengiriman';
    const isReceived = normalizedStatus === 'diterima';

    return [
      {
        title: 'Pemesanan',
        description: 'Pesanan dibuat',
        status: 'complete'
      },
      {
        title: 'Pembayaran', 
        description: isPaid ? 'Pembayaran berhasil' : 'Menunggu pembayaran',
        status: isPaid ? 'complete' : 'active'
      },
      {
        title: 'Pengiriman',
        description: isReceived ? 'Pengiriman selesai' : (isShipping ? 'Sedang dikirim' : (isProcessing ? 'Siap kirim' : 'Menunggu proses')),
        status: isReceived ? 'complete' : (isShipping ? 'active' : (isProcessing ? 'active' : (isPaid ? 'incomplete' : 'incomplete')))
      },
      {
        title: 'Selesai',
        description: isReceived ? 'Pesanan diterima' : 'Belum diterima',
        status: isReceived ? 'complete' : 'incomplete'
      }
    ];
  };

  // Tampilan loading
  if (loading) {
    return (
      <Container maxW="container.lg" py={8}>
        <Center>
          <Spinner size="xl" thickness="4px" speed="0.65s" color="teal.500" />
        </Center>
      </Container>
    );
  }

  // Tampilan error
  if (error) {
    return (
      <Container maxW="container.lg" py={8}>
        <Alert status="error">
          <AlertIcon />
          {error}
        </Alert>
      </Container>
    );
  }

  // Tampilan utama
  if (!order) {
    return (
      <Container maxW="container.lg" py={8}>
        <Alert status="warning">
          <AlertIcon />
          Pesanan tidak ditemukan
        </Alert>
      </Container>
    );
  }

  const isPaid = order.payment_status === 'paid' || order.payment_status === 'settlement';
  const isReceived = order.shipping_status === 'diterima';
  const steps = getOrderProgressSteps();
  const currentStep = steps.findIndex((step: any) => step.status === 'active');

  // Tentukan apakah harus menampilkan foto berdasarkan shipping_area
  const isLuarKota = order.shipping_area === 'luar-kota';
  // Untuk luar kota: tampilkan foto produk dikemas dan pengiriman (tidak termasuk diterima)
  // Untuk dalam kota: tampilkan semua tahapan foto
  const photoSlotsToShow = isLuarKota ? ['packaged_product', 'picked_up'] : ['ready_for_pickup', 'picked_up', 'delivered'];

  // Handle mark order as received
  const handleMarkAsReceived = async () => {
    if (!order) return;
    
    try {
      setMarkingReceived(true);
      
      const response = await fetch(`${API_URL}/api/orders/${order.id}/mark-received`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_phone: order.customer_phone,
          customer_name: order.customer_name,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Pesanan Berhasil Dikonfirmasi',
          description: 'Pesanan telah berhasil ditandai sebagai diterima. Terima kasih!',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
        
        // Update order status in local state
        setOrder(prev => prev ? { ...prev, shipping_status: 'diterima' } : null);
      } else {
        toast({
          title: 'Gagal Mengonfirmasi Pesanan',
          description: data.error || 'Terjadi kesalahan saat mengonfirmasi pesanan.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error marking order as received:', error);
      toast({
        title: 'Kesalahan Sistem',
        description: 'Tidak dapat terhubung ke server. Silakan coba lagi nanti.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setMarkingReceived(false);
    }
  };

  return (
    <Container maxW="container.lg" py={8} px={{ base: 4, md: 6 }}>
      <VStack spacing={6} align="stretch">
        <Card>
          <CardHeader>
            <HStack justify="space-between" wrap="wrap">
              <Heading size="md">Detail Pesanan #{order.id}</Heading>
              <HStack spacing={2}>
                <Badge colorScheme={isPaid ? 'green' : 'red'}>
                  {isPaid ? 'LUNAS' : 'BELUM BAYAR'}
                </Badge>
                {getShippingStatusBadge(order)}
              </HStack>
            </HStack>
          </CardHeader>
          <CardBody>
            <Grid templateColumns={{ base: "1fr", lg: "2fr 1fr" }} gap={6}>
              <GridItem>
                <VStack align="stretch" spacing={4}>
                  <Box>
                    <Heading size="sm" mb={2}>Informasi Pelanggan</Heading>
                    <Text><strong>Nama:</strong> {order.customer_name}</Text>
                    <Text><strong>Email:</strong> {order.customer_email || 'aripoya09@gmail.com'}</Text>
                    <Text><strong>Telepon:</strong> {order.customer_phone}</Text>
                  </Box>

                  <Divider />

                  <Box>
                    <Heading size="sm" mb={4}>Progress Pesanan</Heading>
                    <Stepper index={currentStep} orientation="vertical" height="200px" gap="0">
                      {steps.map((step: any, index: number) => (
                        <Step key={index}>
                          <StepIndicator>
                            <StepStatus
                              complete={<StepIcon />}
                              incomplete={<StepNumber />}
                              active={<StepNumber />}
                            />
                          </StepIndicator>
                          <Box flexShrink="0">
                            <StepTitle>{step.title}</StepTitle>
                            <StepDescription>{step.description}</StepDescription>
                          </Box>
                          <StepSeparator />
                        </Step>
                      ))}
                    </Stepper>
                  </Box>
                </VStack>
              </GridItem>

              <GridItem>
                <VStack align="stretch" spacing={4}>
                  <Box>
                    <Heading size="sm" mb={2}>Detail Pembayaran</Heading>
                    <Text><strong>Total:</strong> {formatCurrency(order.total_amount)}</Text>
                    <Text><strong>Status:</strong> <Badge colorScheme={isPaid ? 'green' : 'red'}>{isPaid ? 'LUNAS' : 'BELUM BAYAR'}</Badge></Text>
                    <Text><strong>Metode:</strong> {order.pickup_method === 'deliveryman' ? 'kurir outlet' : (order.pickup_method || 'qris')}</Text>
                  </Box>

                  <Divider />

                  <Box>
                    <Heading size="sm" mb={2}>Informasi Pengiriman</Heading>
                    <Text><strong>Status Pengiriman:</strong> {getShippingStatusBadge(order)}</Text>
                    <Text><strong>Area Pengiriman:</strong> {order.shipping_area === 'dalam-kota' ? 'Dalam Kota' : 'Luar Kota'}</Text>
                    {order.shipping_area !== 'dalam-kota' && (
                      <Text><strong>Jasa Kurir:</strong> {order.courier_service || 'TRAVEL'}</Text>
                    )}
                    {order.tracking_number && (
                      <HStack>
                        <Text><strong>No. Resi:</strong> {order.tracking_number}</Text>
                        {order.courier_service?.toLowerCase() === 'tiki' ? (
                          <Badge 
                            as="a"
                            href={`/tiki-tracking?resi=${order.tracking_number}&orderId=${order.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            colorScheme="blue" 
                            cursor="pointer"
                            _hover={{ textDecoration: 'none', opacity: 0.8 }}
                          >
                            LACAK RESI
                          </Badge>
                        ) : order.courier_service?.toLowerCase() === 'jne' ? (
                          <Badge 
                            as="a"
                            href={`/jne-tracking?resi=${order.tracking_number}&orderId=${order.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            colorScheme="red" 
                            cursor="pointer"
                            _hover={{ textDecoration: 'none', opacity: 0.8 }}
                          >
                            LACAK RESI
                          </Badge>
                        ) : (
                          <Badge colorScheme="blue" cursor="pointer">Lacak Resi</Badge>
                        )}
                      </HStack>
                    )}
                  </Box>

                  <Divider />

                  <Box>
                    <Heading size="sm" mb={2}>Status Foto Pesanan</Heading>
                    <VStack align="stretch" spacing={3}>
                      {photoSlotsToShow.map((type) => {
                        const labels = {
                          ready_for_pickup: 'Foto Siap Kirim',
                          picked_up: 'Foto Pengiriman', 
                          delivered: 'Foto Diterima',
                          packaged_product: 'Foto Produk Sudah Dikemas'
                        };
                        
                        const imageUrl = order.shipping_images?.find(img => 
                          img.image_type === type || 
                          (type === 'ready_for_pickup' && img.image_type === 'siap_kirim') ||
                          (type === 'picked_up' && img.image_type === 'pengiriman') ||
                          (type === 'delivered' && img.image_type === 'diterima') ||
                          (type === 'packaged_product' && (img.image_type === 'packaged_product' || img.image_type === 'produk_dikemas'))
                        )?.image_url;
                        
                        return (
                          <ShippingImageDisplay
                            key={type}
                            imageUrl={imageUrl}
                            type={type}
                            label={labels[type as keyof typeof labels]}
                            showPlaceholder={true}
                            maxHeight="150px"
                          />
                        );
                      })}
                    </VStack>
                  </Box>
                </VStack>
              </GridItem>
            </Grid>

            <Divider my={6} />

            <Heading size="sm" mb={4}>Barang Pesanan</Heading>
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>PRODUK</Th>
                  <Th isNumeric>JUMLAH</Th>
                  <Th isNumeric>HARGA</Th>
                </Tr>
              </Thead>
              <Tbody>
                {order.items && order.items.map((item, index) => (
                  <Tr key={index}>
                    <Td>{item.product_name}</Td>
                    <Td isNumeric>{item.quantity}</Td>
                    <Td isNumeric>{formatCurrency(item.price)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>

            <Divider my={6} />
            
            <HStack spacing={4} justify="center" wrap="wrap">
              {!isPaid && (
                <Button colorScheme="teal" size="lg" onClick={() => window.location.reload()}>
                  Perbarui Pembayaran
                </Button>
              )}
              <Button onClick={() => window.location.reload()} variant="outline">
                Perbarui Status
              </Button>
              {isPaid && !isReceived && (
                <Button 
                  colorScheme="green" 
                  size="lg" 
                  onClick={handleMarkAsReceived}
                  isLoading={markingReceived}
                  loadingText="Memproses..."
                  disabled={markingReceived}
                >
                  Pesanan Sudah Diterima
                </Button>
              )}
            </HStack>
          </CardBody>
        </Card>
      </VStack>
    </Container>
  );
};

export default PublicOrderDetailPage;
