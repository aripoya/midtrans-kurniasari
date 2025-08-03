import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink, useSearchParams,Pathname as usePathname, useLocation } from 'react-router-dom';
import {
  Box, Heading, Text, VStack, HStack, Badge, Button,
  Table, Tbody, Tr, Td, Divider, Spinner,
  Alert, AlertIcon, Card, CardBody, CardHeader, CardFooter,
  useToast, Select, FormControl, 
  FormLabel, Textarea, SimpleGrid, Stack, Radio, RadioGroup,
  useDisclosure, Modal, ModalOverlay, ModalContent,
  ModalHeader, ModalBody, ModalFooter, ModalCloseButton, Input,
  Grid,
  Flex
} from '@chakra-ui/react';
import { orderService } from '../../api/orderService';
import { refreshOrderStatus } from '../../api/api';
import { adminApi } from '../../api/adminApi';
import { formatDate } from '../../utils/date';
import axios from 'axios';
import { getShippingStatusConfig, getShippingStatusOptions } from '../../utils/orderStatusUtils';
import ShippingImageDisplay from '../../components/ShippingImageDisplay';
import { IoQrCodeOutline } from "react-icons/io5";
import QRCodeGenerator from '../../components/QRCodeGenerator';
import CustomModal from '../../components/CustomModal';
// TypeScript interfaces
interface Order {
  id: string;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  total_amount: number;
  payment_status: string;
  shipping_status: string;
  shipping_area: string;
  pickup_method: string;
  courier_service?: string;
  tracking_number?: string;
  lokasi_pengiriman: string;
  lokasi_pengambilan?: string;
  tipe_pesanan: string;
  admin_note?: string;
  payment_url?: string;
  payment_response?: string;
  payment_method?: string;
  payment_time?: string;
  created_at: string;
  updated_at?: string;
  items: OrderItem[];
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
  size?: string;
  notes?: string;
}

interface UploadedImages {
  readyForPickup: string | null;
  pickedUp: string | null;
  received: string | null;
  shipmentProof: string | null;
}

interface Location {
  id: string;
  name: string;
  code?: string;
}

interface FileInputRefs {
  shipmentProof: React.RefObject<HTMLInputElement | null>;
}

interface ShippingStatusOption {
  value: string;
  label: string;
}

interface ShippingImage {
  id: string;
  order_id: string;
  type: string;
  image_url: string;
  uploaded_at: string;
}

const AdminOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isModalOpen, setModalOpen] = useState(false);

  const handleOpen = () => setModalOpen(true);
  const handleClose = () => setModalOpen(false);
  
  // Validation
  const isValidOrderId = id && typeof id === 'string' && !id.includes('[') && !id.includes(']');
  console.log(`🔍 Order ID dari URL params: "${id}"`);
  console.log(`🔍 Order ID valid: ${isValidOrderId}`);
  
  // State management
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [shippingStatus, setShippingStatus] = useState<string>('');
  const [adminNote, setAdminNote] = useState<string>('');
  const [savedAdminNote, setSavedAdminNote] = useState<string>('');
  const [isEditingNote, setIsEditingNote] = useState<boolean>(false);
  const [isSavingNote, setIsSavingNote] = useState<boolean>(false);
  const [isDeletingNote, setIsDeletingNote] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImages>({
    readyForPickup: null,
    pickedUp: null,
    received: null,
    shipmentProof: null
  });
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [formChanged, setFormChanged] = useState<boolean>(false);
  const [shippingArea, setShippingArea] = useState<string>('dalam-kota');
  const [pickupMethod, setPickupMethod] = useState<string>('deliveryman');
  const [courierService, setCourierService] = useState<string>('');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [trackingNumberError] = useState<string>('');
  const [locations, setLocations] = useState<any>([]);
  const [lokasi_pengiriman, setLokasiPengiriman] = useState<string>('');
   const location = useLocation();
  const [fullUrl, setFullUrl] = useState('');

  const fileInputRefs: FileInputRefs = {
    shipmentProof: useRef<HTMLInputElement>(null)
  };

  // Helper function to render shipping status badge
  const getShippingStatusBadge = (status: string): React.ReactElement => {
    const config = getShippingStatusConfig(status);
    return <Badge colorScheme={config.color}>{config.text}</Badge>;
  };

  // Transform URL for better display
  const transformURL = (url: string): string => {
    if (!url) return '';

    // Direct Cloudflare Images URL - already optimized
    if (url.includes('imagedelivery.net')) {
      return url;
    }

    // R2/CloudFlare bucket URL with auto transforms for width/quality
    if (url.includes('r2.cloudflarestorage.com') || url.includes('kurniasari-shipping-images')) {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
        const transformedUrl = `${baseUrl}/cdn-cgi/image/width=800,quality=85,format=auto${pathname}`;
        return transformedUrl;
      } catch (e) {
        console.warn('Failed to transform R2 URL:', e);
        return url;
      }
    }

    // For other URLs, return as-is
    return url;
  };

  // Helper function to map backend keys to frontend keys
  const mapBackendToFrontendFormat = (backendType: string): keyof UploadedImages | null => {
    const typeMapping: Record<string, keyof UploadedImages> = {
      'ready_for_pickup': 'readyForPickup',
      'picked_up': 'pickedUp', 
      'delivered': 'received',
      'shipment_proof': 'shipmentProof'
    };
    return typeMapping[backendType] || null;
  };

  // Helper function to map frontend type keys to backend type keys
  const mapTypeToBackendFormat = (type: string): string => {
    const typeMapping: Record<string, string> = {
      'readyForPickup': 'ready_for_pickup',
      'pickedUp': 'picked_up',
      'received': 'delivered',
      'shipmentProof': 'shipment_proof'
    };
    return typeMapping[type] || type;
  };

  // Handle order deletion/cancellation
  const handleDeleteOrder = async (): Promise<void> => {
    setIsDeleting(true);
    try {
      const result = await adminApi.deleteOrder(id!);
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Pesanan berhasil dibatalkan',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        navigate('/admin/orders');
      } else {
        throw new Error(result.error || 'Gagal membatalkan pesanan');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsDeleting(false);
      onClose();
    }
  };

  // Handle status refresh from Midtrans
  const handleRefreshStatus = async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      const result = await refreshOrderStatus(id!);
      if (result.success) {
        await loadAllData();
        toast({
          title: 'Success',
          description: 'Status pembayaran berhasil diperbarui',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        throw new Error(result.error || 'Gagal memperbarui status');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle status update
  const handleUpdateStatus = async (): Promise<void> => {
    setIsUpdating(true);
    try {
      const updateData = {
        status: shippingStatus,  // Fixed: backend expects 'status' not 'shipping_status'
        shipping_area: shippingArea,
        // For Luar Kota orders, set all irrelevant fields to null since they're not relevant for out-of-city deliveries
        pickup_method: shippingArea === 'luar-kota' ? null : pickupMethod,
        courier_service: courierService,
        tracking_number: trackingNumber,
        lokasi_pengiriman: shippingArea === 'luar-kota' ? null : lokasi_pengiriman,
        lokasi_pengambilan: shippingArea === 'luar-kota' ? null : order?.lokasi_pengambilan || null,
        tipe_pesanan: shippingArea === 'luar-kota' ? null : order?.tipe_pesanan || null,
        admin_note: adminNote
      };
      
      const result = await adminApi.updateOrderDetails(id!, updateData);
      if (result.success) {
        await loadAllData();
        setFormChanged(false);
        toast({
          title: 'Success',
          description: 'Status pesanan berhasil diperbarui',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        throw new Error(result.error || 'Gagal memperbarui status');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Load all order data
  const loadAllData = useCallback(async (): Promise<void> => {
    if (!isValidOrderId) {
      setError('ID Pesanan tidak valid');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Reset images
      setUploadedImages({
        readyForPickup: null,
        pickedUp: null,
        received: null,
        shipmentProof: null
      });
      
      // Get locations
      try {
        const locationsRes = await adminApi.getLocations();
        console.log('🔍 Locations API response:', locationsRes);
        if (locationsRes.success && locationsRes.data) {
          // Handle the response structure correctly
          const locationsList = Array.isArray(locationsRes.data) ? locationsRes.data : [];
          console.log('🔍 Processed locations:', locationsList);
          setLocations(locationsList);
        } else {
          console.warn('🔍 Locations API failed or returned no data:', locationsRes);
          setLocations([]); // Set empty array as fallback
        }
      } catch (locError) {
        console.error('Error loading locations:', locError);
        setLocations([]); // Set empty array as fallback
      }
      
      // Get order data - handle public orders differently
      let orderData: any;
      const isPublicOrderPage = id && id.startsWith('ORDER-');
      
      if (isPublicOrderPage) {
        // For public orders, use direct API call
        const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://order-management-app-production.wahwooh.workers.dev';
        const response = await axios.get(`${apiUrl}/api/orders/${id}?_nocache=${Date.now()}`);
        
        if (response.data.success) {
          orderData = response.data.order || response.data.data;
        } else {
          throw new Error('Respons API tidak sukses');
        }
      } else {
        // For admin-specific orders, use orderService
        const serviceResponse = await orderService.getOrderById(id!);
        orderData = serviceResponse.order || serviceResponse.data;
      }
      
      if (!orderData) {
        throw new Error('Data pesanan tidak ditemukan');
      }
      
      // Process payment response if exists
      if (orderData.payment_response) {
        try {
          const paymentDetails = JSON.parse(orderData.payment_response);
          orderData = {
            ...orderData,
            payment_method: paymentDetails.payment_type || orderData.payment_method,
            payment_time: paymentDetails.settlement_time || orderData.payment_time,
            payment_status: paymentDetails.transaction_status || orderData.payment_status,
          };
        } catch (e) {
          console.error('Error parsing payment_response:', e);
        }
      }
      
      // Set order data and form state
      setOrder(orderData);
      setLokasiPengiriman(orderData.lokasi_pengiriman || '');
      setShippingStatus(orderData.shipping_status || '');
      setAdminNote(orderData.admin_note || '');
      setSavedAdminNote(orderData.admin_note || '');
      setShippingArea(orderData.shipping_area || 'dalam-kota');
      setPickupMethod(orderData.pickup_method || 'deliveryman');
      setCourierService(orderData.courier_service || '');
      setTrackingNumber(orderData.tracking_number || '');

      // Get shipping images
      try {
        const imagesRes = await adminApi.getShippingImages(id!);
        if (imagesRes.success && imagesRes.data) {
          const imagesData: UploadedImages = {
            readyForPickup: null,
            pickedUp: null,
            received: null,
            shipmentProof: null
          };
          
          const imagesList = Array.isArray(imagesRes.data) ? imagesRes.data : [];
          imagesList.forEach((imageItem: ShippingImage) => {
            if (imageItem.image_url && imageItem.type) {
              const frontendKey = mapBackendToFrontendFormat(imageItem.type);
              if (frontendKey && frontendKey in imagesData) {
                (imagesData as any)[frontendKey] = transformURL(imageItem.image_url);
              }
            }
          });
          
          setUploadedImages(imagesData);
        }
      } catch (imageError) {
        console.error('Error fetching shipping images:', imageError);
      }
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat memuat data pesanan';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [id, isValidOrderId, toast]);

  // Handle admin note operations
  const handleSaveNote = async (): Promise<void> => {
    setIsSavingNote(true);
    try {
      const result = await adminApi.updateOrderDetails(id!, { admin_note: adminNote });
      if (result.success) {
        setSavedAdminNote(adminNote);
        setIsEditingNote(false);
        toast({
          title: 'Success',
          description: 'Catatan berhasil disimpan',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        throw new Error(result.error || 'Gagal menyimpan catatan');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleEditNote = (): void => {
    setIsEditingNote(true);
    setAdminNote(savedAdminNote);
  };

  const handleDeleteNote = async (): Promise<void> => {
    setIsDeletingNote(true);
    try {
      const result = await adminApi.updateOrderDetails(id!, { admin_note: '' });
      if (result.success) {
        setSavedAdminNote('');
        setAdminNote('');
        toast({
          title: 'Success',
          description: 'Catatan berhasil dihapus',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        throw new Error(result.error || 'Gagal menghapus catatan');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsDeletingNote(false);
    }
  };

  // Handle image upload function for admin (only shipmentProof)
  const handleImageUpload = async (file: File, type: string): Promise<void> => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('order_id', id!);
      formData.append('type', mapTypeToBackendFormat(type));
      
      const result = await adminApi.uploadShippingImage(formData);
      if (result.success) {
        // Refresh images after successful upload
        await loadAllData();
        toast({
          title: 'Success',
          description: 'Foto berhasil diupload',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        throw new Error(result.error || 'Gagal upload foto');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat upload';
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Upload handler for file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>, type: string): void => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type and size
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Error',
          description: 'Mohon pilih file gambar',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: 'Error',
          description: 'Ukuran file maksimal 10MB',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      
      handleImageUpload(file, type);
    }
  };

  // Helper to render uploaded image
  const renderUploadedImage = (type: keyof UploadedImages): React.ReactElement => {
    const imageUrl = uploadedImages[type];
    if (imageUrl) {
      return (
        <ShippingImageDisplay
          imageUrl={imageUrl}
          alt={`Foto ${type}`}
          maxW="200px"
          maxH="200px"
        />
      );
    }
    return <Text color="gray.500">Belum ada foto</Text>;
  };

  // Helper to render upload button - only available for shipmentProof (bukti pengiriman) type
  const renderUploadButton = (type: keyof UploadedImages): React.ReactElement | null => {
    // Admin can only upload shipmentProof (bukti pengiriman)
    if (type !== 'shipmentProof') {
      return null;
    }

    const handleUploadClick = (): void => {
      fileInputRefs.shipmentProof.current?.click();
    };

    return (
      <VStack spacing={2} align="stretch">
        <Button 
          onClick={handleUploadClick}
          isLoading={isUploading}
          colorScheme="blue"
          size="sm"
        >
          {uploadedImages[type] ? 'Ganti Foto' : 'Upload Foto'}
        </Button>
        <input
          type="file"
          ref={fileInputRefs.shipmentProof}
          style={{ display: 'none' }}
          accept="image/*"
          onChange={(e) => handleFileInputChange(e, type)}
        />
      </VStack>
    );
  };

useEffect(() => {
    if (typeof window !== 'undefined') {
      const cleanedPath = location.pathname.replace(/^\/admin/, '');
      const currentUrl = `${window.location.origin}${cleanedPath}${location.search}${location.hash}`;
      setFullUrl(currentUrl);
    }
  }, [location]);
  // useEffect hooks for data loading and form tracking
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Track form changes
  useEffect(() => {
    if (order) {
      const hasChanges = 
        shippingStatus !== (order.shipping_status || '') ||
        shippingArea !== (order.shipping_area || 'dalam-kota') ||
        adminNote !== (order.admin_note || '') ||
        lokasi_pengiriman !== (order.lokasi_pengiriman || '') ||
        pickupMethod !== (order.pickup_method || 'deliveryman') ||
        courierService !== (order.courier_service || '') ||
        trackingNumber !== (order.tracking_number || '');
      setFormChanged(hasChanges);
    }
  }, [order, shippingStatus, shippingArea, adminNote, lokasi_pengiriman, pickupMethod, courierService, trackingNumber]);

  // Loading state
  if (loading) {
    return (
      <Box p={6} textAlign="center">
        <Spinner size="xl" />
        <Text mt={4}>Memuat data pesanan...</Text>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box p={6}>
        <Alert status="error">
          <AlertIcon />
          <Text>{error}</Text>
        </Alert>
      </Box>
    );
  }

  // No order data
  if (!order) {
    return (
      <Box p={6}>
        <Alert status="warning">
          <AlertIcon />
          <Text>Data pesanan tidak ditemukan</Text>
        </Alert>
      </Box>
    );
  }

  // Helper variables for payment status
  const isPaid = order.payment_status === 'settlement' || order.payment_status === 'success';
  const isLuarKota = order.shipping_area === 'luar-kota';
  
  return (
    <Box p={6} maxW="7xl" mx="auto">
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <HStack justify="space-between" align="center">
          <Heading size="lg">Detail Pesanan</Heading>
          <Button as={RouterLink} to="/admin/orders" variant="outline" size="sm">
            Kembali ke Daftar Pesanan
          </Button>
        </HStack>

        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
          {/* Order Information */}
          <Card>
            <CardHeader>
              <Heading size="md">Informasi Pesanan</Heading>
            </CardHeader>
            <CardBody>
              <Table variant="simple" size="sm">
                <Tbody>
                  <Tr>
                    <Td fontWeight="semibold">ID Pesanan</Td>
                    <Td>{order.order_id}</Td>
                  </Tr>
                  <Tr>
                    <Td fontWeight="semibold">Nama Pelanggan</Td>
                    <Td>{order.customer_name}</Td>
                  </Tr>
                  <Tr>
                    <Td fontWeight="semibold">No. Telepon</Td>
                    <Td>{order.customer_phone}</Td>
                  </Tr>
                  {order.customer_email && (
                    <Tr>
                      <Td fontWeight="semibold">Email</Td>
                      <Td>{order.customer_email}</Td>
                    </Tr>
                  )}
                  <Tr>
                    <Td fontWeight="semibold">Total Pembayaran</Td>
                    <Td fontWeight="bold">
                      Rp {order.total_amount?.toLocaleString('id-ID')}
                    </Td>
                  </Tr>
                  <Tr>
                    <Td fontWeight="semibold">Status Pembayaran</Td>
                    <Td>
                      <Badge 
                        colorScheme={isPaid ? 'green' : order.payment_status === 'pending' ? 'yellow' : 'red'}
                      >
                        {order.payment_status === 'settlement' || order.payment_status === 'success' ? 'Lunas' : 
                         order.payment_status === 'pending' ? 'Menunggu' : 
                         order.payment_status === 'expire' ? 'Kedaluwarsa' : 
                         order.payment_status === 'cancel' ? 'Dibatalkan' : 
                         order.payment_status}
                      </Badge>
                    </Td>
                  </Tr>
                  <Tr>
                    <Td fontWeight="semibold">Status Pengiriman</Td>
                    <Td>{getShippingStatusBadge(order.shipping_status)}</Td>
                  </Tr>
                  <Tr>
                    <Td fontWeight="semibold">Tanggal Dibuat</Td>
                    <Td>{formatDate(order.created_at)}</Td>
                  </Tr>
                  {order.payment_method && (
                    <Tr>
                      <Td fontWeight="semibold">Metode Pembayaran</Td>
                      <Td>{order.payment_method}</Td>
                    </Tr>
                  )}
                  {/* Additional Order Details */}
                  <Tr>
                    <Td fontWeight="semibold">Area Pengiriman</Td>
                    <Td>
                      <Badge colorScheme={order.shipping_area === 'luar-kota' ? 'orange' : 'blue'}>
                        {order.shipping_area === 'luar-kota' ? 'Luar Kota' : 'Dalam Kota'}
                      </Badge>
                    </Td>
                  </Tr>
                  {/* Only show Lokasi Pengiriman for Dalam Kota orders */}
                  {order.lokasi_pengiriman && order.shipping_area === 'dalam-kota' && (
                    <Tr>
                      <Td fontWeight="semibold">Lokasi Pengiriman</Td>
                      <Td>{order.lokasi_pengiriman}</Td>
                    </Tr>
                  )}
                  {/* Only show Lokasi Pengambilan for Dalam Kota orders */}
                  {order.lokasi_pengambilan && order.shipping_area === 'dalam-kota' && (
                    <Tr>
                      <Td fontWeight="semibold">Lokasi Pengambilan</Td>
                      <Td>{order.lokasi_pengambilan}</Td>
                    </Tr>
                  )}
                  {/* Only show Metode Pengiriman for Dalam Kota orders */}
                  {order.pickup_method && order.shipping_area === 'dalam-kota' && (
                    <Tr>
                      <Td fontWeight="semibold">Metode Pengiriman</Td>
                      <Td>
                        {order.pickup_method === 'deliveryman' ? 'Kurir Toko' : 
                         order.pickup_method === 'ojek-online' ? 'Ojek Online' : 
                         order.pickup_method}
                      </Td>
                    </Tr>
                  )}
                  {order.courier_service && (
                    <Tr>
                      <Td fontWeight="semibold">Layanan Kurir</Td>
                      <Td>
                        {order.courier_service === 'gojek' ? 'Gojek' :
                         order.courier_service === 'grab' ? 'Grab' :
                         order.courier_service === 'shopee-food' ? 'Shopee Food' :
                         order.courier_service}
                      </Td>
                    </Tr>
                  )}
                  {order.tracking_number && (
                    <Tr>
                      <Td fontWeight="semibold">Nomor Resi</Td>
                      <Td>{order.tracking_number}</Td>
                    </Tr>
                  )}
                  {/* Only show Tipe Pesanan for Dalam Kota orders */}
                  {order.tipe_pesanan && order.shipping_area === 'dalam-kota' && (
                    <Tr>
                      <Td fontWeight="semibold">Tipe Pesanan</Td>
                      <Td>{order.tipe_pesanan}</Td>
                    </Tr>
                  )}
                  {order.admin_note && (
                    <Tr>
                      <Td fontWeight="semibold">Catatan Admin</Td>
                      <Td>
                        <Text fontSize="sm" p={2} bg="yellow.50" borderRadius="md">
                          {order.admin_note}
                        </Text>
                      </Td>
                    </Tr>
                  )}
                  {order.updated_at && (
                    <Tr>
                      <Td fontWeight="semibold">Terakhir Diupdate</Td>
                      <Td>{formatDate(order.updated_at)}</Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
            </CardBody>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <Heading size="md">Item Pesanan</Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={3} align="stretch">
                {order.items && order.items.length > 0 ? (
                  order.items.map((item: OrderItem, index: number) => (
                    <Box key={item.id || index} p={3} borderWidth={1} borderRadius="md">
                      <HStack justify="space-between">
                        <VStack align="start" spacing={1}>
                          <Text fontWeight="semibold">{item.product_name}</Text>
                          {item.size && <Text fontSize="sm" color="gray.600">Ukuran: {item.size}</Text>}
                          {item.notes && <Text fontSize="sm" color="gray.600">Catatan: {item.notes}</Text>}
                        </VStack>
                        <VStack align="end" spacing={1}>
                          <Text fontWeight="bold">
                            Rp {item.price?.toLocaleString('id-ID')}
                          </Text>
                          <Text fontSize="sm" color="gray.600">Qty: {item.quantity}</Text>
                        </VStack>
                      </HStack>
                    </Box>
                  ))
                ) : (
                  <Text color="gray.500">Tidak ada item</Text>
                )}
              </VStack>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Admin Controls */}
        <Card>
          <CardHeader>
            <Heading size="md">Kontrol Admin</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={4} align="stretch">
              {/* Shipping Status */}
              <FormControl>
                <FormLabel>Status Pengiriman</FormLabel>
                <Select
                  value={shippingStatus}
                  onChange={(e) => setShippingStatus(e.target.value)}
                >
                  <option value="">Pilih Status</option>
                  {getShippingStatusOptions().map((option: ShippingStatusOption) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FormControl>

              {/* Shipping Area */}
              <FormControl>
                <FormLabel>Area Pengiriman</FormLabel>
                <RadioGroup value={shippingArea} onChange={setShippingArea}>
                  <Stack direction="row">
                    <Radio value="dalam-kota">Dalam Kota</Radio>
                    <Radio value="luar-kota">Luar Kota</Radio>
                  </Stack>
                </RadioGroup>
              </FormControl>

              {/* Lokasi Pengiriman - only show for Dalam Kota */}
              {shippingArea === 'dalam-kota' && (
                <FormControl>
                  <FormLabel>Lokasi Pengiriman</FormLabel>
                  <Select
                    value={lokasi_pengiriman}
                    onChange={(e) => setLokasiPengiriman(e.target.value)}
                  >
                    <option value="">Pilih Lokasi</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.nama_lokasi}>
                        {location.nama_lokasi}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              )}

              {/* Pickup Method - only show for Dalam Kota */}
              {shippingArea === 'dalam-kota' && (
                <FormControl>
                  <FormLabel>Metode Pengiriman</FormLabel>
                  <RadioGroup value={pickupMethod} onChange={setPickupMethod}>
                    <Stack direction="row">
                      <Radio value="deliveryman">Kurir Toko</Radio>
                      <Radio value="ojek-online">Ojek Online</Radio>
                    </Stack>
                  </RadioGroup>
                </FormControl>
              )}

              {/* Courier Service - for ojek-online and luar-kota */}
              {(pickupMethod === 'ojek-online' || shippingArea === 'luar-kota') && (
                <FormControl>
                  <FormLabel>Layanan Kurir</FormLabel>
                  <Select
                    value={courierService}
                    onChange={(e) => setCourierService(e.target.value)}
                  >
                    <option value="">Pilih Layanan</option>
                    {/* Options for ojek-online (Dalam Kota) */}
                    {pickupMethod === 'ojek-online' && (
                      <>
                        <option value="gojek">Gojek</option>
                        <option value="grab">Grab</option>
                        <option value="shopee-food">Shopee Food</option>
                      </>
                    )}
                    {/* Options for Luar Kota */}
                    {shippingArea === 'luar-kota' && (
                      <>
                        <option value="tiki">TIKI</option>
                        <option value="jne">JNE</option>
                        <option value="travel">Travel</option>
                      </>
                    )}
                    <option value="custom">Lainnya</option>
                  </Select>
                </FormControl>
              )}

              {/* Tracking Number */}
              <FormControl>
                <FormLabel>Nomor Resi (Opsional)</FormLabel>
                <Input
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Masukkan nomor resi"
                />
                {trackingNumberError && (
                  <Text color="red.500" fontSize="sm" mt={1}>
                    {trackingNumberError}
                  </Text>
                )}
              </FormControl>

              {/* Admin Note */}
              <FormControl>
                <FormLabel>Catatan Admin</FormLabel>
                {isEditingNote ? (
                  <>
                    <Textarea
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder="Masukkan catatan admin..."
                      resize="vertical"
                    />
                    <HStack mt={2} spacing={2}>
                      <Button
                        colorScheme="blue"
                        onClick={handleSaveNote}
                        isLoading={isSavingNote}
                        size="sm"
                      >
                        Simpan
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditingNote(false);
                          setAdminNote(savedAdminNote);
                        }}
                        size="sm"
                      >
                        Batal
                      </Button>
                    </HStack>
                  </>
                ) : (
                  <>
                    <Box p={3} borderWidth="1px" borderRadius="md" minHeight="100px" bg="gray.50">
                      {savedAdminNote ? (
                        <Text>{savedAdminNote}</Text>
                      ) : (
                        <Text color="gray.500" fontStyle="italic">Belum ada catatan</Text>
                      )}
                    </Box>
                    <HStack mt={2} spacing={2}>
                      <Button 
                        colorScheme="blue" 
                        onClick={handleEditNote}
                        size="sm"
                      >
                        Edit Catatan
                      </Button>
                      {savedAdminNote && (
                        <Button 
                          colorScheme="red" 
                          onClick={handleDeleteNote}
                          isLoading={isDeletingNote}
                          size="sm"
                        >
                          Hapus Catatan
                        </Button>
                      )}
                    </HStack>
                  </>
                )}
              </FormControl>

              {/* Update Button */}
              <Button 
                colorScheme="blue" 
                onClick={handleUpdateStatus}
                isLoading={isUpdating}
                isDisabled={!formChanged}
                mt={4}
              >
                Perbarui Status Pesanan
              </Button>

              <Divider />

              {/* Other Actions */}
              <VStack spacing={3} align="stretch">
                <Button 
                  onClick={handleRefreshStatus}
                  isLoading={isRefreshing}
                  variant="outline"
                >
                  Perbarui Status Pembayaran dari Midtrans
                </Button>

                {isPaid && order.payment_url && (
                  <Button 
                    as="a"
                    href={order.payment_url} 
                    target="_blank"
                    variant="outline"
                  >
                    Lihat Detail Pembayaran di Midtrans
                  </Button>
                )}

                <Button 
                  as={RouterLink}
                  to="/admin/orders/new"
                  colorScheme="teal"
                >
                  Buat Pesanan Baru
                </Button>
              </VStack>
            </VStack>
          </CardBody>
          <CardFooter>
            <Button 
              onClick={onOpen} 
              colorScheme="red" 
              variant="ghost" 
              size="sm" 
              width="full"
            >
              Batalkan Pesanan
            </Button>
          </CardFooter>
        </Card>

        {/* Status Foto Pesanan */}
        <Card>
          <CardHeader>
            <Heading size="md">Status Foto Pesanan</Heading>
          </CardHeader>
          <CardBody>
            <SimpleGrid columns={{ base: 1, md: isLuarKota ? 1 : 3 }} spacing={4}>
              {/* Conditional rendering based on shipping area */}
              {isLuarKota ? (
                // Luar Kota - only show received photo
                <Box>
                  <Text fontWeight="semibold" mb={2}>Foto Diterima</Text>
                  {renderUploadedImage('received')}
                  {renderUploadButton('received')}
                </Box>
              ) : (
                // Dalam Kota - show all 3 photos
                <>
                  <Box>
                    <Text fontWeight="semibold" mb={2}>Foto Siap Kirim</Text>
                    {renderUploadedImage('readyForPickup')}
                    {renderUploadButton('readyForPickup')}
                  </Box>
                  <Box>
                    <Text fontWeight="semibold" mb={2}>Foto Pengiriman</Text>
                    {renderUploadedImage('pickedUp')}
                    {renderUploadButton('pickedUp')}
                  </Box>
                  <Box>
                    <Text fontWeight="semibold" mb={2}>Foto Diterima</Text>
                    {renderUploadedImage('received')}
                    {renderUploadButton('received')}
                  </Box>
                </>
              )}
            </SimpleGrid>
            <Flex justify="center" mt={4}>
               <Box w="20%">
                  <Button 
                    colorScheme="blue"
                    size="sm"
                    width="full"
                    onClick={handleOpen}
                  >
                    <IoQrCodeOutline />
                    &nbsp; Generate QR Code
                  </Button>
               </Box>
           </Flex>   
          </CardBody>
        </Card>
      </VStack>

      {/* Cancel Order Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Batalkan Pesanan</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>Apakah Anda yakin ingin membatalkan pesanan ini? Tindakan ini tidak dapat dibatalkan.</Text>
          </ModalBody>
          <ModalFooter>
            <Button 
              colorScheme="red" 
              mr={3} 
              onClick={handleDeleteOrder}
              isLoading={isDeleting}
              loadingText="Menghapus..."
            >
              Ya, Batalkan
            </Button>
            <Button variant="ghost" onClick={onClose} isDisabled={isDeleting}>
              Batal
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>


    {/* Modal QR */}
     <CustomModal
        isOpen={isModalOpen}
        onClose={handleClose}
        title="Share QR Code"
        confirmText="Share"
      >
        <Flex justify="center" align="center">
          <Box>
            <QRCodeGenerator value={fullUrl} size={200} />
          </Box>
        </Flex>
       
      </CustomModal>

    </Box>
  );
};

export default AdminOrderDetailPage;
