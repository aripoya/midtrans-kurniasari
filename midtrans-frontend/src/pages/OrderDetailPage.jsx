import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link as RouterLink, useLocation } from 'react-router-dom';
import { useRealTimeSync } from '../hooks/useRealTimeSync';
import {
  Box, Button, Center, Divider, Flex, Grid, GridItem, Heading, HStack, Icon,
  useToast, Step, StepDescription, StepIcon, StepIndicator, StepNumber, 
  StepSeparator, StepStatus, StepTitle, Stepper, useBreakpointValue,
  Tag, Container, Link, Image, SimpleGrid, Radio, RadioGroup, Stack,
  Text, VStack, Badge, Table, Tbody, Tr, Td, Th, Thead, Spinner,
  Alert, AlertIcon, Card, CardBody, CardHeader
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
import ShippingImageDisplay from '../components/ShippingImageDisplay';

function OrderDetailPage({ isOutletView, isDeliveryView }) {
  const { id } = useParams();
  const location = useLocation();
  const auth = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMarkingAsReceived, setIsMarkingAsReceived] = useState(false);
  const [selectedPhotoType, setSelectedPhotoType] = useState('ready_for_pickup'); // Default ke Foto Pengiriman - backend compatible
  const [shippingImages, setShippingImages] = useState({
    ready_for_pickup: null,
    picked_up: null,
    delivered: null,
  });
  const [loadingImages, setLoadingImages] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [imageVersion, setImageVersion] = useState(Date.now());
  const qrCodeRef = useRef(null);
  const toast = useToast();
  
  // Real-time sync untuk public order detail page
  const { syncStatus, manualRefresh } = useRealTimeSync({
    role: 'public',
    onUpdate: (updateInfo) => {
      console.log('PUBLIC ORDER SYNC: New updates detected:', updateInfo);
      // Refresh order when updates are detected
      fetchOrderDetails();
    },
    pollingInterval: 60000, // Poll every 60 seconds (1 minute) - optimized for cost efficiency
    enabled: true
  });
  
  // State untuk fitur upload foto kurir
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Fungsi untuk memilih foto
  const handlePhotoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      console.log('Selected photo:', file.name, file.type, file.size);
      setPhotoFile(file);
      
      // Tampilkan preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Fungsi untuk upload foto
 const handlePhotoUpload = async () => {
    if (!photoFile) return;
    
    try {
      setUploadLoading(true);
      
      // Upload foto menggunakan adminApi dengan tipe yang dipilih oleh kurir
      const result = await adminApi.uploadShippingImage(id, selectedPhotoType, photoFile);
      console.log('Upload result:', result);
      await handleRefreshStatus();
      setPhotoPreview(null);
      setPhotoFile(null);
      // Update status pesanan jika upload berhasil
      if (result && result.data && result.data.imageUrl) {
        // Perbarui status pesanan berdasarkan jenis foto yang diupload
        let newStatus = 'dalam pengiriman';
        
        if (selectedPhotoType === 'siap_kirim') {
          newStatus = 'siap kirim';
        } else if (selectedPhotoType === 'diterima') {
          newStatus = 'diterima';
        }
        
        await adminApi.updateOrderShippingStatus(id, newStatus);
        
        // Perbarui state shippingImages langsung untuk menampilkan foto yang baru diunggah
        // tanpa perlu menunggu refresh data
        setShippingImages(prev => {
          const newImages = { ...prev };
          
          // Perbarui status backend
          newImages[selectedPhotoType] = result.data.imageUrl;
          
          // Perbarui juga status frontend (jika ada)
          if (selectedPhotoType === 'siap_kirim') {
            newImages.ready_for_pickup = result.data.imageUrl;
            newImages.readyForPickup = result.data.imageUrl; // Legacy support
          } else if (selectedPhotoType === 'pengiriman') {
            newImages.picked_up = result.data.imageUrl;
            newImages.pickedUp = result.data.imageUrl; // Legacy support
          } else if (selectedPhotoType === 'diterima') {
            newImages.delivered = result.data.imageUrl;
            newImages.received = result.data.imageUrl; // Legacy support
          }
          
          return newImages;
        });
        
        toast({
          title: 'Sukses',
          description: 'Foto berhasil diunggah dan status diperbarui',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Reset form dan reload data
        setPhotoFile(null);
        setPhotoPreview(null);
        fetchOrder();
      }

      // upload
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: 'Error',
        description: 'Terjadi kesalahan saat mengunggah foto',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setUploadLoading(false);
    }
  };
  const stepperOrientation = useBreakpointValue({ base: 'vertical', md: 'horizontal' });
  const stepperSize = useBreakpointValue({ base: 'sm', md: 'md' });
  
  // Check if this is a public order page (ID starts with ORDER-)
  const isPublicOrderPage = id && id.startsWith('ORDER-');

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log(`🔄 Fetching order with ID: ${id}`);
      let orderData;
      
      if (isOutletView || isDeliveryView) {
        // Check authentication first for delivery/outlet view
        const token = sessionStorage.getItem('token');
        const user = sessionStorage.getItem('user');
        
        console.log(`🔍 [${isDeliveryView ? 'DELIVERY' : 'OUTLET'}] Token exists:`, !!token);
        console.log(`🔍 [${isDeliveryView ? 'DELIVERY' : 'OUTLET'}] User data:`, !!user);
        
        if (!token || !user) {
          throw new Error(`Authentication required. Please log in as ${isDeliveryView ? 'deliveryman' : 'outlet manager'}.`);
        }
        
        // Jika outlet/delivery view, gunakan adminApi untuk mendapatkan order
        console.log(`🔍 [${isDeliveryView ? 'DELIVERY' : 'OUTLET'}] Fetching order details for:`, id);
        const response = await adminApi.getOrderDetails(id);
        
        console.log(`🔍 [${isDeliveryView ? 'DELIVERY' : 'OUTLET'}] API Response:`, response);
        
        if (!response.success || !response.data) {
          const errorMsg = response.error || 'Failed to fetch order details';
          console.error(`❌ [${isDeliveryView ? 'DELIVERY' : 'OUTLET'}] API Error:`, errorMsg);
          throw new Error(errorMsg);
        }
        orderData = response.data;
      } else if (isPublicOrderPage) {
        // For public order pages, use adminApi directly without authentication
        console.log(`🔍 Fetching public order with ID: ${id}`);
        
        try {
          // Selalu gunakan production API untuk public order agar konsisten dengan admin/outlet/kurir
          const API_BASE_URL = 'https://order-management-app-production.wahwooh.workers.dev';
          console.log('🌐 Menggunakan production API URL untuk konsistensi data:', API_BASE_URL);
          
          // PERBAIKAN: Gunakan API_BASE_URL yang sudah didefinisikan dan endpoint yang benar '/api/orders/:id'
          console.log(`🔗 Mencoba mengakses: ${API_BASE_URL}/api/orders/${id}`);
          const response = await axios.get(`${API_BASE_URL}/api/orders/${id}`);
          
          // Handle different response formats
          if (response.data?.success) {
            if (response.data.order) {
              orderData = response.data.order;
            } else if (response.data.data) {
              orderData = response.data.data;
            }
          } else if (response.data?.order) {
            orderData = response.data.order;
          } else if (response.data?.data) {
            orderData = response.data.data;
          } else {
            orderData = response.data;
          }
          
          if (!orderData) {
            throw new Error('Format respons tidak dikenali');
          }
        } catch (apiError) {
          console.error('❌ Error dalam mengambil data pesanan:', apiError);
          // Fallback to order service if direct API call fails
          try {
            const response = await orderService.getOrderById(id);
            orderData = response;
          } catch (serviceError) {
            console.error('Fallback ke orderService juga gagal:', serviceError);
            throw apiError; // Throw original error
          }
        }
      } else {
        // For protected pages, use orderService which includes auth
        const serviceResponse = await orderService.getOrderById(id);
        if (serviceResponse?.success && serviceResponse?.order) {
          orderData = serviceResponse.order;
        } else if (serviceResponse?.success && serviceResponse?.data) {
          orderData = serviceResponse.data;
        } else {
          orderData = serviceResponse; // Asumsi response langsung adalah data
        }
        
        if (!orderData) {
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
  }, [id, isOutletView, isDeliveryView, isPublicOrderPage]);

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
        const apiUrl = import.meta.env.VITE_API_URL || 'https://order-management-app-production.wahwooh.workers.dev';
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
      
      // Gunakan adminApi.updateOrderShippingStatus alih-alih markOrderAsReceived
      const result = await adminApi.updateOrderShippingStatus(id, 'diterima');
      console.log('Result from updateOrderShippingStatus:', result);
      
      if (!result.success && !result.data) {
        throw new Error('Gagal menandai pesanan sebagai diterima');
      }
      
      toast({
        title: "Pesanan diterima",
        description: "Pesanan telah berhasil ditandai sebagai diterima.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      
      // Segera perbarui status order di UI untuk menghindari perlu refresh
      setOrder(prevOrder => ({
        ...prevOrder,
        shipping_status: 'diterima' // Update shipping status langsung di state
      }));
      
      // Delay sedikit sebelum refresh untuk memastikan data terupdate di server
      setTimeout(() => fetchOrder(), 1000); // Refresh order data setelah delay lebih lama
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
  }, [id, toast]); // ✅ Removed fetchOrder to prevent infinite loop

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

  // Fungsi untuk mengambil gambar status pesanan
  // Helper function untuk transformasi URL yang konsisten dengan admin page
  const transformURL = (url) => {
    // Tambahkan cache busting dengan timestamp
    if (!url) return "";
    
    // Debug logging untuk troubleshooting
    console.log('🖼️ [Public] Original image URL:', url);
    
    // Remove any existing timestamp parameter
    let cleanUrl = url;
    if (url.includes('?')) {
      cleanUrl = url.split('?')[0];
    }
    
    // Handle kurniasari-shipping-images.kurniasari.co.id URLs
    if (cleanUrl.includes('kurniasari-shipping-images.kurniasari.co.id')) {
      const fileName = cleanUrl.split('/').pop();
      const transformedUrl = `https://proses.kurniasari.co.id/${fileName}?t=${Date.now()}`;
      console.log('🖼️ [Public] Transformed to proses.kurniasari.co.id:', transformedUrl);
      return transformedUrl;
    }
    
    // Handle R2 storage URLs
    if (cleanUrl.includes('13b5c18f23aa268941269ea0db1d1e5a.r2.cloudflarestorage.com')) {
      const transformedUrl = `${cleanUrl}?t=${Date.now()}`;
      console.log('🖼️ [Public] Using R2 URL directly:', transformedUrl);
      return transformedUrl;
    }
    
    // For proses.kurniasari.co.id URLs
    if (cleanUrl.includes('proses.kurniasari.co.id')) {
      const transformedUrl = `${cleanUrl}?t=${Date.now()}`;
      console.log('🖼️ [Public] Using proses.kurniasari.co.id URL:', transformedUrl);
      return transformedUrl;
    }
    
    // Default: Always add timestamp parameter
    const finalUrl = `${cleanUrl}?t=${Date.now()}`;
    console.log('🖼️ [Public] Default transform (add timestamp):', finalUrl);
    return finalUrl;
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
  
  // Fungsi untuk mendapatkan status pesanan - memoized untuk performance
  const getShippingStatusBadge = useCallback((order) => {
    if (!order || !order.shipping_status) return <Badge colorScheme="gray">Menunggu Diproses</Badge>;
    
    // Selalu gunakan shared utility agar konsisten dengan admin page
    const normalizedStatus = normalizeShippingStatus(order.shipping_status);
    const statusConfig = getShippingStatusConfig(normalizedStatus);
    return <Badge colorScheme={statusConfig.color}>{statusConfig.text}</Badge>;
  }, []); // ✅ Memoized to prevent recreation on every render

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
        if (['received', 'Sudah Di Terima', 'Sudah Di Ambil', 'diterima'].includes(shippingStatus)) {
          activeStep = 4; // Set to step 4 (last step) when order is received
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
              <Heading size="md">Detail Pesanan {order?.id ? `#${order.id}` : 'Loading...'}</Heading>
            </Flex>
          </CardHeader>
          <CardBody>
            <Stepper index={activeStep} orientation={stepperOrientation} colorScheme="green" size={stepperSize} mb={8}>
              {steps.map((step, index) => (
                <Step key={index}>
                  <StepIndicator>
                    {index === 2 && order && order.shipping_status ? (
                       <Box position="relative" width="100%" height="100%" borderRadius="50%" overflow="hidden" display="flex" alignItems="center" justifyContent="center">
                         {/* Progress lingkaran hijau berdasarkan status pesanan */}
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
                            if (!order?.shipping_status) return "Menunggu Diproses";
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
                {isPublicOrderPage && (() => {
                  // Check if order is paid and has been managed by admin
                  const isPaid = ['paid', 'settlement', 'capture'].includes(order.payment_status);
                  
                  // More strict check: only show shipping info if admin has actually processed the order
                  // Admin processing means shipping_status is NOT pending/empty and has a real processing status
                  const adminProcessedStatuses = ['dikemas', 'siap kirim', 'siap ambil', 'dalam pengiriman', 'diterima', 'sudah di terima', 'sudah di ambil'];
                  const hasBeenProcessedByAdmin = order.shipping_status && 
                    adminProcessedStatuses.includes(order.shipping_status.toLowerCase().trim());
                  
                  // Only show shipping information if order is paid AND admin has processed it (not pending)
                  const shouldShowShippingInfo = isPaid && hasBeenProcessedByAdmin;
                  
                  return (
                    <>
                      {shouldShowShippingInfo && (
                        <>
                          <Heading size="sm" mt={6} mb={4}>Informasi Pengiriman</Heading>
                          <Text><strong>Status Pesanan:</strong> {getShippingStatusBadge(order)}</Text>
                        </>
                      )}
                      {shouldShowShippingInfo && order.shipping_area && (
                        <Text><strong>Area Pengiriman:</strong> {order.shipping_area === 'dalam-kota' ? 'Dalam Kota' : 'Luar Kota'}</Text>
                      )}
                      {shouldShowShippingInfo && order.pickup_method && order.shipping_area !== 'luar-kota' && (
                        <Text>
                          <strong>Metode {order.tipe_pesanan === 'Pesan Ambil' ? 'Ambil' : 'Antar'}:</strong> 
                          {order.pickup_method === 'deliveryman' || order.pickup_method === 'sendiri' ? 
                            (order.tipe_pesanan === 'Pesan Ambil' ? 'Di Ambil Konsumen' : 'Di Antar Deliveryman') : 
                            (order.tipe_pesanan === 'Pesan Ambil' ? 'Di Ambil Driver Ojek Online' : 'Di Antar Driver Ojek Online')
                          }
                        </Text>
                      )}
                      {shouldShowShippingInfo && order.tipe_pesanan && order.shipping_area !== 'luar-kota' && (
                        <Text><strong>Tipe Pesanan:</strong> {order.tipe_pesanan}</Text>
                      )}
                      {/* Display location information based on order type and shipping area */}
                      {shouldShowShippingInfo && order.tipe_pesanan === 'Pesan Antar' && order.lokasi_pengiriman && order.shipping_area !== 'luar-kota' && (
                        <Text><strong>Lokasi Pengiriman:</strong> {order.lokasi_pengiriman}</Text>
                      )}
                      {shouldShowShippingInfo && order.tipe_pesanan === 'Pesan Ambil' && order.lokasi_pengambilan && (
                        <Text><strong>Lokasi Pengambilan:</strong> {order.lokasi_pengambilan}</Text>
                      )}
                      {shouldShowShippingInfo && order.shipping_area === 'luar-kota' && (
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
                );
                })()}
              </GridItem>
            </Grid>

            {/* Komponen upload foto untuk deliveryman */}
            {isDeliveryView && order && (
              <Box mt={6} mb={4} p={4} borderWidth="1px" borderRadius="lg" bg="white">
                <Heading size="sm" mb={3}>Upload Foto</Heading>
                <Text fontSize="sm" color="gray.600" mb={4}>
                  Pilih jenis foto dan unggah untuk memperbarui status pesanan.
                </Text>
                
                <RadioGroup onChange={setSelectedPhotoType} value={selectedPhotoType} mb={4}>
                  <Stack direction="row" spacing={5}>
                    <Radio value="ready_for_pickup" colorScheme="blue">
                      Foto Siap Kirim
                    </Radio>
                    <Radio value="picked_up" colorScheme="green">
                      Foto Pengiriman
                    </Radio>
                    <Radio value="delivered" colorScheme="purple">
                      Foto Diterima
                    </Radio>
                  </Stack>
                </RadioGroup>
                
                <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={6}>
                  <GridItem>
                    <VStack spacing={4} align="start">
                      <input
                        type="file"
                        accept="image/*"
                        id="photo-upload"
                        onChange={handlePhotoChange}
                        style={{ display: 'none' }}
                      />
                      <Button 
                        as="label" 
                        htmlFor="photo-upload"
                        colorScheme="blue"
                        leftIcon={<span>📷</span>}
                        isDisabled={uploadLoading}
                      >
                        Pilih Foto
                      </Button>
                      
                      {photoFile && (
                        <Text fontSize="sm">
                          File: {photoFile.name} ({Math.round(photoFile.size / 1024)} KB)
                        </Text>
                      )}
                      
                      <Button 
                        onClick={handlePhotoUpload}
                        colorScheme="green"
                        isLoading={uploadLoading}
                        isDisabled={!photoFile}
                        leftIcon={<span>⬆️</span>}
                        mt={4}
                      >
                        Upload Foto & Perbarui Status
                      </Button>
                      
                      <Text fontSize="sm" fontWeight="medium" 
                        color={selectedPhotoType === 'siap_kirim' ? 'blue.600' : 
                               selectedPhotoType === 'pengiriman' ? 'green.600' : 'purple.600'} 
                        mt={2}>
                        Status foto: {selectedPhotoType === 'siap_kirim' ? 'Foto Siap Kirim' : 
                                  selectedPhotoType === 'pengiriman' ? 'Foto Pengiriman' : 'Foto Diterima'}
                      </Text>
                      
                      <Text fontSize="xs" color="gray.500" mt={1}>
                        *Status pesanan akan otomatis diperbarui menjadi 
                        "{selectedPhotoType === 'siap_kirim' ? 'Siap Kirim' : 
                          selectedPhotoType === 'pengiriman' ? 'Dalam Pengiriman' : 'Diterima'}"
                      </Text>
                    </VStack>
                  </GridItem>
                  
                  <GridItem>
                    <Box borderWidth="1px" borderRadius="md" p={2} height="200px" display="flex" alignItems="center" justifyContent="center">
                      {photoPreview ? (
                        <Image 
                          src={photoPreview} 
                          alt="Preview" 
                          maxH="100%" 
                          objectFit="contain"
                        />
                      ) : (
                        <Text color="gray.400">Pratinjau foto akan muncul di sini</Text>
                      )}
                    </Box>
                  </GridItem>
                </Grid>
              </Box>
            )}
            
            {/* Tampilkan link ke foto status pesanan jika ada */}
            {(isPublicOrderPage || isDeliveryView) && (Object.values(shippingImages).some(Boolean)) && (
              <Box mt={6} mb={4}>
                <Heading size="sm" mb={3}>Status Foto Pesanan</Heading>
                
                {/* Kondisional rendering berdasarkan shipping_area */}
                {order && order.shipping_area === 'luar-kota' ? (
                  // Untuk luar kota, hanya tampilkan 1 foto (Foto Diterima)
                  <Box p={3} borderWidth="1px" borderRadius="md" bg="white" textAlign="center">
                    <ShippingImageDisplay
                      imageUrl={shippingImages.delivered || shippingImages.received || ""}
                      type="received"
                      label="Foto Diterima"
                      maxHeight="150px"
                      showPlaceholder={true}
                    />
                  </Box>
                ) : (
                  // Untuk dalam kota, tampilkan 3 foto
                  <SimpleGrid columns={{base: 1, md: 3}} spacing={4}>
                    {/* Ready for Pickup Image */}
                    <Box p={3} borderWidth="1px" borderRadius="md" bg="white" textAlign="center">
                      <ShippingImageDisplay
                       imageUrl={shippingImages.ready_for_pickup || shippingImages.readyForPickup || ""}
                        type="readyForPickup"
                        label="Foto Siap Kirim"
                        maxHeight="120px"
                        showPlaceholder={true}
                      />
                    </Box>
                    
                    {/* Picked Up / In Transit Image */}
                    <Box p={3} borderWidth="1px" borderRadius="md" bg="white" textAlign="center">
                      <ShippingImageDisplay
                        imageUrl={shippingImages.picked_up || shippingImages.pickedUp || ""}
                        type="pickedUp"
                        label="Foto Pengiriman"
                        maxHeight="120px"
                        showPlaceholder={true}
                      />
                    </Box>
                    
                    {/* Delivered / Received Image */}
                    <Box p={3} borderWidth="1px" borderRadius="md" bg="white" textAlign="center">
                      <ShippingImageDisplay
                        imageUrl={shippingImages.delivered || shippingImages.received || ""}
                        type="received"
                        label="Foto Diterima"
                        maxHeight="120px"
                        showPlaceholder={true}
                      />
                    </Box>
                  </SimpleGrid>
                )}
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
                          value={`https://order-management-app-production.wahwooh.workers.dev/api/orders/${order.id}`}
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
                      const publicUrl = `https://order-management-app-production.wahwooh.workers.dev/api/orders/${order.id}`;
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
                Perbarui Status Pembayaran
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
