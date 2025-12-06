import { useState, useEffect } from 'react';
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
  useToast
} from '@chakra-ui/react';
import { publicApi, PublicOrder } from '../api/publicApi';
import { API_URL } from '../api/config';
import { formatCurrency } from '../utils/formatters';
import { normalizeShippingStatus } from '../utils/orderStatusUtils';
import ShippingImageDisplay from '../components/ShippingImageDisplay';



interface ShippingImage {
  image_type: string;
  image_url: string;
  id?: string;
  order_id?: string;
  uploaded_at?: string;
}

const PublicOrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [shippingImages, setShippingImages] = useState<ShippingImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingReceived, setMarkingReceived] = useState(false);
  const [refreshingPayment, setRefreshingPayment] = useState(false);
  const toast = useToast();

  const transformURL = (url: string): string => {
    if (!url) return url;

    // Sudah berupa URL publik (Cloudflare Images / proses), kembalikan apa adanya
    if (
      url.includes('imagedelivery.net') ||
      url.includes('cloudflareimages.com') ||
      url.includes('proses.kurniasari.co.id')
    ) {
      return url;
    }

    // Legacy R2 direct URLs -> map ke domain publik proses.kurniasari.co.id
    if (url.includes('r2.cloudflarestorage.com')) {
      try {
        const filenameWithQuery = url.split('/').pop() || '';
        const filename = filenameWithQuery.split('?')[0];
        if (filename) {
          return `https://proses.kurniasari.co.id/${filename}`;
        }
      } catch {
        return url;
      }
    }

    // workers.dev URL modern tetap dipakai apa adanya
    if (url.includes('wahwooh.workers.dev')) return url;

    // Legacy /api/images/ diubah ke Cloudflare Images
    if (url.includes('/api/images/')) {
      const filename = url.split('/').pop();
      if (filename) {
        return `https://imagedelivery.net/ZB3RMqDfebexy8n_rRUJkA/${filename}/public`;
      }
    }

    return url;
  };

  // Fetch shipping images separately
  const fetchShippingImages = async (orderId: string) => {
    try {
      console.log('📸 [PublicOrderDetailPage] Fetching shipping images for order:', orderId);
      const apiUrl = API_URL || 'https://order-management-app-production.wahwooh.workers.dev';
      const imageResponse = await fetch(`${apiUrl}/api/test-shipping-photos/${orderId}`);
      
      if (imageResponse.ok) {
        const imageData = await imageResponse.json();
        console.log('📸 [PublicOrderDetailPage] Raw API response:', imageData);
        
        if (imageData.success && imageData.data) {
          // Convert the response format to array of shipping images with canonical types
          const images: ShippingImage[] = [];

          // Map backend keys (siap_kirim/pengiriman/diterima) and FE keys
          // (ready_for_pickup/picked_up/delivered/packaged_product) to canonical FE types
          const canonicalTypeMap: Record<string, string> = {
            siap_kirim: 'ready_for_pickup',
            ready_for_pickup: 'ready_for_pickup',
            packaged_product: 'packaged_product',
            pengiriman: 'picked_up',
            picked_up: 'picked_up',
            diterima: 'delivered',
            delivered: 'delivered',
          };

          Object.entries(imageData.data).forEach(([type, imageInfo]: [string, any]) => {
            if (imageInfo && imageInfo.url) {
              const canonicalType = canonicalTypeMap[type] || type;
              images.push({
                image_type: canonicalType,
                image_url: transformURL(imageInfo.url),
                id: imageInfo.imageId || '',
                order_id: orderId,
                uploaded_at: new Date().toISOString(),
              });
            }
          });

          console.log('📸 [PublicOrderDetailPage] Processed images:', images);
          setShippingImages(images);
        }
      } else {
        console.log('📸 [PublicOrderDetailPage] Failed to fetch shipping images:', imageResponse.status);
      }
    } catch (error) {
      console.error('📸 [PublicOrderDetailPage] Error fetching shipping images:', error);
    }
  };

  // Handle refresh payment status via backend endpoint
  const handleRefreshPayment = async () => {
    if (!order) return;
    try {
      setRefreshingPayment(true);
      const apiUrl = API_URL || 'https://order-management-app-production.wahwooh.workers.dev';
      const resp = await fetch(`${apiUrl}/api/orders/${order.id}/refresh-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await resp.json();
      if (resp.ok && data?.success) {
        toast({
          title: 'Status Pembayaran Diperbarui',
          description: 'Kami sudah mengambil status terbaru dari Midtrans.',
          status: 'success',
          duration: 4000,
          isClosable: true,
        });
        // Optimistically update payment_status from response if present
        if (data.payment_status) {
          setOrder(prev => prev ? { ...prev, payment_status: data.payment_status } : prev);
        }
        // Refetch order to update UI
        try {
          const response = await publicApi.getOrderById(order.id);
          if (response?.success && response?.data && (response.data as any).id) {
            setOrder(response.data);
          } else {
            // keep optimistic state if API returned empty
            setOrder(prev => prev);
          }
        } catch {
          // fallback: reload page if refetch fails
          window.location.reload();
        }
      } else {
        toast({
          title: 'Gagal Memperbarui Pembayaran',
          description: data?.error || 'Tidak dapat mengambil status pembayaran terbaru.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (e: any) {
      toast({
        title: 'Kesalahan Sistem',
        description: e?.message || 'Tidak dapat terhubung ke server.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setRefreshingPayment(false);
    }
  };

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
        if (response?.success && response?.data && (response.data as any).id) {
          setOrder(response.data);
        } else {
          setOrder(null);
        }
        setError(null);
        
        // Fetch shipping images separately
        if (response.data) {
          await fetchShippingImages(id);
        }
      } catch (err: any) {
        console.error('Error fetching order:', err);
        setError(err.message || 'Gagal mengambil data pesanan');
        setOrder(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();

    // Auto-refresh setiap 10 detik jika payment_status masih pending
    const intervalId = setInterval(async () => {
      if (!id) return;
      
      try {
        const response = await publicApi.getOrderById(id);
        if (response?.success && response?.data) {
          const currentOrder = response.data;
          setOrder(currentOrder);
          
          // Stop auto-refresh jika sudah dibayar
          if (currentOrder.payment_status && 
              ['settlement', 'capture', 'paid'].includes(currentOrder.payment_status.toLowerCase())) {
            clearInterval(intervalId);
          }
        }
      } catch (err) {
        console.error('Error auto-refreshing order:', err);
      }
    }, 10000); // Refresh setiap 10 detik

    // Cleanup interval saat component unmount
    return () => clearInterval(intervalId);
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
    
    const isPaid = ['paid', 'settlement', 'capture'].includes((order.payment_status || '').toLowerCase());
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
        status: isReceived ? 'complete' : (isShipping ? 'active' : (isProcessing ? 'active' : (isPaid ? 'active' : 'incomplete')))
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

  const isPaid = ['paid', 'settlement', 'capture'].includes((order.payment_status || '').toLowerCase());
  const isReceived = order.shipping_status === 'diterima';
  const steps = getOrderProgressSteps();
  
  // Build payment URL with robust fallbacks for public page
  const snapToken = (order as any)?.snap_token || (order as any)?.token;
  const redirectFromToken = snapToken ? `https://app.midtrans.com/snap/v4/redirection/${snapToken}` : undefined;
  let redirectUrlFromResponse: string | undefined = undefined;
  try {
    if ((order as any)?.payment_response) {
      const paymentResponse = JSON.parse((order as any).payment_response);
      redirectUrlFromResponse = paymentResponse?.redirect_url;
    }
  } catch (e) {
    console.warn('[PublicOrderDetailPage] Failed to parse payment_response:', e);
  }
  const paymentUrl: string | undefined = (order as any)?.payment_url || (order as any)?.payment_link || redirectUrlFromResponse || redirectFromToken || undefined;
  console.log('[PublicOrderDetailPage] Payment URL Debug:', {
    payment_url: (order as any)?.payment_url,
    payment_link: (order as any)?.payment_link,
    redirectFromToken,
    redirectUrlFromResponse,
    finalPaymentUrl: paymentUrl,
    payment_status: order.payment_status,
    hasPaymentUrl: !!paymentUrl
  });
  
  // Calculate currentStep: if order is received, show all steps as complete (use last index)
  // Otherwise, find the active step or the last completed step
  let currentStep = 0;
  
  if (isReceived) {
    // When order is received, all steps should be complete - set to last step index
    currentStep = steps.length - 1;
  } else {
    // Find active step first
    currentStep = steps.findIndex((step: any) => step.status === 'active');
    if (currentStep === -1) {
      // No active step found, find the last completed step
      const lastCompletedIndex = steps.map((step: any, index: number) => step.status === 'complete' ? index : -1)
                                      .filter((index: number) => index !== -1)
                                      .pop();
      currentStep = lastCompletedIndex !== undefined ? lastCompletedIndex : 0;
    }
  }

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
                    {(order.delivery_date || order.delivery_time) && (
                      <Text><strong>Jadwal Pengantaran:</strong> {
                        (() => {
                          const date = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
                          const time = order.delivery_time || '';
                          return `${date}${date && time ? ', ' : ''}${time}`;
                        })()
                      }</Text>
                    )}
                  </Box>

                  <Divider />

                  <Box>
                    <Heading size="sm" mb={4}>Progress Pesanan</Heading>
                    <Stepper index={currentStep} orientation="vertical" height="200px" gap="0">
                      {steps.map((step: any, index: number) => {
                        // Special styling for the final step (Selesai) when completed
                        const isFinalStep = index === steps.length - 1;
                        const isFinalStepCompleted = isFinalStep && step.status === 'complete';
                        
                        return (
                          <Step key={index}>
                            <StepIndicator 
                              sx={isFinalStepCompleted ? {
                                '& .chakra-step__icon': {
                                  backgroundColor: 'green.500',
                                  color: 'white',
                                  borderColor: 'green.500'
                                }
                              } : {}}
                            >
                              <StepStatus
                                complete={<StepIcon />}
                                incomplete={<StepNumber />}
                                active={<StepNumber />}
                              />
                            </StepIndicator>
                            <Box flexShrink="0">
                              <StepTitle 
                                color={isFinalStepCompleted ? 'green.600' : undefined}
                                fontWeight={isFinalStepCompleted ? 'bold' : undefined}
                              >
                                {step.title}
                              </StepTitle>
                              <StepDescription 
                                color={isFinalStepCompleted ? 'green.500' : undefined}
                              >
                                {step.description}
                              </StepDescription>
                            </Box>
                            <StepSeparator />
                          </Step>
                        );
                      })}
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
                    <Text><strong>{order.tipe_pesanan === 'Pesan Ambil' ? 'Metode Pengambilan' : 'Metode Pengiriman'}:</strong> {
                      order.tipe_pesanan === 'Pesan Ambil'
                        ? (order.pickup_method === 'self-pickup' ? 'Di Ambil Sendiri' : order.pickup_method === 'ojek-online' ? 'Ojek Online' : (order.pickup_method || '-'))
                        : (order.shipping_area === 'luar-kota' ? 'Paket Expedisi (Paket)' : order.pickup_method === 'deliveryman' ? 'Kurir Toko' : order.pickup_method === 'ojek-online' ? 'Ojek Online' : (order.pickup_method || 'qris'))
                    }</Text>
                  </Box>

                  <Divider />

                  {/* Tampilkan tombol pembayaran hanya jika pesanan belum dibayar */}
                  {!isPaid && paymentUrl && (
                    <Box>
                      <Button as="a" href={paymentUrl} target="_blank" rel="noopener noreferrer" colorScheme="teal" size="md">
                        Bayar Sekarang
                      </Button>
                    </Box>
                  )}

                  {(() => {
                    // Check if order is paid and has been processed by admin
                    const isPaidOrder = isPaid;
                    const isOrderLuarKota = order.shipping_area === 'luar-kota';

                    // More strict check: only show shipping info if admin has actually processed the order
                    const adminProcessedStatuses = ['dikemas', 'siap kirim', 'siap ambil', 'dalam pengiriman', 'diterima', 'sudah di terima', 'sudah di ambil'];
                    const hasBeenProcessedByAdmin = order.shipping_status &&
                      adminProcessedStatuses.includes(order.shipping_status.toLowerCase().trim());

                    // For luar-kota orders: show shipping info if paid AND has tracking number
                    // For dalam-kota orders: show shipping info if paid AND admin has processed
                    const shouldShowShippingInfo = isPaidOrder && (
                      (isOrderLuarKota && order.tracking_number) || hasBeenProcessedByAdmin
                    );

                    if (!shouldShowShippingInfo) {
                      return null; // Don't render shipping info section at all
                    }

                    return (
                      <Box>
                        <Heading size="sm" mb={2}>Informasi Pengiriman</Heading>
                        <Text><strong>Status Pesanan:</strong> {getShippingStatusBadge(order)}</Text>
                        <Text><strong>Area Pengiriman:</strong> {order.shipping_area === 'dalam-kota' || order.shipping_area === 'dalam_kota' ? 'Dalam Kota' : 'Luar Kota'}</Text>
                        {order.lokasi_pengiriman && (
                          <Text><strong>Lokasi Pengiriman:</strong> {order.lokasi_pengiriman}</Text>
                        )}
                        {order.courier_service && (
                          <>
                            <Text><strong>Jasa Ekspedisi:</strong> {
                              order.courier_service.toLowerCase() === 'deliveryman' ? 'Kurir Toko' :
                              order.courier_service.toLowerCase() === 'ojek_online' ? 'Ojek Online' :
                              order.courier_service.toLowerCase() === 'gojek' ? 'Gojek' :
                              order.courier_service.toLowerCase() === 'grab' ? 'Grab' :
                              order.courier_service.toLowerCase() === 'jne' ? 'JNE' :
                              order.courier_service.toLowerCase() === 'tiki' ? 'TIKI' :
                              order.courier_service.toLowerCase() === 'travel' ? 'Travel' :
                              order.courier_service.toUpperCase()
                            }</Text>
                            
                            {/* WhatsApp button for Rudi or Fendi */}
                            {(() => {
                              const courierName = order.courier_service?.toLowerCase();
                              const driverWhatsApp: { [key: string]: { phone: string; name: string } } = {
                                'rudi': { phone: '6285123323166', name: 'Rudi' },
                                'fendi': { phone: '6285178108852', name: 'Fendi' }
                              };
                              
                              const driver = driverWhatsApp[courierName];
                              if (driver) {
                                const message = encodeURIComponent(
                                  `Halo ${driver.name}, saya ingin menanyakan pesanan saya dengan ID: ${order.id}`
                                );
                                return (
                                  <Button
                                    as="a"
                                    href={`https://wa.me/${driver.phone}?text=${message}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    colorScheme="green"
                                    variant="outline"
                                    size="sm"
                                    leftIcon={<Text>💬</Text>}
                                    mt={2}
                                    _hover={{
                                      bg: 'green.500',
                                      color: 'white',
                                      borderColor: 'green.500'
                                    }}
                                  >
                                    Hubungi {driver.name} via WhatsApp
                                  </Button>
                                );
                              }
                              return null;
                            })()}
                          </>
                        )}
                        {order.tracking_number && (
                          <Box>
                            <HStack mb={2}>
                              <Text><strong>No. Resi:</strong> {order.tracking_number}</Text>
                              <Button
                                size="xs"
                                colorScheme="teal"
                                variant="outline"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(order.tracking_number || '');
                                    toast({ title: 'Nomor resi disalin!', status: 'success', duration: 1500, isClosable: true });
                                  } catch (e) {
                                    toast({ title: 'Gagal menyalin', status: 'error', duration: 2000, isClosable: true });
                                  }
                                }}
                              >
                                Copy
                              </Button>
                            </HStack>
                            {order.courier_service?.toLowerCase() === 'tiki' ? (
                              <Button
                                as="a"
                                href="https://tiki.id/id/track"
                                target="_blank"
                                rel="noopener noreferrer"
                                colorScheme="blue"
                                size="sm"
                                leftIcon={<Text>📦</Text>}
                              >
                                Lacak di TIKI
                              </Button>
                            ) : order.courier_service?.toLowerCase() === 'jne' ? (
                              <Button
                                as="a"
                                href="https://jne.co.id/tracking-package"
                                target="_blank"
                                rel="noopener noreferrer"
                                colorScheme="red"
                                size="sm"
                                leftIcon={<Text>📦</Text>}
                              >
                                Lacak di JNE
                              </Button>
                            ) : null}
                          </Box>
                        )}
                        {order.courier_name && (
                          <Text><strong>Nama Kurir:</strong> {order.courier_name}</Text>
                        )}
                        {order.admin_note && (
                          <Text><strong>Catatan Admin:</strong> {order.admin_note}</Text>
                        )}
                      </Box>
                    );
                  })()}

                  <Divider />

                  <Box>
                    <Heading size="sm" mb={2}>Status Foto Pesanan</Heading>
                    <VStack align="stretch" spacing={3}>
                      {photoSlotsToShow.map((type) => {
                        // Label berbeda untuk luar kota, dalam kota, dan pesan ambil
                        const isPesanAmbil = order.tipe_pesanan === 'Pesan Ambil';
                        const labels = {
                          ready_for_pickup: isPesanAmbil ? 'Foto Siap Ambil' : 'Foto Siap Kirim',
                          picked_up: isPesanAmbil ? 'Foto Pengambilan' : (isLuarKota ? 'Foto Sudah di Ambil Kurir' : 'Foto Pengiriman'),
                          delivered: 'Foto Diterima',
                          packaged_product: isPesanAmbil ? 'Foto Siap Ambil' : 'Foto Siap Kirim'
                        } as const;

                        // Alias mapping supaya public view konsisten dengan admin/outlet
                        const typeAliases: Record<string, string[]> = {
                          ready_for_pickup: ['ready_for_pickup', 'siap_kirim', 'packaged_product'],
                          picked_up: ['picked_up', 'pengiriman'],
                          delivered: ['delivered', 'diterima'],
                          packaged_product: ['packaged_product', 'siap_kirim', 'ready_for_pickup'],
                        };

                        const aliases = typeAliases[type] || [type];
                        const imageUrl = shippingImages?.find((img) =>
                          aliases.includes(img.image_type)
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
                {order.items && order.items.length > 0 ? (
                  order.items.map((item, index) => (
                    <Tr key={index}>
                      <Td>{item.product_name}</Td>
                      <Td isNumeric>{item.quantity}</Td>
                      <Td isNumeric>{formatCurrency(item.price)}</Td>
                    </Tr>
                  ))
                ) : (
                  <Tr>
                    <Td>
                      <Text fontWeight="medium">Bakpia</Text>
                      <Text fontSize="xs" color="gray.500">(Detail item tidak tersedia)</Text>
                    </Td>
                    <Td isNumeric>1</Td>
                    <Td isNumeric>{formatCurrency(order.total_amount)}</Td>
                  </Tr>
                )}
              </Tbody>
            </Table>

            <Divider my={6} />
            
            <HStack spacing={4} justify="center" wrap="wrap">
              {!isPaid && (
                <Button colorScheme="teal" size="lg" onClick={handleRefreshPayment} isLoading={refreshingPayment} loadingText="Memeriksa..." disabled={refreshingPayment}>
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
