import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Heading, Text, VStack, HStack, Badge, Button,
  Table, Tbody, Tr, Td, Th, Thead, Divider, Spinner,
  Alert, AlertIcon, Card, CardBody, CardHeader, CardFooter,
  useToast, Flex, Grid, GridItem, Select, FormControl, 
  FormLabel, Textarea, SimpleGrid, Stack, Tag, Image, Radio, RadioGroup,
  useDisclosure, Modal, ModalOverlay, ModalContent,
  ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
  Accordion, AccordionItem, AccordionButton, 
  AccordionPanel, AccordionIcon, Input, IconButton,
  Tabs, TabList, TabPanels, Tab, TabPanel, Checkbox
} from '@chakra-ui/react';
import { QRCodeSVG } from 'qrcode.react';
import { orderService } from '../../api/orderService';
import { refreshOrderStatus } from '../../api/api';
import { adminApi, Order } from '../../api/adminApi';
import html2canvas from 'html2canvas';
import { formatDate } from '../../utils/date';
import axios from 'axios';
import { normalizeShippingStatus, getShippingStatusConfig, getShippingStatusOptions } from '../../utils/orderStatusUtils';
import EditableLokasiPengiriman from '../../components/EditableLokasiPengiriman';

interface Location {
  id: string;
  nama_lokasi: string;
  kode_area?: string;
}

interface UploadedImages {
  readyForPickup: string;
  pickedUp: string;
  received: string;
  shipmentProof: string;
}

function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  // Defensive logging untuk mendeteksi ID yang tidak valid
  console.log(`🔍 Order ID dari URL params: "${id}"`);
  
  // Validasi ID untuk mencegah penggunaan placeholder
  const isValidOrderId = id && typeof id === 'string' && !id.includes('[') && !id.includes(']');
  console.log(`🔍 Order ID valid: ${isValidOrderId}`);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [shippingStatus, setShippingStatus] = useState<string>('');
  const [adminNote, setAdminNote] = useState<string>('');
  const [savedAdminNote, setSavedAdminNote] = useState<string>('');
  const [metodePengiriman, setMetodePengiriman] = useState<string>('');
  const [isEditingNote, setIsEditingNote] = useState<boolean>(false);
  const [isSavingNote, setIsSavingNote] = useState<boolean>(false);
  const [isDeletingNote, setIsDeletingNote] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [formChanged, setFormChanged] = useState<boolean>(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImages>({
    readyForPickup: "",
    pickedUp: "",
    received: "",
    shipmentProof: ""
  });
  const [showQRCode, setShowQRCode] = useState<boolean>(false);
  const fileInputRefs = {
    readyForPickup: useRef<HTMLInputElement>(null),
    pickedUp: useRef<HTMLInputElement>(null),
    received: useRef<HTMLInputElement>(null),
    shipmentProof: useRef<HTMLInputElement>(null)
  };
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const navigate = useNavigate();
  const [shippingArea, setShippingArea] = useState<string>('dalam-kota'); // Default: dalam-kota (dalam-kota | luar-kota)
  const [pickupMethod, setPickupMethod] = useState<string>('sendiri'); // Default: sendiri (sendiri | ojek-online)
  const [courierService, setCourierService] = useState<string>(''); // TIKI, JNE, Travel, atau custom
  const [trackingNumber, setTrackingNumber] = useState<string>(''); // Nomor Resi
  const [trackingNumberError, setTrackingNumberError] = useState<string>(''); // Error untuk validasi nomor resi
  const [tabIndex, setTabIndex] = useState<number>(0); // State untuk mengontrol tab aktif
  const [locations, setLocations] = useState<Location[]>([]); // Daftar lokasi (kode area)
  const [outlets, setOutlets] = useState<any[]>([]); // Dynamic outlets from API
  const [lokasi_pengiriman, setLokasiPengiriman] = useState<string>(''); // Lokasi pengiriman terpilih
  const [lokasi_pengambilan, setLokasiPengambilan] = useState<string>(''); // Lokasi pengambilan terpilih
  const [tipe_pesanan, setTipePesanan] = useState<string>(''); // Tipe pesanan (Pesan Antar/Pesan Ambil)

  const transformURL = (url: string): string => {
    if (!url) return ""; // Mengembalikan string kosong, bukan null
    
    // Remove any existing timestamp parameter
    let cleanUrl = url;
    if (url.includes('?')) {
      cleanUrl = url.split('?')[0];
    }
    
    // Always add a new timestamp parameter to prevent caching
    const timestamp = Date.now();
    
    if (cleanUrl.includes('kurniasari-shipping-images.kurniasari.co.id')) {
      const fileName = cleanUrl.split('/').pop();
      return `https://proses.kurniasari.co.id/${fileName}?t=${timestamp}`;
    }
    
    // Always add timestamp parameter
    return `${cleanUrl}?t=${timestamp}`;
  };

  // Periksa apakah ini adalah public order (format ORDER-xxx)  
  const isPublicOrderPage = id && id.startsWith('ORDER-');
  
  const loadAllData = useCallback(async () => {
    if (!isValidOrderId) {
      console.error('🚫 Invalid Order ID:', id);
      setError('ID Pesanan tidak valid');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Reset all state to ensure fresh data
      setUploadedImages({
        readyForPickup: "",
        pickedUp: "",
        received: "",
        shipmentProof: ""
      });
      
      // 1. Get locations first (always use adminApi)
      const locationsRes = await adminApi.getLocations();
      if (!locationsRes.success) throw new Error('Gagal memuat daftar lokasi.');
      const fetchedLocations = (locationsRes.data || []).map((loc: any) => ({
        id: loc.id,
        nama_lokasi: loc.nama_lokasi,
        kode_area: loc.kode_area
      }));
      setLocations(fetchedLocations);
      
      // 1.1. Load dynamic outlets
      try {
        // Use axios directly for outlets API call since adminApi.get doesn't exist
        const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://order-management-app-production.wahwooh.workers.dev';
        const outletsResponse = await axios.get(`${apiUrl}/api/admin/outlets`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken') || ''}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (outletsResponse.data.success && outletsResponse.data.data) {
          setOutlets(outletsResponse.data.data);
          console.log('Dynamic outlets loaded:', outletsResponse.data.data);
        }
      } catch (outletsError) {
        console.error('Error loading outlets (non-critical):', outletsError);
        // Set fallback outlets if API fails
        setOutlets([]);
      }
      
      // 2. Get order data with special handling for public orders
      let orderData: any;
      
      if (isPublicOrderPage) {
        // For public orders, use direct API call with axios
        const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://order-management-app-production.wahwooh.workers.dev';
        console.log(`🌐 Menggunakan API URL: ${apiUrl}`);
        
        try {
          // Tambahkan timestamp untuk memaksa refresh data dari API tanpa header cache control
          // Hapus header Cache-Control dan Expires untuk mencegah CORS error di Chrome
          const response = await axios.get(`${apiUrl}/api/orders/${id}?_nocache=${Date.now()}`);
          console.log('🌐 Request dibuat tanpa header cache untuk mencegah CORS error di Chrome');
          console.log('📦 Respons API (Lengkap):', JSON.stringify(response.data, null, 2));
          console.log('🔍 Shipping Area dari API:', response.data.data?.shipping_area || response.data.order?.shipping_area || 'tidak ada');
          
          // Check response structure (could be order or data)
          if (response.data.success) {
            if (response.data.order) {
              orderData = response.data.order; // Old format
            } else if (response.data.data) {
              orderData = response.data.data;  // New format from production API
            } else {
              throw new Error('Format data tidak dikenali');
            }
          } else {
            throw new Error('Respons API tidak sukses');
          }
        } catch (apiError) {
          console.error('❌ Error saat memanggil API:', apiError);
          throw apiError;
        }
      } else {
        // For admin-specific orders, use adminApi.getOrderDetails
        const response = await adminApi.getOrderDetails(id);
        if (response.success && response.data) {
          orderData = response.data;
        } else {
          throw new Error(response.error || 'Data tidak ditemukan dari adminApi');
        }
      }
      
      // Process order data
      if (!orderData) {
        throw new Error('Data pesanan tidak ditemukan');
      }
      
      let finalOrder = orderData;
      if (finalOrder.payment_response) {
        try {
          const paymentDetails = JSON.parse(finalOrder.payment_response);
          finalOrder = {
            ...finalOrder,
            payment_method: paymentDetails.payment_type || finalOrder.payment_method,
            payment_time: paymentDetails.settlement_time || finalOrder.payment_time,
            payment_status: paymentDetails.transaction_status || finalOrder.payment_status,
          };
        } catch (e) {
          console.error('Error parsing payment_response:', e);
        }
      }
      
      setOrder(finalOrder);

      // 3. Set lokasi pengiriman dan pengambilan berdasarkan nama lokasi
      // Perhatikan: kita langsung menggunakan nama_lokasi, bukan kode_area yang sudah dihapus
      setLokasiPengiriman(finalOrder.lokasi_pengiriman || '');
      setLokasiPengambilan(finalOrder.lokasi_pengambilan || '');

      // 4. Set other form states
      setShippingStatus(finalOrder.shipping_status || '');
      setAdminNote(finalOrder.admin_note || '');
      setSavedAdminNote(finalOrder.admin_note || '');
      setTipePesanan(finalOrder.tipe_pesanan);
      // Pastikan nilai shipping_area dari database digunakan untuk state lokal
      setShippingArea(finalOrder.shipping_area || 'dalam-kota');
      console.log('DEBUG - Setting shipping area from order:', finalOrder.shipping_area);
      
      // Set pickup_method dari data order jika tersedia
      if (finalOrder.pickup_method) {
        setPickupMethod(finalOrder.pickup_method);
        console.log('DEBUG - Setting pickup method from order:', finalOrder.pickup_method);
      } else {
        // Default ke 'sendiri' jika tidak ada di order
        setPickupMethod('sendiri');
        console.log('DEBUG - No pickup_method in order data, defaulting to "sendiri"');
      }
      if (finalOrder.tipe_pesanan === 'Pesan Antar') {
        setMetodePengiriman('kurir-toko');
      } else if (finalOrder.tipe_pesanan === 'Pesan Ambil') {
        setMetodePengiriman('diambil-sendiri');
      }

      // 5. Process Shipping Images
      // Nested try-catch for shipping images (non-critical)  
      try {
        const imagesRes = await adminApi.getShippingImages(id!);
        console.log('DEBUG-IMAGES Shipping images response:', imagesRes);
        if (imagesRes.success && imagesRes.data) {
          // Create a mapping object to convert database image_type to component state keys
          const typeMapping: { [key: string]: string } = {
            'ready_for_pickup': 'readyForPickup',
            'picked_up': 'pickedUp',
            'delivered': 'received'
          };
          
          const imagesData: any = {};
          // Handle both array and object responses
          const imageArray = Array.isArray(imagesRes.data) ? imagesRes.data : Object.values(imagesRes.data || {});
          imageArray.forEach((img: any) => {
            // Map the database image_type to the component state key
            const componentKey = typeMapping[img.image_type] || img.image_type;
            // Transform URL to include a timestamp to bypass cache
            const transformedURL = transformURL(img.image_url);
            
            // Store the image URL under BOTH keys (frontend and backend format)
            // This ensures compatibility with both admin and public views
            imagesData[componentKey] = transformedURL;
            imagesData[img.image_type] = transformedURL;
            
            console.log(`DEBUG-IMAGES Double mapping ${img.image_type} → ${componentKey}:`, transformedURL);
          });
          
          // Update the state with the images fetched from the backend
          setUploadedImages(imagesData);
          console.log('DEBUG-IMAGES Final processed images data:', imagesData);
        }
      } catch (imageErr) {
        console.error('Error loading shipping images:', imageErr);
        // Non-critical error, don't throw
      }
      
    } catch (err: any) {
      console.error('[AdminOrderDetailPage] Error loading data:', err);
      setError(err.message);
      toast({ title: 'Error', description: err.message, status: 'error', duration: 5000, isClosable: true });
    } finally {
      setLoading(false);
    }
  }, [id, toast, isValidOrderId, isPublicOrderPage]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    try {
      const { data } = await refreshOrderStatus(id!);
      if (data.success) {
        await loadAllData(); // Refetch all data
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
    } catch (err: any) {
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
