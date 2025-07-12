import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Box, Heading, Text, VStack, HStack, Badge, Button,
  Table, Tbody, Tr, Td, Th, Thead, Divider, Spinner,
  Alert, AlertIcon, Card, CardBody, CardHeader,
  useToast, Flex, Grid, GridItem, Step, StepDescription,
  StepIcon, StepIndicator, StepNumber, StepSeparator,
  StepStatus, StepTitle, Stepper, useBreakpointValue,
  Tag, Container, Link, Image
} from '@chakra-ui/react';
import { CheckIcon } from '@chakra-ui/icons';
import { orderService } from '../api/orderService';
import { refreshOrderStatus, markOrderAsReceived } from '../api/api';
import { useAuth } from '../auth/AuthContext';
import axios from 'axios';
import { normalizeShippingStatus, getShippingStatusConfig } from '../utils/orderStatusUtils';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { adminApi } from '../api/adminApi';

function OrderDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const auth = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingAsReceived, setIsMarkingAsReceived] = useState(false);
  const [shippingImages, setShippingImages] = useState({
    ready_for_pickup: null,
    picked_up: null,
    delivered: null,
  });
  const [loadingImages, setLoadingImages] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const qrCodeRef = useRef(null);
  const toast = useToast();
  const stepperOrientation = useBreakpointValue({ base: 'vertical', md: 'horizontal' });
  const stepperSize = useBreakpointValue({ base: 'sm', md: 'md' });
  
  // Check if this is a public order page (ID starts with ORDER-)
  const isPublicOrderPage = id && id.startsWith('ORDER-');

  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Debug log untuk memudahkan troubleshooting
      console.log(`🔍 Mencoba mengambil pesanan dengan ID: ${id}`);
      
      // Different fetch approach based on public vs protected route
      let orderData;
      
      if (isPublicOrderPage) {
        // For public order pages, use adminApi directly but without authentication
        // This ensures we use the same API endpoint structure consistently
        console.log(`🔍 Fetching public order with ID: ${id}`);
        
        try {
          // Gunakan adminApi yang sudah terbukti berfungsi
          // Tetapi buat instance axios baru tanpa autentikasi untuk halaman publik
          const isDev = import.meta.env.MODE === 'development';
          // Use multiple possible backend URLs to maximize chances of success
          const apiUrls = [
            'https://tagihan.kurniasari.co.id',
            'https://order-management-app-production.wahwooh.workers.dev',
            isDev ? 'http://localhost:8787' : null
          ].filter(Boolean);
          
          let lastError = null;
          let orderResponse = null;
          
          // Try each URL until one works
          for (const baseUrl of apiUrls) {
            try {
              console.log(`🌐 Trying API URL: ${baseUrl}`);
              const response = await axios.get(`${baseUrl}/api/orders/${id}`, {
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json'
                }
              });
              
              if (response.data && (response.data.success || response.data.order || response.data.data)) {
                orderResponse = response;
                console.log(`✅ Successful response from ${baseUrl}`);
                break;
              }
            } catch (err) {
              console.log(`❌ Error with ${baseUrl}:`, err.message);
              lastError = err;
            }
          }
          
          if (!orderResponse && lastError) {
            throw lastError;
          } else if (!orderResponse) {
            throw new Error('Tidak bisa terhubung ke server');
          }
          
          const response = orderResponse;
          console.log('📦 Respons API:', response.data);
          
          // Handle different response formats
          if (response.data.success) {
            if (response.data.order) {
              orderData = response.data.order; // Format lama
            } else if (response.data.data) {
              orderData = response.data.data;  // Format baru dari API produksi
            } else {
              throw new Error('Format data tidak dikenali');
            }
          } else if (response.data.order) {
            orderData = response.data.order; // Format alternatif
          } else if (response.data.data) {
            orderData = response.data.data;  // Format alternatif
          } else {
            throw new Error('Format respons tidak dikenali');
          }
        } catch (apiError) {
          console.error('❌ Error dalam mengambil data pesanan:', apiError);
          throw apiError;
        }
      } else {
        // For protected pages, use orderService which includes auth
        const serviceResponse = await orderService.getOrderById(id);
        if (serviceResponse.success && serviceResponse.order) {
          orderData = serviceResponse.order;
        } else if (serviceResponse.success && serviceResponse.data) {
          orderData = serviceResponse.data;
        } else {
          throw new Error('Data tidak ditemukan dari orderService');
        }
      }
      
      // Pastikan kita memiliki data pesanan
      if (orderData) {
        let finalOrder = orderData;
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
        console.log('✅ Berhasil memuat data pesanan:', finalOrder);
      } else {
        setError(`Pesanan tidak ditemukan.`);
      }
    } catch (err) {
      console.error('❌ Error dalam fetchOrder:', err);
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

  // Fetch shipping images when order is loaded
  useEffect(() => {
    if (order && order.shipping_images) {
      processShippingImages(order.shipping_images);
    }
  }, [order]);

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

  const handleMarkAsReceived = useCallback(async () => {
    setIsMarkingAsReceived(true);
    try {
      console.log('📦 Menandai pesanan sebagai sudah diterima:', id);
      const result = await markOrderAsReceived(id);
      
      if (!result.success) {
        throw new Error(result.error || 'Gagal menandai pesanan sebagai diterima');
      }
      
      toast({
        title: "Pesanan diterima",
        description: "Pesanan telah berhasil ditandai sebagai diterima.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      
      // Delay sedikit sebelum refresh untuk memastikan data terupdate di server
      setTimeout(() => fetchOrder(), 500); // Refresh order data setelah delay pendek
    } catch (err) {
      console.error('❌ Error menandai pesanan sebagai diterima:', err);
      toast({
        title: "Gagal menandai pesanan",
        description: err.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsMarkingAsReceived(false);
    }
  }, [id, toast, fetchOrder]);

  const handleDownloadQRCode = useCallback(() => {
    const qrCodeElement = qrCodeRef.current;
    if (!qrCodeElement || !order || !order.id) {
      toast({
        title: "Gagal mengunduh QR Code",
        description: "Data QR Code belum siap.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    html2canvas(qrCodeElement, { 
      scale: 3,
      backgroundColor: '#ffffff',
      useCORS: true,
    }).then(canvas => {
      const link = document.createElement('a');
      link.download = `QR-Code-Order-${order.id}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast({
        title: "QR Code berhasil diunduh",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    }).catch(err => {
      console.error("Error generating QR code image:", err);
      toast({
        title: "Gagal membuat gambar QR Code",
        description: err.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    });
  }, [order, toast]);

  // Fungsi untuk mengambil gambar status pengiriman
  // Helper function untuk transformasi URL yang konsisten dengan admin page
  const transformURL = (url) => {
    // Tambahkan cache busting dengan timestamp
    if (!url) return "";
    
    // Ganti domain lama dengan domain baru jika diperlukan
    if (url.includes('kurniasari-shipping-images.kurniasari.co.id')) {
      const fileName = url.split('/').pop().split('?')[0];
      url = `https://proses.kurniasari.co.id/${fileName}`;
    }
    
    // Tambahkan timestamp untuk cache busting
    return `${url}?t=${Date.now()}`;
  };

  // Mapping antara format frontend dan backend untuk tipe gambar
  const imageTypeMapping = {
    // Frontend → Backend
    'readyForPickup': 'ready_for_pickup',
    'pickedUp': 'picked_up',
    'received': 'delivered',
    // Backend → Frontend
    'ready_for_pickup': 'readyForPickup',
    'picked_up': 'pickedUp',
    'delivered': 'received'
  };

  const processShippingImages = (shippingImagesData) => {
    try {
      setLoadingImages(true);
      // Initialize with both backend and frontend keys for maximum compatibility
      const images = {
        // Backend keys
        ready_for_pickup: null,
        picked_up: null,
        delivered: null,
        // Frontend keys
        readyForPickup: null,
        pickedUp: null,
        received: null
      };
      
      console.log('DEBUG-PUBLIC-IMAGES: Processing shipping images from order:', shippingImagesData);
      
      if (Array.isArray(shippingImagesData)) {
        shippingImagesData.forEach(image => {
          // Transform URL to include timestamp for cache busting
          const transformedURL = transformURL(image.image_url);
          
          // Get the backend image type
          const backendType = image.image_type;
          
          // Get the corresponding frontend type
          const frontendType = imageTypeMapping[backendType];
          
          console.log(`DEBUG-PUBLIC-IMAGES: Mapping ${backendType} → ${frontendType}:`, transformedURL);
          
          // Store URL under both types for maximum compatibility
          images[backendType] = transformedURL;
          if (frontendType) {
            images[frontendType] = transformedURL;
          }
        });
      } else {
        console.log('DEBUG-PUBLIC-IMAGES: No shipping images found in order response or invalid format');
      }
      
      console.log('DEBUG-PUBLIC-IMAGES: Final images state:', images);
      setShippingImages(images);
    } catch (err) {
      console.error('Error processing shipping images:', err);
    } finally {
      setLoadingImages(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
      case 'settlement':
      case 'capture':
        return <Badge colorScheme="green">Lunas</Badge>;
      case 'pending':
        return <Badge colorScheme="yellow">Menunggu Pembayaran</Badge>;
      case 'expire':
      case 'expired':
        return <Badge colorScheme="red">Kadaluarsa</Badge>;
      case 'cancel':
      case 'deny':
        return <Badge colorScheme="red">Dibatalkan</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };
  
  // Fungsi untuk mendapatkan status pengiriman
  const getShippingStatusBadge = (order) => {
    if (!order || !order.shipping_status) return <Badge colorScheme="gray">Menunggu Diproses</Badge>;
    
    // Debug log untuk membantu troubleshooting
    console.log(`[getShippingStatusBadge] Raw shipping_status: "${order.shipping_status}"`);
    
    // Selalu gunakan shared utility agar konsisten dengan admin page
    const normalizedStatus = normalizeShippingStatus(order.shipping_status);
    console.log(`[getShippingStatusBadge] Normalized status: "${normalizedStatus}"`);
    
    const statusConfig = getShippingStatusConfig(normalizedStatus);
    return <Badge colorScheme={statusConfig.color}>{statusConfig.text}</Badge>;
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
                    {index === 2 && order?.shipping_status ? (
                      <Box position="relative" width="100%" height="100%" borderRadius="50%" overflow="hidden" display="flex" alignItems="center" justifyContent="center">
                        {/* Progress lingkaran hijau berdasarkan status pengiriman */}
                        <Box 
                          position="absolute" 
                          top="0" 
                          left="0" 
                          width="100%" 
                          height="100%" 
                          bgColor="green.500" 
                          zIndex="0"
                          transition="all 0.3s ease-in-out"
                          clipPath={
                            normalizeShippingStatus(order.shipping_status) === "dikemas" ? "polygon(0 0, 25% 0, 25% 100%, 0 100%)" :
                            normalizeShippingStatus(order.shipping_status) === "siap kirim" || normalizeShippingStatus(order.shipping_status) === "siap di ambil" ? "polygon(0 0, 50% 0, 50% 100%, 0 100%)" :
                            normalizeShippingStatus(order.shipping_status) === "dalam pengiriman" ? "circle(50%)" :
                            "circle(0%)"
                          }
                        />
                        <Box 
                          position="absolute"
                          top="0"
                          left="0"
                          width="100%"
                          height="100%"
                          borderRadius="50%"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          zIndex="1"
                        >
                          {normalizeShippingStatus(order.shipping_status) === "dalam pengiriman" ? (
                            <CheckIcon color="white" boxSize="16px" />
                          ) : (
                            <StepNumber fontSize="md" fontWeight="bold" color="gray.700" />
                          )}
                        </Box>
                      </Box>
                    ) : (
                      <StepStatus complete={<StepIcon />} incomplete={<StepNumber />} active={<StepNumber />} />
                    )}
                  </StepIndicator>
                  <Box flexShrink='0'>
                    <StepTitle>{step.title}</StepTitle>
                    {index === 2 && order?.shipping_status ? (
                      <StepDescription>
                        <Tag 
                          colorScheme="yellow" 
                          variant="solid" 
                          borderRadius="full"
                          px={2}
                          py={0.5}
                        >
                          {(() => {
                            const normalizedStatus = normalizeShippingStatus(order.shipping_status);
                            switch(normalizedStatus) {
                              case "dikemas": return "Dikemas";
                              case "siap kirim": return "Siap Kirim";
                              case "siap di ambil": return "Siap Ambil";
                              case "dalam pengiriman": return "Dalam Pengiriman";
                              case "diterima": return "Diterima";
                              default: return "Menunggu Diproses";
                            }
                          })()}
                        </Tag>
                      </StepDescription>
                    ) : (
                      <StepDescription>{step.description}</StepDescription>
                    )}
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
                {isPublicOrderPage && (
                  <>
                    <Text mt={4}><strong>Status Pengiriman:</strong> {getShippingStatusBadge(order)}</Text>
                    {order.shipping_area && (
                      <Text><strong>Area Pengiriman:</strong> {order.shipping_area === 'dalam-kota' ? 'Dalam Kota' : 'Luar Kota'}</Text>
                    )}
                    {order.pickup_method && (
                      <Text>
                        <strong>Metode {order.tipe_pesanan === 'Pesan Ambil' ? 'Ambil' : 'Antar'}:</strong> 
                        {order.pickup_method === 'deliveryman' || order.pickup_method === 'sendiri' ? 
                          (order.tipe_pesanan === 'Pesan Ambil' ? 'Di Ambil Konsumen' : 'Di Antar Deliveryman') : 
                          (order.tipe_pesanan === 'Pesan Ambil' ? 'Di Ambil Driver Ojek Online' : 'Di Antar Driver Ojek Online')
                        }
                      </Text>
                    )}
                    {order.tipe_pesanan && (
                      <Text><strong>Tipe Pesanan:</strong> {order.tipe_pesanan}</Text>
                    )}
                    {/* Display location information based on order type */}
                    {order.tipe_pesanan === 'Pesan Antar' && order.lokasi_pengiriman && (
                      <Text><strong>Lokasi Pengiriman:</strong> {order.lokasi_pengiriman}</Text>
                    )}
                    {order.tipe_pesanan === 'Pesan Ambil' && order.lokasi_pengambilan && (
                      <Text><strong>Lokasi Pengambilan:</strong> {order.lokasi_pengambilan}</Text>
                    )}
                    {order.shipping_area === 'luar-kota' && (
                      <>
                        {order.courier_service && (
                          <Text><strong>Jasa Kurir:</strong> {order.courier_service}</Text>
                        )}
                        {order.tracking_number ? (
                          <HStack>
                            <Text><strong>No. Resi:</strong> {order.tracking_number}</Text>
                            <Button
                              size="sm"
                              colorScheme="blue"
                              onClick={() => {
                                const courier = order.courier_service?.toUpperCase();
                                let trackingUrl = '';

                                if (courier === 'JNE') {
                                  trackingUrl = `https://www.jne.co.id/id/tracking/trace?receiptnumber=${order.tracking_number}`;
                                } else if (courier === 'TIKI') {
                                  trackingUrl = 'https://www.tiki.id/id/track';
                                  navigator.clipboard.writeText(order.tracking_number).then(() => {
                                    toast({ title: 'No. Resi Disalin', description: 'Nomor resi TIKI telah disalin ke clipboard.', status: 'success' });
                                  });
                                } else {
                                  // Generic fallback
                                  toast({ title: 'Lacak Manual', description: `Gunakan no. resi ${order.tracking_number} di situs kurir.`, status: 'info' });
                                  return;
                                }
                                
                                if (trackingUrl) {
                                  window.open(trackingUrl, '_blank', 'noopener,noreferrer');
                                }
                              }}
                            >
                              Lacak Resi
                            </Button>
                          </HStack>
                        ) : (
                          <Text><strong>No. Resi:</strong> <i>Belum tersedia</i></Text>
                        )}
                      </>
                    )}
                  </>
                )}
              </GridItem>
            </Grid>

            {/* Tampilkan link ke foto status pengiriman jika ada */}
            {isPublicOrderPage && (Object.values(shippingImages).some(Boolean)) && (
              <Box mt={6}>
                <Heading size="sm" mb={4}>Status {order.tipe_pesanan === "Pesan Antar" ? "Pengantaran" : "Pengambilan"}</Heading>
                <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={4}>
                  {/* Cek kedua format kunci (frontend dan backend) untuk maksimum kompatibilitas */}
                  {(shippingImages.ready_for_pickup || shippingImages.readyForPickup) && (
                    <GridItem>
                      <Text mb={2}><strong>{order.tipe_pesanan === "Pesan Antar" ? "Siap Diantar:" : "Siap Diambil:"}</strong></Text>
                      <Link 
                        href={shippingImages.ready_for_pickup || shippingImages.readyForPickup} 
                        isExternal 
                        color="blue.500" 
                        fontWeight="medium"
                      >
                        Lihat Foto {order.tipe_pesanan === "Pesan Antar" ? "Siap Diantar" : "Siap Diambil"}
                      </Link>
                    </GridItem>
                  )}
                  {(shippingImages.picked_up || shippingImages.pickedUp) && (
                    <GridItem>
                      <Text mb={2}><strong>{order.tipe_pesanan === "Pesan Antar" ? "Sudah Diantar:" : "Sudah Diambil:"}</strong></Text>
                      <Link 
                        href={shippingImages.picked_up || shippingImages.pickedUp} 
                        isExternal 
                        color="blue.500" 
                        fontWeight="medium"
                      >
                        Lihat Foto {order.tipe_pesanan === "Pesan Antar" ? "Sudah Diantar" : "Sudah Diambil"}
                      </Link>
                    </GridItem>
                  )}
                  {(shippingImages.delivered || shippingImages.received) && (
                    <GridItem>
                      <Text mb={2}><strong>Sudah Diterima:</strong></Text>
                      <Link 
                        href={shippingImages.delivered || shippingImages.received} 
                        isExternal 
                        color="blue.500" 
                        fontWeight="medium"
                      >
                        Lihat Foto Sudah Diterima
                      </Link>
                    </GridItem>
                  )}
                </Grid>
              </Box>
            )}

            {order.tipe_pesanan === 'Pesan Ambil' && (
              <Box mt={4}>
                <Heading size="sm" mb={2}>QR Code untuk Pengambilan</Heading>
                <Text fontSize="sm" color="gray.500" mb={4}>Tunjukkan QR code ini saat mengambil pesanan di outlet.</Text>
                <Flex justifyContent="center" my={4}>
                  <Box
                    p={4}
                    borderWidth="1px"
                    borderRadius="lg"
                    bg="white"
                    ref={qrCodeRef}
                    id="qrcode-container"
                  >
                    {order && order.id ? (
                      <VStack>
                        <QRCodeSVG 
                          value={`https://tagihan.kurniasari.co.id/orders/${order.id}`}
                          size={220}
                          level="H"
                          includeMargin={true}
                        />
                        <Text pt={2} fontSize="sm" fontWeight="bold">Order #{order.id}</Text>
                      </VStack>
                    ) : (
                      <Text>Order ID tidak tersedia.</Text>
                    )}
                  </Box>
                </Flex>
                <Button
                  onClick={handleDownloadQRCode}
                  colorScheme="blue"
                  size="sm"
                >
                  Download QR Code
                </Button>
                <Button
                  variant="outline"
                  colorScheme="blue"
                  size="sm"
                  onClick={() => {
                    if (order && order.id) {
                      const publicUrl = `https://tagihan.kurniasari.co.id/orders/${order.id}`;
                      const link = document.createElement('a');
                      link.href = publicUrl;
                      link.download = `Halaman-Status-Pesanan-${order.id}.html`;
                      link.click();
                      toast({
                        title: "Link Halaman Status Pesanan Konsumen diunduh",
                        status: "success",
                        duration: 2000,
                        isClosable: true,
                      });
                    } else {
                      toast({
                        title: "Gagal mengunduh link",
                        description: "Data pesanan belum siap.",
                        status: "error",
                        duration: 3000,
                        isClosable: true,
                      });
                    }
                  }}
                >
                  Download Halaman Status Pesanan Konsumen
                </Button>
              </Box>
            )}

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
