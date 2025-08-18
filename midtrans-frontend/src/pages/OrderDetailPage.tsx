import React, { useState, useEffect, useRef, useCallback, ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useRealTimeSync } from '../hooks/useRealTimeSync';
import {
  Box, Button, Center, Divider, Flex, Grid, GridItem, Heading, HStack,
  useToast, Step, StepDescription, StepIcon, StepIndicator, StepNumber, 
  StepSeparator, StepStatus, StepTitle, Stepper,
  Container, Image, Radio, RadioGroup, Stack,
  Text, VStack, Badge, Table, Tbody, Tr, Td, Th, Thead, Spinner,
  Alert, AlertIcon, Card, CardBody, CardHeader, Input, FormControl, FormLabel
} from '@chakra-ui/react';
import { orderService } from '../api/orderService';
import { refreshOrderStatus, markOrderAsReceived } from '../api/api';
import { normalizeShippingStatus, getShippingStatusConfig } from '../utils/orderStatusUtils';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { adminApi } from '../api/adminApi';
import ShippingImageDisplay from '../components/ShippingImageDisplay';

// Local TypeScript interfaces for this component
interface OrderItem {
  product_name: string;
  quantity: number;
  product_price: number;
}

// Complete Order interface for this component with all required properties
interface LocalOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  shipping_area: 'dalam_kota' | 'luar_kota';
  pickup_method: string;
  courier_service?: string;
  tracking_number?: string;
  total_amount: number;
  payment_status: string;
  shipping_status: string;
  payment_url?: string;
  created_at: string;
  items: OrderItem[];
  shipping_images?: {
    ready_for_pickup?: string;
    picked_up?: string;
    delivered?: string;
  };
}

interface ShippingImages {
  ready_for_pickup: string | null;
  picked_up: string | null;
  delivered: string | null;
}

interface OrderDetailPageProps {
  isOutletView?: boolean;
  isDeliveryView?: boolean;
}

const OrderDetailPage: React.FC<OrderDetailPageProps> = ({ isOutletView, isDeliveryView }) => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<LocalOrder | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isMarkingAsReceived, setIsMarkingAsReceived] = useState<boolean>(false);
  const [selectedPhotoType, setSelectedPhotoType] = useState<'ready_for_pickup' | 'picked_up' | 'delivered'>('picked_up');
  const [shippingImages, setShippingImages] = useState<ShippingImages>({
    ready_for_pickup: null,
    picked_up: null,
    delivered: null,
  });

  const [showQRCode, setShowQRCode] = useState<boolean>(false);
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  
  // Real-time sync untuk public order detail page
  useRealTimeSync({
    role: 'public',
    onUpdate: (updateInfo: any) => {
      console.log('PUBLIC ORDER SYNC: New updates detected:', updateInfo);
      // Refresh order when updates are detected
      fetchOrderDetails();
    },
    pollingInterval: 60000, // Poll every 60 seconds (1 minute) - optimized for cost efficiency
    enabled: true
  });
  
  // State untuk fitur upload foto kurir
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);
  
  // Fungsi untuk memilih foto
  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      console.log('Selected photo:', file.name, file.type, file.size);
      setPhotoFile(file);
      
      // Tampilkan preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Fungsi untuk upload foto
  const handlePhotoUpload = async (): Promise<void> => {
    if (!photoFile || !id) return;
    
    try {
      setUploadLoading(true);
      
      // Upload foto menggunakan adminApi dengan tipe yang dipilih oleh kurir
      const result = await adminApi.uploadShippingImage(id, selectedPhotoType, photoFile);
      console.log('Upload result:', result);
      
      // Update status pesanan jika upload berhasil
      if (result && result.data && result.data.imageUrl) {
        // Perbarui status pesanan berdasarkan jenis foto yang diupload
        let newStatus = 'dalam pengiriman';
        
        if (selectedPhotoType === 'ready_for_pickup') {
          newStatus = 'siap kirim';
        } else if (selectedPhotoType === 'delivered') {
          newStatus = 'diterima';
        }
        
        await adminApi.updateOrderShippingStatus(id, newStatus);
        
        // Perbarui state shippingImages langsung untuk menampilkan foto yang baru diunggah
        setShippingImages(prev => ({
          ...prev,
          [selectedPhotoType]: result.data.imageUrl
        }));
        
        // Refresh order details untuk mendapatkan update terbaru
        await fetchOrderDetails();
        
        toast({
          title: "Foto berhasil diunggah",
          description: `Foto ${selectedPhotoType === 'ready_for_pickup' ? 'Siap Kirim' : 
                       selectedPhotoType === 'picked_up' ? 'Pengiriman' : 'Diterima'} telah disimpan.`,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        
        // Reset form
        setPhotoFile(null);
        setPhotoPreview(null);
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
      } else {
        throw new Error('Gagal mendapatkan URL gambar dari response');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Gagal mengunggah foto",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat upload",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setUploadLoading(false);
    }
  };

  // Map API order object to LocalOrder shape used by this component
  const mapToLocalOrder = (apiOrder: any): LocalOrder => {
    try {
      const items = Array.isArray(apiOrder?.items)
        ? apiOrder.items.map((it: any) => ({
            product_name: it?.product_name || it?.name || '-',
            quantity: Number(it?.quantity) || 0,
            product_price: Number(it?.product_price ?? it?.price ?? 0),
          }))
        : [];
      
      const shipping_area: 'dalam_kota' | 'luar_kota' =
        apiOrder?.shipping_area === 'luar_kota' || apiOrder?.shipping_area === 'luar-kota'
          ? 'luar_kota'
          : 'dalam_kota';
      
      const mapped: LocalOrder = {
        id: String(apiOrder?.id || ''),
        customer_name: apiOrder?.customer_name || apiOrder?.name || '-',
        customer_phone: apiOrder?.customer_phone || apiOrder?.phone || '-',
        customer_address: apiOrder?.customer_address || apiOrder?.address || '-',
        shipping_area,
        pickup_method: apiOrder?.pickup_method || '',
        courier_service: apiOrder?.courier_service || undefined,
        tracking_number: apiOrder?.tracking_number || undefined,
        total_amount: Number(apiOrder?.total_amount) || 0,
        payment_status: apiOrder?.payment_status || 'pending',
        shipping_status: apiOrder?.shipping_status || 'menunggu diproses',
        payment_url: apiOrder?.payment_url || undefined,
        created_at: apiOrder?.created_at || new Date().toISOString(),
        items,
        shipping_images: apiOrder?.shipping_images || undefined,
      };
      return mapped;
    } catch (e) {
      console.error('[OrderDetailPage] Failed to map order, returning minimal shape', e);
      return {
        id: String(apiOrder?.id || ''),
        customer_name: apiOrder?.customer_name || apiOrder?.name || '-',
        customer_phone: apiOrder?.customer_phone || apiOrder?.phone || '-',
        customer_address: apiOrder?.customer_address || apiOrder?.address || '-',
        shipping_area: 'dalam_kota',
        pickup_method: apiOrder?.pickup_method || '',
        total_amount: Number(apiOrder?.total_amount) || 0,
        payment_status: apiOrder?.payment_status || 'pending',
        shipping_status: apiOrder?.shipping_status || 'menunggu diproses',
        created_at: apiOrder?.created_at || new Date().toISOString(),
        items: [],
      } as LocalOrder;
    }
  };

  const fetchOrderDetails = useCallback(async (): Promise<void> => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Gunakan API umum untuk semua view dan parse response
      const response = await orderService.getOrderById(id);
      const apiOrder: any = (response as any)?.order || (response as any)?.data || response;
      
      if (apiOrder) {
        const mappedOrder: LocalOrder = mapToLocalOrder(apiOrder);
        setOrder(mappedOrder);
        // Proses shipping images jika ada
        if (mappedOrder.shipping_images) {
          processShippingImages(mappedOrder.shipping_images);
        }
      } else {
        setError('Pesanan tidak ditemukan');
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      setError('Gagal memuat detail pesanan');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleRefreshStatus = async (): Promise<void> => {
    if (!id) return;
    
    try {
      setIsRefreshing(true);
      
      // Refresh payment status dari Midtrans
      await refreshOrderStatus(id);
      
      // Fetch ulang data order
      await fetchOrderDetails();
      
      toast({
        title: "Status diperbarui",
        description: "Status pesanan telah diperbarui dari sistem pembayaran",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error refreshing status:', error);
      toast({
        title: "Gagal memperbarui status",
        description: "Terjadi kesalahan saat memperbarui status",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleMarkAsReceived = async (): Promise<void> => {
    if (!id) return;
    
    try {
      setIsMarkingAsReceived(true);
      
      await markOrderAsReceived(id);
      
      // Fetch ulang data order
      await fetchOrderDetails();
      
      toast({
        title: "Pesanan ditandai sebagai diterima",
        description: "Status pesanan telah diperbarui",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error marking as received:', error);
      toast({
        title: "Gagal menandai pesanan",
        description: "Terjadi kesalahan saat memperbarui status",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsMarkingAsReceived(false);
    }
  };

  const handleDownloadQRCode = async (): Promise<void> => {
    if (qrCodeRef.current) {
      try {
        const canvas = await html2canvas(qrCodeRef.current);
        const link = document.createElement('a');
        link.download = `qr-code-order-${order?.id}.png`;
        link.href = canvas.toDataURL();
        link.click();
        
        toast({
          title: "QR Code berhasil diunduh",
          status: "success",
          duration: 2000,
          isClosable: true,
        });
      } catch (error) {
        console.error('Error downloading QR code:', error);
        toast({
          title: "Gagal mengunduh QR Code",
          description: "Terjadi kesalahan saat membuat QR Code",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      }
    }
  };

  // Helper function untuk transformasi URL yang konsisten dengan admin page
  const transformURL = (url: string): string => {
    if (!url) return url;
    
    // Jika sudah berupa URL Cloudflare Images yang valid, return langsung
    if (url.includes('imagedelivery.net') || url.includes('cloudflareimages.com')) {
      return url;
    }
    
    // Jika berupa format lama dengan path /api/images/, transform ke Cloudflare Images
    if (url.includes('/api/images/')) {
      const filename = url.split('/').pop();
      if (filename) {
        // Transform ke format Cloudflare Images
        const baseUrl = 'https://imagedelivery.net/ZB3RMqDfebexy8n_rRUJkA';
        return `${baseUrl}/${filename}/public`;
      }
    }
    
    // Jika berupa base64 atau format lain, return as-is
    return url;
  };

  const processShippingImages = (shippingImagesData: any): void => {
    try {
      const processedImages: ShippingImages = {
        ready_for_pickup: null,
        picked_up: null,
        delivered: null
      };

      // Process setiap tipe gambar
      Object.keys(processedImages).forEach((key) => {
        const imageKey = key as keyof ShippingImages;
        if (shippingImagesData[imageKey]) {
          processedImages[imageKey] = transformURL(shippingImagesData[imageKey]);
        }
      });

      setShippingImages(processedImages);
      console.log('🖼️ [OrderDetailPage] Processed shipping images:', processedImages);
    } catch (error) {
      console.error('🖼️ [OrderDetailPage] Error processing shipping images:', error);
    }
  };

  const getStatusBadge = (status: string): JSX.Element => {
    const colorScheme = status === 'paid' ? 'green' : 
                       status === 'pending' ? 'yellow' : 'red';
    const displayText = status === 'paid' ? 'Lunas' :
                       status === 'pending' ? 'Menunggu' : 'Gagal';
    
    return <Badge colorScheme={colorScheme}>{displayText}</Badge>;
  };

  // Fungsi untuk mendapatkan status pesanan
  const getShippingStatusBadge = (order: LocalOrder): JSX.Element => {
    const status = normalizeShippingStatus(order.shipping_status);
    const config = getShippingStatusConfig(status);
    
    return <Badge colorScheme={config.color}>{config.text}</Badge>;
  };

  const getPaymentSteps = (): Array<{title: string, description: string, status: 'complete' | 'active' | 'incomplete'}> => {
    if (!order) return [];

    const isPaid = order.payment_status === 'paid';
    const normalizedStatus = normalizeShippingStatus(order.shipping_status);
    const isShipped = ['siap kirim', 'dalam pengiriman', 'diterima'].includes(normalizedStatus);
    const isReceived = normalizedStatus === 'diterima';

    return [
      {
        title: 'Pembayaran',
        description: isPaid ? 'Pembayaran berhasil' : 'Menunggu pembayaran',
        status: isPaid ? 'complete' : 'active'
      },
      {
        title: 'Persiapan',
        description: isShipped ? 'Pesanan sedang disiapkan' : 'Menunggu pembayaran',
        status: isPaid ? (isShipped ? 'complete' : 'active') : 'incomplete'
      },
      {
        title: 'Pengiriman',
        description: isShipped ? 'Pesanan dalam pengiriman' : 'Belum dikirim',
        status: isShipped ? (isReceived ? 'complete' : 'active') : 'incomplete'
      },
      {
        title: 'Diterima',
        description: isReceived ? 'Pesanan diterima' : 'Belum diterima',
        status: isReceived ? 'complete' : 'incomplete'
      }
    ];
  };

  // Handler print 56mm thermal receipt
  const handlePrintReceipt = (): void => {
    window.print();
  };

  useEffect(() => {
    fetchOrderDetails();
  }, [fetchOrderDetails]);

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

  const isPaid = order.payment_status === 'paid';
  const isReceived = order.shipping_status === 'diterima';
  const steps = getPaymentSteps();
  const currentStep = steps.findIndex(step => step.status === 'active');

  // Tentukan apakah harus menampilkan foto berdasarkan shipping_area
  const isLuarKota = order.shipping_area === 'luar_kota';
  const photoSlotsToShow = isLuarKota ? ['delivered'] : ['ready_for_pickup', 'picked_up', 'delivered'];
  const paymentText = order.payment_status === 'paid' ? 'Lunas' : order.payment_status === 'pending' ? 'Menunggu' : 'Gagal';

  return (
    <>
      {/* Print-only stylesheet for 56mm thermal receipt */}
      <style>{`
        #thermal-receipt { display: none; }
        @media print {
          @page { size: 56mm auto; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body * { visibility: hidden !important; }
          #thermal-receipt, #thermal-receipt * { visibility: visible !important; }
          #thermal-receipt {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 56mm;
            padding: 2mm 2mm;
            font-family: Arial, sans-serif;
            font-size: 10px;
            color: #000;
          }
          #thermal-receipt .title { text-align: center; font-weight: bold; font-size: 12px; margin-bottom: 4px; }
          #thermal-receipt hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
          #thermal-receipt .section-title { font-weight: bold; margin: 2px 0; }
          #thermal-receipt .line { display: flex; justify-content: space-between; gap: 6px; }
          #thermal-receipt .items { margin-top: 2px; }
          #thermal-receipt .item-name { word-break: break-word; }
          #thermal-receipt .totals { margin-top: 6px; border-top: 1px dashed #000; padding-top: 4px; }
        }
      `}</style>

      {/* Print-only content */}
      <Box id="thermal-receipt">
        <div className="title">Order #{order.id}</div>
        <hr />
        <div className="section">
          <div className="section-title">Informasi Pelanggan</div>
          <div className="line"><span>Nama</span><span>{order.customer_name || '-'}</span></div>
          <div className="line"><span>Telepon</span><span>{order.customer_phone || '-'}</span></div>
          <div className="line"><span>Alamat</span><span>{order.customer_address || '-'}</span></div>
        </div>
        <hr />
        <div className="section">
          <div className="section-title">Detail Pembayaran</div>
          <div className="line"><span>Status</span><span>{paymentText}</span></div>
          <div className="line"><span>Total</span><span>Rp {order.total_amount?.toLocaleString('id-ID')}</span></div>
        </div>
        <hr />
        <div className="section">
          <div className="section-title">Barang Pesanan</div>
          <div className="items">
            {order.items && order.items.map((it, idx) => (
              <div key={idx} style={{ marginBottom: '2px' }}>
                <div className="item-name">{it.product_name}</div>
                <div className="line">
                  <span>{it.quantity} x Rp {Number(it.product_price || 0).toLocaleString('id-ID')}</span>
                  <span>Rp {(Number(it.product_price || 0) * Number(it.quantity || 0)).toLocaleString('id-ID')}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="totals line">
            <span>Total</span>
            <span>Rp {order.total_amount?.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </Box>

      <Container maxW="container.lg" py={8} px={{ base: 4, md: 6 }}>
        <VStack spacing={6} align="stretch">
          <Card>
            <CardHeader>
              <HStack justify="space-between" wrap="wrap">
                <Heading size="md">Detail Pesanan #{order.id}</Heading>
                {isOutletView && (
                  <Button
                    onClick={handlePrintReceipt}
                    variant="outline"
                    size="sm"
                  >
                    Print 56mm
                  </Button>
                )}
                <HStack spacing={2}>
                  {getStatusBadge(order.payment_status)}
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
                    <Text><strong>Telepon:</strong> {order.customer_phone}</Text>
                    <Text><strong>Alamat:</strong> {order.customer_address}</Text>
                    <Text><strong>Area Pengiriman:</strong> {order.shipping_area === 'dalam_kota' ? 'Dalam Kota' : 'Luar Kota'}</Text>
                    <Text><strong>Metode Pengambilan:</strong> {
                      order.pickup_method === 'pickup_sendiri' ? 'Pickup Sendiri di Outlet' : 
                      order.pickup_method === 'alamat_customer' ? 'Antar ke Alamat' :
                      order.pickup_method === 'deliveryman' ? 'Kurir Outlet' :
                      order.pickup_method
                    }</Text>
                    {order.courier_service && order.shipping_area === 'luar_kota' && (
                      <Text><strong>Jasa Kurir:</strong> {order.courier_service}</Text>
                    )}
                    {order.tracking_number && (
                      <Text><strong>Nomor Resi:</strong> {order.tracking_number}</Text>
                    )}
                  </Box>

                  <Divider />

                  <Box>
                    <Heading size="sm" mb={4}>Progress Pesanan</Heading>
                    <Stepper index={currentStep} orientation="vertical" height="200px" gap="0">
                      {steps.map((step, index) => (
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
                    <Heading size="sm" mb={2}>Status Foto Pesanan</Heading>
                    <VStack align="stretch" spacing={3}>
                      {photoSlotsToShow.map((type) => {
                        const labels = {
                          ready_for_pickup: 'Foto Siap Kirim',
                          picked_up: 'Foto Pengiriman', 
                          delivered: 'Foto Diterima'
                        };
                        
                        return (
                          <ShippingImageDisplay
                            key={type}
                            imageUrl={shippingImages[type as keyof ShippingImages] ?? undefined}
                            type={type}
                            label={labels[type as keyof typeof labels]}
                            showPlaceholder={true}
                            maxHeight="150px"
                          />
                        );
                      })}
                    </VStack>
                  </Box>

                  {/* Upload foto untuk kurir */}
                  {(isDeliveryView || isOutletView) && (
                    <Box>
                      <Heading size="sm" mb={4}>Upload Foto Status</Heading>
                      <VStack spacing={3}>
                        <FormControl>
                          <FormLabel fontSize="sm">Pilih Jenis Foto</FormLabel>
                          <RadioGroup 
                            value={selectedPhotoType} 
                            onChange={(value) => setSelectedPhotoType(value as 'ready_for_pickup' | 'picked_up' | 'delivered')}
                          >
                            <Stack>
                              {!isLuarKota && (
                                <>
                                  <Radio value="ready_for_pickup" size="sm">Foto Siap Kirim</Radio>
                                  <Radio value="picked_up" size="sm">Foto Pengiriman</Radio>
                                </>
                              )}
                              <Radio value="delivered" size="sm">Foto Diterima</Radio>
                            </Stack>
                          </RadioGroup>
                        </FormControl>

                        <FormControl>
                          <FormLabel fontSize="sm">Pilih Foto</FormLabel>
                          <Input 
                            type="file" 
                            accept="image/*" 
                            onChange={handlePhotoChange}
                            size="sm"
                          />
                        </FormControl>

                        {photoPreview && (
                          <Image 
                            src={photoPreview || ''}
                            alt="Preview"
                            maxH="200px"
                            objectFit="cover"
                            border="1px solid"
                            borderColor="gray.200"
                            borderRadius="md"
                          />
                        )}

                        <Button 
                          onClick={handlePhotoUpload}
                          isLoading={uploadLoading}
                          isDisabled={!photoFile}
                          colorScheme="blue"
                          size="sm"
                          width="full"
                        >
                          Upload Foto
                        </Button>
                      </VStack>
                    </Box>
                  )}

                  {/* QR Code untuk akses publik */}
                  {!isDeliveryView && !isOutletView && (
                    <Box>
                      <Button
                        onClick={() => setShowQRCode(!showQRCode)}
                        variant="outline"
                        size="sm"
                        width="full"
                        mb={3}
                      >
                        {showQRCode ? 'Sembunyikan' : 'Tampilkan'} QR Code
                      </Button>
                      
                      {showQRCode && (
                        <VStack spacing={3}>
                          <Flex justify="center" p={4} bg="gray.50" borderRadius="md">
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
                        </VStack>
                      )}
                    </Box>
                  )}
                </VStack>
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
                {order.items && order.items.map((item: OrderItem, index: number) => (
                  <Tr key={index}>
                    <Td>{item.product_name}</Td>
                    <Td isNumeric>{item.quantity}</Td>
                    <Td isNumeric>Rp {item.product_price?.toLocaleString('id-ID')}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>

            <Divider my={6} />
            
            <HStack spacing={4} justify="center" wrap="wrap">
              {isOutletView && (
                <Button onClick={handlePrintReceipt} colorScheme="gray" size="lg">
                  Print 56mm
                </Button>
              )}
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
    </>
  );
};

export default OrderDetailPage;
