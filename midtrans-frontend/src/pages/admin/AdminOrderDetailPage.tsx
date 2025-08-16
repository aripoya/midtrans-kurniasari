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
import { getShippingStatusConfig, getShippingStatusOptions, getShippingStatusOptionsByArea } from '../../utils/orderStatusUtils';
import ShippingImageDisplay from '../../components/ShippingImageDisplay';
import { IoQrCodeOutline } from "react-icons/io5";
import QRCodeGenerator from '../../components/QRCodeGenerator';
import CustomModal from '../../components/CustomModal';
// Outlet locations for pickup
const OUTLET_LOCATIONS = [
  { value: 'Outlet Glagahsari 108', label: 'Outlet Glagahsari 108' },
  { value: 'Outlet Glagahsari 91C', label: 'Outlet Glagahsari 91C' },
  { value: 'Outlet Bonbin', label: 'Outlet Bonbin' },
  { value: 'Outlet Monjali', label: 'Outlet Monjali' },
  { value: 'Outlet Pogung', label: 'Outlet Pogung' },
  { value: 'Outlet Jakal KM14', label: 'Outlet Jakal KM14' },
  { value: 'Outlet Jalan Wonosari', label: 'Outlet Jalan Wonosari' },
  { value: 'Outlet Jalan Wates', label: 'Outlet Jalan Wates' },
  { value: 'Outlet Godean', label: 'Outlet Godean' },
  { value: 'Outlet Ahmad Dahlan', label: 'Outlet Ahmad Dahlan' }
];

// Helper function to format date with Indonesian day names
const formatDateWithDay = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  
  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  return `${dayName}, ${day} ${month} ${year}`;
};

// TypeScript interfaces
interface Order {
  id: string;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  customer_address?: string; // Added for delivery destination mapping
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
  packagedProduct: string | null; // Foto produk sudah dikemas (untuk luar kota)
}

interface Location {
  id: string;
  name: string;
  code?: string;
}

interface FileInputRefs {
  shipmentProof: React.RefObject<HTMLInputElement | null>;
  packagedProduct: React.RefObject<HTMLInputElement | null>;
  pickedUp: React.RefObject<HTMLInputElement | null>;
  readyForPickup: React.RefObject<HTMLInputElement | null>;
  received: React.RefObject<HTMLInputElement | null>;
}

interface ShippingStatusOption {
  value: string;
  label: string;
}

interface ShippingImage {
  id: string;
  order_id: string;
  image_type: string;
  image_url: string;
  created_at: string;
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
    shipmentProof: null,
    packagedProduct: null,
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
  
  // Pickup details state for "Siap Ambil" status
  const [pickupOutlet, setPickupOutlet] = useState<string>('');
  const [pickedUpBy, setPickedUpBy] = useState<string>('');
  const [pickupDate, setPickupDate] = useState<string>('');
  const [pickupTime, setPickupTime] = useState<string>('');
  
   const location = useLocation();
  const [fullUrl, setFullUrl] = useState('');

  const fileInputRefs: FileInputRefs = {
    shipmentProof: useRef<HTMLInputElement>(null),
    packagedProduct: useRef<HTMLInputElement>(null),
    pickedUp: useRef<HTMLInputElement>(null),
    readyForPickup: useRef<HTMLInputElement>(null),
    received: useRef<HTMLInputElement>(null)
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
      // English types (found in production database)
      'ready_for_pickup': 'readyForPickup',
      'picked_up': 'pickedUp', 
      'delivered': 'received',
      'shipment_proof': 'shipmentProof',
      'packaged_product': 'packagedProduct',
      // Indonesian types (from delivery dashboard)
      'siap_kirim': 'readyForPickup',
      'pengiriman': 'pickedUp',
      'diterima': 'received',
      'produk_dikemas': 'packagedProduct'
    };
    console.log(`🔗 [MAPPING DEBUG] Input type: "${backendType}" → Output: "${typeMapping[backendType] || 'NULL'}"`);
    return typeMapping[backendType] || null;
  };

  // Helper function to map frontend type keys to backend type keys
  const mapTypeToBackendFormat = (type: string): string => {
    const typeMapping: Record<string, string> = {
      'readyForPickup': 'ready_for_pickup',
      'pickedUp': 'picked_up',
      'received': 'delivered',
      'shipmentProof': 'shipment_proof',
      'packagedProduct': 'packaged_product'
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

  // Helper function to map display labels to correct backend values for REDESIGNED STRUCTURE
  const mapDisplayLabelToBackendValue = (displayLabel: string | null | undefined, fieldType: 'pickup_method' | 'location'): string | null => {
    if (!displayLabel) return null;
    
    // For pickup_method field - map to internal codes  
    if (fieldType === 'pickup_method') {
      const pickupMethodMapping: Record<string, string> = {
        'Pickup Sendiri di Outlet': 'pickup_sendiri',
        'Kurir Outlet': 'deliveryman',
        'Ojek Online': 'ojek_online'
      };
      return pickupMethodMapping[displayLabel] || displayLabel;
    }
    
    // For location fields - REDESIGNED: these are actual outlet names or customer addresses
    if (fieldType === 'location') {
      // Send actual location values as-is (outlet names, customer addresses)
      return displayLabel;
    }
    
    return displayLabel; // Fallback
  };

  // Handle status update
  const handleUpdateStatus = async (): Promise<void> => {
    setIsUpdating(true);
    try {
      // FIXED: Proper mapping for delivery orders
      // lokasi_pengambilan = outlet (where item is picked up FROM)
      // lokasi_pengantaran = customer address (where item is delivered TO)
      const updateData = {
        status: shippingStatus,  // Fixed: backend expects 'status' not 'shipping_status'
        shipping_area: shippingArea as "dalam-kota" | "luar-kota" | undefined,
        // For Luar Kota orders, set all irrelevant fields to undefined since they're not relevant for out-of-city deliveries
        pickup_method: shippingArea === 'luar-kota' ? undefined : mapDisplayLabelToBackendValue(pickupMethod, 'pickup_method') || undefined,
        courier_service: courierService,
        tracking_number: trackingNumber,
        // For delivery orders: lokasi_pengiriman = outlet, lokasi_pengambilan = outlet, lokasi_pengantaran = customer address
        // CRITICAL FIX: Always send outlet name, never area labels like "Dalam Kota"
        lokasi_pengiriman: shippingArea === 'luar-kota' ? undefined : 
          // Ensure we send a valid outlet name, not area labels
          (order?.lokasi_pengiriman && !['Dalam Kota', 'Luar Kota', 'dalam-kota', 'luar-kota'].includes(order.lokasi_pengiriman) 
            ? order.lokasi_pengiriman 
            : "Outlet Bonbin"),
        lokasi_pengambilan: shippingArea === 'luar-kota' ? undefined : 
          // Ensure we send a valid outlet name, not area labels  
          (order?.lokasi_pengiriman && !['Dalam Kota', 'Luar Kota', 'dalam-kota', 'luar-kota'].includes(order.lokasi_pengiriman)
            ? order.lokasi_pengiriman 
            : "Outlet Bonbin"), 
        lokasi_pengantaran: order?.customer_address, // Customer address for delivery destination
        tipe_pesanan: shippingArea === 'luar-kota' ? undefined : order?.tipe_pesanan || undefined,
        admin_note: adminNote
      };
      
      console.log('PATCH updateData (after mapping):', updateData); // Debug log
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
        shipmentProof: null,
        packagedProduct: null
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

      // Get shipping images - using public API as fallback since admin API returns empty
      try {
        console.log(`🔍 [DEBUG] Fetching shipping images for order: ${id}`);
        console.log(`🔄 [DEBUG] Using public API as fallback for shipping images`);
        
        // Import publicApi
        const { publicApi } = await import('../../api/publicApi');
        const publicOrderRes = await publicApi.getOrderById(id!);
        console.log(`📸 [DEBUG] Public API order response:`, publicOrderRes);
        
        // Extract shipping images from public order response and normalize format
        const rawShippingImages = publicOrderRes.data?.shipping_images || [];
        const normalizedImages = rawShippingImages.map(img => ({
          ...img,
          created_at: img.uploaded_at, // Normalize field name
          image_type: img.image_type   // Ensure field exists
        }));
        
        const imagesRes = {
          success: true,
          data: normalizedImages,
          error: null
        };
        console.log(`📸 [DEBUG] Extracted shipping images:`, imagesRes);
        
        if (imagesRes.success && imagesRes.data) {
          const imagesData: UploadedImages = {
            readyForPickup: null,
            pickedUp: null,
            received: null,
            shipmentProof: null,
            packagedProduct: null
          };
          
          const imagesList = Array.isArray(imagesRes.data) ? imagesRes.data : [];
          console.log(`📋 [DEBUG] Processing ${imagesList.length} images:`, imagesList);
          
          imagesList.forEach((imageItem: ShippingImage, index: number) => {
            console.log(`🖼️ [DEBUG] Image ${index + 1}:`, {
              image_type: imageItem.image_type,
              image_url: imageItem.image_url,
              hasUrl: !!imageItem.image_url,
              hasType: !!imageItem.image_type
            });
            
            if (imageItem.image_url && imageItem.image_type) {
              const frontendKey = mapBackendToFrontendFormat(imageItem.image_type);
              console.log(`🔗 [DEBUG] Mapping ${imageItem.image_type} → ${frontendKey}`);
              
              if (frontendKey && frontendKey in imagesData) {
                const transformedUrl = transformURL(imageItem.image_url);
                (imagesData as any)[frontendKey] = transformedUrl;
                console.log(`✅ [DEBUG] Mapped successfully: ${frontendKey} = ${transformedUrl}`);
              } else {
                console.log(`❌ [DEBUG] Mapping failed for type: ${imageItem.image_type}`);
              }
            } else {
              console.log(`⚠️ [DEBUG] Missing image_url or type for image ${index + 1}`);
            }
          });
          
          console.log(`🎯 [DEBUG] Final images data:`, imagesData);
          setUploadedImages(imagesData);
        } else {
          console.log(`❌ [DEBUG] Images API failed or no data:`, {
            success: imagesRes.success,
            hasData: !!imagesRes.data,
            error: imagesRes.error
          });
        }
      } catch (imageError) {
        console.error('❌ [ERROR] Error fetching shipping images:', imageError);
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
    console.log('🔍 [handleImageUpload] Starting upload process:');
    console.log('  - file:', file.name, 'size:', file.size);
    console.log('  - type:', type);
    console.log('  - mapped type:', mapTypeToBackendFormat(type));
    console.log('  - order_id:', id);
    
    setIsUploading(true);
    try {
      const backendType = mapTypeToBackendFormat(type);
      
      console.log('📤 [handleImageUpload] Sending request to backend...');
      const result = await adminApi.uploadShippingImage(
        id!, 
        backendType as "ready_for_pickup" | "picked_up" | "delivered" | "shipment_proof" | "packaged_product", 
        file
      );
      console.log('📥 [handleImageUpload] Backend response:', result);
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

  // Helper to render upload button - conditional based on area and status
  const renderUploadButton = (type: keyof UploadedImages): React.ReactElement | null => {
    const isLuarKota = shippingArea === 'luar-kota';
    
    // For luar kota orders: allow upload of packagedProduct and pickedUp
    if (isLuarKota && (type === 'packagedProduct' || type === 'pickedUp')) {
      // Admin can upload these photo types for luar kota
    } else if (!isLuarKota && type === 'shipmentProof') {
      // Legacy: Admin can upload shipmentProof for luar kota with siap kirim status
      const isSiapKirim = shippingStatus === 'siap kirim';
      if (!isSiapKirim) {
        return null;
      }
    } else {
      // Other types not allowed for admin
      return null;
    }

    // Use the correct ref for each photo type
    const refMap: Record<keyof UploadedImages, keyof FileInputRefs> = {
      packagedProduct: 'packagedProduct',
      pickedUp: 'pickedUp',
      readyForPickup: 'readyForPickup',
      received: 'received',
      shipmentProof: 'shipmentProof'
    };
    const refKey = refMap[type];

    const handleUploadClick = (): void => {
      fileInputRefs[refKey].current?.click();
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
          ref={fileInputRefs[refKey]}
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
                    <Td fontWeight="semibold">Status Pesanan</Td>
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
                  {order.shipping_area === 'dalam-kota' && (
                    <Tr>
                      <Td fontWeight="semibold">
                        {order.shipping_status === 'Siap Kirim' ? 'Tujuan Pengiriman' : 'Lokasi Pengiriman'}
                      </Td>
                      <Td>
                        {/* For delivery orders: show customer address, for pickup: show outlet */}
                        {(order.pickup_method === 'deliveryman' || order.pickup_method === 'alamat_customer' || order.pickup_method === 'ojek_online')
                          ? (order.customer_address || 'Alamat customer tidak tersedia')
                          : (order.lokasi_pengiriman || 'Outlet Bonbin')
                        }
                      </Td>
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
                      <Td fontWeight="semibold">Metode Pengambilan</Td>
                      <Td>
                        {order.pickup_method === 'deliveryman' ? 'Kurir Toko' : 
                         order.pickup_method === 'ojek_online' ? 'Ojek Online' : 
                         order.pickup_method === 'pickup_sendiri' ? 'Ambil Sendiri di Outlet' :
                         order.pickup_method}
                      </Td>
                    </Tr>
                  )}
                  {order.courier_service && (
                    <Tr>
                      <Td fontWeight="semibold">
                        {order.pickup_method === 'deliveryman' ? 'Nama Kurir' : 'Layanan Kurir'}
                      </Td>
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
                      <Td>
                        <HStack spacing={3}>
                          <Text>{order.tracking_number}</Text>
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
                          ) : null}
                        </HStack>
                      </Td>
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
                <FormLabel>Status Pesanan</FormLabel>
                <Select
                  value={shippingStatus}
                  onChange={(e) => {
                    setShippingStatus(e.target.value);
                    setFormChanged(true);
                  }}
                >
                  <option value="">Pilih Status</option>
                  {getShippingStatusOptionsByArea(shippingArea).map((option: ShippingStatusOption) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FormControl>

              {/* Pickup Details for "Siap Ambil" Status */}
              {shippingStatus === 'siap di ambil' && (
                <>
                  <Divider />
                  <Text fontWeight="bold" color="blue.600" mb={2}>
                    Detail Pengambilan Pesanan
                  </Text>
                  
                  {/* Outlet Pengambilan */}
                  <FormControl isRequired>
                    <FormLabel>Outlet Pengambilan</FormLabel>
                    <Select
                      value={pickupOutlet}
                      onChange={(e) => {
                        setPickupOutlet(e.target.value);
                        setFormChanged(true);
                      }}
                      placeholder="Pilih outlet pengambilan"
                    >
                      {OUTLET_LOCATIONS.map((outlet) => (
                        <option key={outlet.value} value={outlet.value}>
                          {outlet.label}
                        </option>
                      ))}
                    </Select>
                  </FormControl>

                  {/* Diambil Oleh */}
                  <FormControl isRequired>
                    <FormLabel>Diambil Oleh</FormLabel>
                    <Input
                      value={pickedUpBy}
                      onChange={(e) => {
                        setPickedUpBy(e.target.value);
                        setFormChanged(true);
                      }}
                      placeholder="Nama orang yang mengambil pesanan"
                    />
                  </FormControl>

                  {/* Tanggal Pengambilan */}
                  <FormControl isRequired>
                    <FormLabel>Tanggal Pengambilan</FormLabel>
                    <Input
                      type="date"
                      value={pickupDate}
                      onChange={(e) => {
                        setPickupDate(e.target.value);
                        setFormChanged(true);
                      }}
                    />
                    {pickupDate && (
                      <Text fontSize="sm" color="gray.600" mt={1}>
                        {formatDateWithDay(pickupDate)}
                      </Text>
                    )}
                  </FormControl>

                  {/* Jam Pengambilan */}
                  <FormControl isRequired>
                    <FormLabel>Jam Pengambilan</FormLabel>
                    <Select
                      value={pickupTime}
                      onChange={(e) => {
                        setPickupTime(e.target.value);
                        setFormChanged(true);
                      }}
                      placeholder="Pilih jam pengambilan"
                    >
                      <option value="">Pilih Jam</option>
                      <option value="08:30">08:30 WIB</option>
                      <option value="09:00">09:00 WIB</option>
                      <option value="09:30">09:30 WIB</option>
                      <option value="10:00">10:00 WIB</option>
                      <option value="10:30">10:30 WIB</option>
                      <option value="11:00">11:00 WIB</option>
                      <option value="11:30">11:30 WIB</option>
                      <option value="12:00">12:00 WIB</option>
                      <option value="12:30">12:30 WIB</option>
                      <option value="13:00">13:00 WIB</option>
                      <option value="13:30">13:30 WIB</option>
                      <option value="14:00">14:00 WIB</option>
                      <option value="14:30">14:30 WIB</option>
                      <option value="15:00">15:00 WIB</option>
                      <option value="15:30">15:30 WIB</option>
                      <option value="16:00">16:00 WIB</option>
                      <option value="16:30">16:30 WIB</option>
                      <option value="17:00">17:00 WIB</option>
                      <option value="17:30">17:30 WIB</option>
                      <option value="18:00">18:00 WIB</option>
                      <option value="18:30">18:30 WIB</option>
                      <option value="19:00">19:00 WIB</option>
                      <option value="19:30">19:30 WIB</option>
                      <option value="20:00">20:00 WIB</option>
                      <option value="20:30">20:30 WIB</option>
                    </Select>
                  </FormControl>
                  <Divider />
                </>
              )}

              {/* Shipping Area - Hidden for Pickup Statuses */}
              {shippingStatus !== 'siap di ambil' && shippingStatus !== 'sudah di ambil' && (
                <FormControl>
                  <FormLabel>Area Pengiriman</FormLabel>
                  <RadioGroup value={shippingArea} onChange={setShippingArea}>
                    <Stack direction="row">
                      <Radio value="dalam-kota">Dalam Kota</Radio>
                      <Radio value="luar-kota">Luar Kota</Radio>
                    </Stack>
                  </RadioGroup>
                </FormControl>
              )}

              {/* Lokasi Pengiriman - Hidden for Pickup Statuses */}
              {shippingStatus !== 'siap di ambil' && shippingStatus !== 'sudah di ambil' && shippingArea === 'dalam-kota' && (
                <FormControl>
                  <FormLabel>
                    {shippingStatus === 'Siap Kirim' ? 'Tujuan Pengiriman' : 'Lokasi Pengiriman'}
                  </FormLabel>
                  {pickupMethod === 'deliveryman' ? (
                    // For delivery orders: show customer address as shipping destination
                    <Box 
                      p={3} 
                      border="1px solid" 
                      borderColor="gray.200" 
                      borderRadius="md" 
                      bg="gray.50"
                    >
                      <Text fontSize="sm" color="gray.600" mb={1}>Alamat Pengiriman:</Text>
                      <Text fontWeight="medium">
                        {order?.customer_address || 'Alamat customer tidak tersedia'}
                      </Text>
                    </Box>
                  ) : (
                    // For pickup orders: show location dropdown
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
                  )}
                </FormControl>
              )}

              {/* Pickup Method - Hidden for Pickup Statuses */}
              {shippingStatus !== 'siap di ambil' && shippingStatus !== 'sudah di ambil' && shippingArea === 'dalam-kota' && (
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

              {/* Courier Service - for deliveryman (Kurir Toko) - Hidden for Pickup Statuses */}
              {shippingStatus !== 'siap di ambil' && shippingStatus !== 'sudah di ambil' && pickupMethod === 'deliveryman' && shippingArea === 'dalam-kota' && (
                <FormControl>
                  <FormLabel>Nama Kurir</FormLabel>
                  <Input
                    value={courierService}
                    onChange={(e) => setCourierService(e.target.value)}
                    placeholder="Masukkan nama kurir toko"
                  />
                </FormControl>
              )}

              {/* Courier Service - for ojek-online and luar-kota - Hidden for Pickup Statuses */}
              {shippingStatus !== 'siap di ambil' && shippingStatus !== 'sudah di ambil' && (pickupMethod === 'ojek-online' || shippingArea === 'luar-kota') && (
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

              {/* Tracking Number - Hidden for Pickup Statuses */}
              {shippingStatus !== 'siap di ambil' && shippingStatus !== 'sudah di ambil' && (
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
              )}

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
            <SimpleGrid columns={{ base: 1, md: isLuarKota ? 2 : 3 }} spacing={4}>
              {/* Conditional rendering based on shipping area */}
              {isLuarKota ? (
                // Luar Kota - show Foto Produk Sudah Dikemas and Foto Pengiriman only
                <>
                  {/* Foto Produk Sudah Dikemas untuk luar kota */}
                  <Box>
                    <Text fontWeight="semibold" mb={2}>Foto Produk Sudah Dikemas</Text>
                    {renderUploadedImage('packagedProduct')}
                    {renderUploadButton('packagedProduct')}
                  </Box>
                  {/* Foto Pengiriman untuk luar kota */}
                  <Box>
                    <Text fontWeight="semibold" mb={2}>Foto Pengiriman</Text>
                    {renderUploadedImage('pickedUp')}
                    {renderUploadButton('pickedUp')}
                  </Box>
                </>
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
            <QRCodeGenerator 
              value={fullUrl} 
              size={200} 
              showDownload={true}
              downloadFilename={`QR-Order-${order.id}`}
            />
          </Box>
        </Flex>
       
      </CustomModal>

    </Box>
  );
};

export default AdminOrderDetailPage;
