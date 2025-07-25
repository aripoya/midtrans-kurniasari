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
import { adminApi } from '../../api/adminApi';
import html2canvas from 'html2canvas';
import { formatDate } from '../../utils/date';
import axios from 'axios';
import { normalizeShippingStatus, getShippingStatusConfig, getShippingStatusOptions } from '../../utils/orderStatusUtils';
import imageCompression from 'browser-image-compression';

function AdminOrderDetailPage() {
  const { id } = useParams();
  // Defensive logging untuk mendeteksi ID yang tidak valid
  console.log(`🔍 Order ID dari URL params: "${id}"`); 
  
  // Validasi ID untuk mencegah penggunaan placeholder
  const isValidOrderId = id && typeof id === 'string' && !id.includes('[') && !id.includes(']');
  console.log(`🔍 Order ID valid: ${isValidOrderId}`);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shippingStatus, setShippingStatus] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [savedAdminNote, setSavedAdminNote] = useState('');
  const [metodePengiriman, setMetodePengiriman] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isDeletingNote, setIsDeletingNote] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formChanged, setFormChanged] = useState(false);
  const [uploadedImages, setUploadedImages] = useState({
    readyForPickup: "",
    pickedUp: "",
    received: "",
    shipmentProof: ""
  });
  const [compressedImages, setCompressedImages] = useState({
    readyForPickup: null,
    pickedUp: null,
    received: null,
    shipmentProof: null
  });
  const [showQRCode, setShowQRCode] = useState(false);
  const fileInputRefs = {
    readyForPickup: useRef(null),
    pickedUp: useRef(null),
    received: useRef(null),
    shipmentProof: useRef(null)
  };
  const qrCodeRef = useRef(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const navigate = useNavigate();
  const [shippingArea, setShippingArea] = useState('dalam-kota'); // Default: dalam-kota (dalam-kota | luar-kota)
  const [pickupMethod, setPickupMethod] = useState('deliveryman'); // Default: deliveryman (deliveryman | ojek-online)
  const [courierService, setCourierService] = useState(''); // TIKI, JNE, Travel, atau custom
  const [trackingNumber, setTrackingNumber] = useState(''); // Nomor Resi
  const [trackingNumberError, setTrackingNumberError] = useState(''); // Error untuk validasi nomor resi
  const [tabIndex, setTabIndex] = useState(0); // State untuk mengontrol tab aktif
  const [locations, setLocations] = useState([]); // Daftar lokasi (kode area)
  const [lokasi_pengiriman, setLokasiPengiriman] = useState(''); // Lokasi pengiriman terpilih
  const [lokasi_pengambilan, setLokasiPengambilan] = useState(''); // Lokasi pengambilan terpilih
  const [tipe_pesanan, setTipePesanan] = useState(''); // Tipe pesanan (Pesan Antar/Pesan Ambil)

  const transformURL = (url) => {
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
        readyForPickup: null,
        pickedUp: null,
        received: null,
        shipmentProof: null
      });
      
      // 1. Get locations first (always use adminApi)
      const locationsRes = await adminApi.getLocations();
      if (!locationsRes.success) throw new Error('Gagal memuat daftar lokasi.');
      const fetchedLocations = locationsRes.data;
      setLocations(fetchedLocations);
      
      // 2. Get order data with special handling for public orders
      let orderData;
      
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
        // For admin-specific orders, use orderService
        const serviceResponse = await orderService.getOrderById(id);
        if (serviceResponse.success && serviceResponse.order) {
          orderData = serviceResponse.order;
        } else if (serviceResponse.success && serviceResponse.data) {
          orderData = serviceResponse.data;
        } else {
          throw new Error('Data tidak ditemukan dari orderService');
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
        // Default ke 'deliveryman' jika tidak ada di order
        setPickupMethod('deliveryman');
        console.log('DEBUG - No pickup_method in order data, defaulting to "deliveryman"');
      }
      if (finalOrder.tipe_pesanan === 'Pesan Antar') {
        setMetodePengiriman('kurir-toko');
      } else if (finalOrder.tipe_pesanan === 'Pesan Ambil') {
        setMetodePengiriman('diambil-sendiri');
      }

      // 5. Process Shipping Images
      // Nested try-catch for shipping images (non-critical)  
      try {
        const imagesRes = await adminApi.getShippingImages(id);
        console.log('DEBUG-IMAGES Shipping images response:', imagesRes);
        if (imagesRes.success && imagesRes.data) {
          // Create a mapping object to convert database image_type to component state keys
          const typeMapping = {
            'ready_for_pickup': 'readyForPickup',
            'picked_up': 'pickedUp',
            'delivered': 'received',
            'shipment_proof': 'shipmentProof'
          };
          
          const imagesData = {};
          imagesRes.data.forEach(img => {
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
      
    } catch (err) {
      console.error('[AdminOrderDetailPage] Error loading data:', err);
      setError(err.message);
      toast({ title: 'Error', description: err.message, status: 'error', duration: 5000, isClosable: true });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);
  
  // Reset pickup method when shipping area changes to 'luar-kota'
  useEffect(() => {
    if (shippingArea === 'luar-kota' && pickupMethod) {
      setPickupMethod('');
    }
  }, [shippingArea, pickupMethod]);

  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    try {
      const { data } = await refreshOrderStatus(id);
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
  
  // Function for updating shipping status using adminApi
  const handleUpdateStatus = async () => {
    setIsUpdating(true);
    try {
      console.log('DEBUG - Selected location values:', {
        lokasi_pengambilan,
        lokasi_pengiriman
      });
      // Normalisasi nilai untuk memastikan sesuai dengan ekspektasi backend
      // Backend mengharapkan nilai string yang valid atau null, bukan undefined
      const normalizedStatus = shippingStatus?.trim() || null;
      const normalizedAdminNote = adminNote?.trim() || null;
      const normalizedShippingArea = shippingArea?.trim() || null;
      let normalizedPickupMethod = pickupMethod?.trim() || null;
      const normalizedMetodePengiriman = metodePengiriman?.trim() || null;
      const normalizedTipePesanan = tipe_pesanan?.trim() || null;
      const normalizedLokasiPengiriman = lokasi_pengiriman?.trim() || null;
      const normalizedLokasiPengambilan = lokasi_pengambilan?.trim() || null;
      
      // Validasi status sebelum mengirim ke server
      const allowedStatuses = [
        'menunggu diproses', 'pending', 
        'dikemas', 'diproses',
        'siap kirim', 'siap diambil', 'siap di ambil',
        'dalam pengiriman', 'sedang dikirim', 'dikirim',
        'diterima', 'received', 'sudah di terima'
      ];
      if (normalizedStatus && !allowedStatuses.includes(normalizedStatus)) {
        console.error(`[ERROR] Invalid status: '${normalizedStatus}'. Allowed values:`, allowedStatuses);
        throw new Error(`Status tidak valid. Nilai yang diperbolehkan: ${allowedStatuses.join(', ')}`);
      }
      
      // Log untuk debugging
      console.log('[DEBUG-STATUS] Status yang akan dikirim:', normalizedStatus);
      
      // Validasi shipping area
      const allowedShippingAreas = ['dalam-kota', 'luar-kota'];
      if (normalizedShippingArea && !allowedShippingAreas.includes(normalizedShippingArea)) {
        throw new Error(`Area pengiriman tidak valid. Nilai yang diperbolehkan: ${allowedShippingAreas.join(', ')}`);
      }
      
      // Validasi pickup method jika shipping area adalah dalam-kota
      if (normalizedShippingArea === 'dalam-kota') {
        const allowedPickupMethods = ['deliveryman', 'ojek-online'];
        if (normalizedPickupMethod && !allowedPickupMethods.includes(normalizedPickupMethod)) {
          throw new Error(`Metode pengambilan tidak valid. Nilai yang diperbolehkan: ${allowedPickupMethods.join(', ')}`);
        }
      }
      
      // Reset pickup_method jika shipping area adalah luar-kota
      if (normalizedShippingArea === 'luar-kota') {
        normalizedPickupMethod = null;
      }
      
      // Buat objek data dengan nilai yang sudah dinormalisasi dan validasi
      const shippingData = {};
      
      // Siapkan data yang akan dikirim ke server
      if (normalizedStatus) shippingData.status = normalizedStatus;
      if (normalizedAdminNote !== null) shippingData.admin_note = normalizedAdminNote;
      // Aktifkan kembali shipping_area karena kolom sudah ditambahkan ke database
      if (normalizedShippingArea) shippingData.shipping_area = normalizedShippingArea;
      // Kolom pickup_method sudah ditambahkan kembali ke database
      // Gunakan nilai pickupMethod dari state komponen
      // Dengan shipping area dalam-kota, pickup_method dibutuhkan
      if (normalizedShippingArea === 'dalam-kota') {
        // Validasi pickup method tidak boleh kosong untuk dalam-kota
        if (!normalizedPickupMethod) {
          console.warn('Pickup method kosong untuk area dalam kota - default ke "deliveryman"');
          normalizedPickupMethod = 'deliveryman';
        }
        shippingData.pickup_method = normalizedPickupMethod;
      } else if (normalizedShippingArea === 'luar-kota') {
        // Kosongkan pickup_method jika luar kota
        shippingData.pickup_method = null;
      }
      // Tambahkan metode pengiriman hanya jika area pengiriman dalam kota
    if (normalizedMetodePengiriman && normalizedShippingArea !== 'luar-kota') shippingData.metode_pengiriman = normalizedMetodePengiriman;
      
      // Tambahkan field lokasi
      if (normalizedTipePesanan) shippingData.tipe_pesanan = normalizedTipePesanan;
      
      // Tambahkan lokasi pengiriman jika tipe pesanan adalah Pesan Antar dan area pengiriman dalam kota
    if (normalizedTipePesanan === 'Pesan Antar' && normalizedLokasiPengiriman && normalizedShippingArea !== 'luar-kota') {
      shippingData.lokasi_pengiriman = normalizedLokasiPengiriman;
    }
      
      // Tambahkan lokasi pengambilan jika tipe pesanan adalah Pesan Ambil
      if (normalizedTipePesanan === 'Pesan Ambil' && normalizedLokasiPengambilan) {
        shippingData.lokasi_pengambilan = normalizedLokasiPengambilan;
      }
      
      // Tambahkan tracking_number dan courier_service untuk luar kota
      if (normalizedShippingArea === 'luar-kota') {
        if (courierService !== 'TRAVEL') {
          shippingData.tracking_number = trackingNumber;
        }
        shippingData.courier_service = courierService;
      }
      // Validasi apakah ada data yang akan diupdate
      if (Object.keys(shippingData).length === 0) {
        throw new Error('Tidak ada data yang diubah. Masukkan minimal satu field untuk diperbarui.');
      }
      
      console.log('Mengirim data update ke server:', {
        orderId: id,
        shippingData
      });
      
      const response = await adminApi.updateOrderDetails(id, shippingData);
      console.group('handleUpdateStatus - Response Details');
      console.log('Response dari server:', response);
      console.log('Response data:', response.data);
      console.log('Response error:', response.error);
      console.groupEnd();
      
      if (response.error) {
        console.error('Error response dari server:', response.error);
        throw new Error(response.error);
      }

      // Update local state if successful
      setOrder(prev => {
        const updated = {
          ...prev,
          shipping_status: normalizedStatus || prev.shipping_status,
          // shipping_area perlu diperbarui untuk sinkronisasi tampilan
          shipping_area: normalizedShippingArea || prev.shipping_area,
          pickup_method: normalizedPickupMethod || prev.pickup_method,
          // Tambahkan field lain yang diupdate
          tipe_pesanan: normalizedTipePesanan || prev.tipe_pesanan,
          metode_pengiriman: normalizedMetodePengiriman || prev.metode_pengiriman,
          admin_note: normalizedAdminNote || prev.admin_note
        };
        
        // Tambahkan field kondisional
        if (normalizedTipePesanan === 'Pesan Antar' && normalizedLokasiPengiriman) {
          updated.lokasi_pengiriman = normalizedLokasiPengiriman;
        }
        
        if (normalizedTipePesanan === 'Pesan Ambil' && normalizedLokasiPengambilan) {
          updated.lokasi_pengambilan = normalizedLokasiPengambilan;
        }
        
        // Tambahkan tracking dan courier service untuk luar kota
        if (normalizedShippingArea === 'luar-kota') {
          if (courierService !== 'TRAVEL') {
            updated.tracking_number = trackingNumber || prev.tracking_number;
          }
          updated.courier_service = courierService || prev.courier_service;
        }
        
        console.log('State order diperbarui:', updated);
        return updated;
      });
      
      // Set saved admin note dan reset form changed state
      setSavedAdminNote(normalizedAdminNote || '');
      setFormChanged(false);
      
      // Show success notification
      toast({
        title: "Status pesanan berhasil diperbarui",
        description: `Data pesanan berhasil diperbarui`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      
      // Refresh hanya jika perlu update data tambahan seperti shipping images
      // tapi TIDAK reload seluruh halaman
      if (shippingStatus === 'ready_for_pickup' || shippingStatus === 'picked_up') {
        setTimeout(() => {
          // Hanya update bagian yang perlu direfresh, tidak reload semua
          fetchShippingImages();
        }, 500);
      }
    } catch (err) {
      console.error('Error saat memperbarui status pesanan:', err);
      toast({
        title: "Gagal memperbarui informasi pesanan",
        description: err.message || 'Terjadi kesalahan pada server',
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Fungsi untuk menyimpan catatan admin secara terpisah
  const handleSaveNote = async () => {
    setIsSavingNote(true);
    try {
      const response = await adminApi.updateOrderStatus(id, order.shipping_status, adminNote);
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Update saved admin note
      setSavedAdminNote(adminNote);
      setIsEditingNote(false);
      
      // Update order state
      setOrder(prev => ({
        ...prev,
        admin_note: adminNote
      }));
      
      // Refresh all order data to ensure consistency
      await loadAllData();
      
      toast({
        title: "Catatan berhasil disimpan",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      toast({
        title: "Gagal menyimpan catatan",
        description: err.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSavingNote(false);
    }
  };
  
  // Fungsi untuk menangani upload gambar dengan kompresi
  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validasi tipe file
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validMimeTypes.includes(file.type)) {
      toast({
        title: "Format file tidak didukung",
        description: "Gunakan format JPG, PNG, WebP, atau GIF",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }
    
    // Validasi ukuran file (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File terlalu besar",
        description: "Ukuran maksimal file adalah 5MB",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }
    
    try {
      // Tampilkan indikator loading
      toast({
        title: "Mengoptimasi gambar",
        description: "Sedang memproses...",
        status: "info",
        duration: 2000,
        isClosable: true,
      });
      
      // Opsi kompresi gambar
      const options = {
        maxSizeMB: 1,              // Maksimal 1 MB setelah kompresi
        maxWidthOrHeight: 1200,     // Resize maksimal ke 1200px width/height
        useWebWorker: true,         // Gunakan Web Worker untuk proses di background
        initialQuality: 0.8,        // Kualitas awal 80%
      };
      
      console.log('Ukuran file sebelum kompresi:', (file.size / 1024 / 1024).toFixed(2) + ' MB');
      
      // Kompresi gambar menggunakan browser-image-compression
      const compressedFile = await imageCompression(file, options);
      
      console.log('Ukuran file setelah kompresi:', (compressedFile.size / 1024 / 1024).toFixed(2) + ' MB');
      console.log('Rasio kompresi:', (file.size / compressedFile.size).toFixed(2) + 'x');
      
      // Konversi type ke format yang digunakan API
      const imageTypeMap = {
        readyForPickup: 'ready_for_pickup',
        pickedUp: 'picked_up',
        received: 'delivered'
      };
      
      // Tampilkan preview gambar hasil kompresi
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImages(prev => ({
          ...prev,
          [type]: e.target.result
        }));
        
        // Notifikasi sukses
        toast({
          title: "Optimasi gambar berhasil",
          description: `Ukuran file berkurang dari ${(file.size / 1024 / 1024).toFixed(2)} MB menjadi ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      };
      reader.readAsDataURL(compressedFile);
      
      // Simpan file hasil kompresi untuk diupload nantinya
      // File disimpan dengan nama yang sama tetapi sudah dioptimasi ukurannya
      const optimizedFile = new File([compressedFile], file.name, {
        type: compressedFile.type,
        lastModified: new Date().getTime(),
      });
      
      // Update state untuk form submission (gunakan file hasil kompresi)
      setCompressedImages(prev => ({
        ...prev,
        [type]: optimizedFile
      }));
      
    } catch (error) {
      console.error('Error saat kompresi gambar:', error);
      toast({
        title: "Gagal mengoptimasi gambar",
        description: error.message || "Terjadi kesalahan saat mengoptimasi gambar",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      
      // Fallback ke metode tanpa kompresi jika terjadi error
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImages(prev => ({
          ...prev,
          [type]: e.target.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Fungsi untuk menghapus gambar shipping
  const handleDeleteImage = async (type) => {
    if (!uploadedImages[type] || uploadedImages[type] === "" || !order) return;
    
    try {
      setIsUploading(true);
      
      // Konversi type ke format yang digunakan API
      const apiTypeMap = {
        readyForPickup: 'ready_for_pickup',
        pickedUp: 'picked_up',
        received: 'delivered'
      };
      
      const imageType = apiTypeMap[type];
      console.log(`[DEBUG-DELETE] Deleting image for ${type} (${imageType})`);
      
      // Memanggil API untuk hapus gambar
      const result = await adminApi.deleteShippingImage(id, imageType);
      
      if (result.success) {
        // Update state
        setUploadedImages(prev => ({
          ...prev,
          [type]: ""
        }));
        
        // Hapus dari localStorage untuk sinkronisasi
        const storageKey = `shipping_images_${id}`;
        try {
          const storedData = localStorage.getItem(storageKey);
          if (storedData) {
            const parsedData = JSON.parse(storedData);
            parsedData[type] = null;
            localStorage.setItem(storageKey, JSON.stringify(parsedData));
          }
        } catch (storageErr) {
          console.error('Error updating localStorage after image deletion:', storageErr);
        }
        
        toast({
          title: "Gambar berhasil dihapus",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        
        // Enable Update button after successful image deletion
        setFormChanged(true);
      } else {
        throw new Error(result.error || 'Gagal menghapus gambar');
      }
    } catch (error) {
      console.error(`Error deleting ${type} image:`, error);
      toast({
        title: "Gagal menghapus gambar",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  // Fungsi untuk menyimpan semua foto yang sudah diupload
  const handleSaveImages = async () => {
    console.log('[DEBUG-UPLOAD] Starting handleSaveImages...');
    setIsUploading(true);
    
    try {
      // Definisi mapping tipe gambar antara frontend dan API
      const apiTypeMap = {
        readyForPickup: 'ready_for_pickup',
        pickedUp: 'picked_up',
        received: 'delivered'
      };
      
      // Array untuk menyimpan detail dan promise upload
      const uploadPromises = [];
      const uploadDetails = [];
      const imageTypes = ['readyForPickup', 'pickedUp', 'received'];
      
      // Fungsi untuk mengkonversi Data URL ke File
      const dataURLtoFile = (dataurl, filename) => {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, {type: mime});
      };
      
      // Untuk setiap jenis foto, upload jika ada
      for (const type of imageTypes) {
        console.log(`[DEBUG-UPLOAD] Checking ${type} image:`, uploadedImages[type] ? "Present" : "Missing");
        
        if (uploadedImages[type]) {
          // Cek apakah gambar sudah dalam format base64 (hasil dari FileReader) atau URL dari API
          if (uploadedImages[type].startsWith('data:')) {
            console.log(`[DEBUG-UPLOAD] ${type} is a data URL, will upload`);
            const filename = `${type}_${new Date().getTime()}.jpg`;
            const file = dataURLtoFile(uploadedImages[type], filename);
            
            console.log(`[DEBUG-UPLOAD] Created file for ${type}:`, filename);
            uploadDetails.push({
              type, 
              apiType: apiTypeMap[type],
              filename
            });
            
            uploadPromises.push(
              adminApi.uploadShippingImage(id, apiTypeMap[type], file)
            );
          } else {
            // Skip gambar yang sudah berupa URL (sudah terupload)
            console.log(`[DEBUG-UPLOAD] ${type} is already a URL, skipping upload:`, uploadedImages[type]);
          }
        }
      }
      
      // Tunggu semua promise upload selesai
      await Promise.all(uploadPromises);
      
      // Update state sekali dengan semua perubahan
      setUploadedImages(updatedImages);
      console.log('[DEBUG-UPLOAD] Updated images with both keys:', updatedImages);
      
      // Simpan ke localStorage untuk persistensi
      try {
        localStorage.setItem(`shipping_images_${id}`, JSON.stringify(updatedImages));
        console.log('[DEBUG-UPLOAD] Saved updated images to localStorage after upload');
      } catch (storageErr) {
        console.error('[DEBUG-UPLOAD] Failed to save to localStorage:', storageErr);
      }
      
      // Segera ambil ulang data gambar dari API setelah upload berhasil
      await adminApi.getShippingImages(id);
      
      // Refresh all order data to ensure consistency
      await loadAllData();
      
      toast({
        title: "Foto berhasil disimpan",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      console.error('[DEBUG-UPLOAD] Error in handleSaveImages:', err);
      toast({
        title: "Gagal menyimpan foto",
        description: err.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsUploading(false);
    }
  };

// Fungsi untuk menghapus catatan admin
const handleDeleteNote = async () => {
  setIsDeletingNote(true);
  try {
    const response = await adminApi.updateOrderStatus(id, order.shipping_status, '');
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    // Reset notes
    setAdminNote('');
    setSavedAdminNote('');
    setIsEditingNote(false);
    
    // Update order state
    setOrder(prev => ({
      ...prev,
      admin_note: ''
    }));

    toast({
      title: "Catatan dihapus",
      description: "Catatan admin berhasil dihapus",
      status: "success",
      duration: 5000,
      isClosable: true,
    });
  } catch (error) {
    console.error('Error deleting note:', error);
    toast({
      title: "Gagal menghapus catatan",
      description: error.message || "Terjadi kesalahan saat menghapus catatan admin",
      status: "error",
      duration: 5000,
      isClosable: true,
    });
  } finally {
    setIsDeletingNote(false);
  }
};

  // Fungsi untuk beralih ke mode edit
  const handleEditNote = () => {
    setAdminNote(savedAdminNote);
    setIsEditingNote(true);
  };

  // Fungsi untuk membatalkan edit
  const handleCancelEdit = () => {
    setAdminNote(savedAdminNote);
    setIsEditingNote(false);
  };

  // Fungsi untuk menghapus pesanan
  const handleDeleteOrder = async () => {
    try {
      setIsDeleting(true);
      const response = await adminApi.deleteOrder(id);
      
      if (!response.success) {
        throw new Error(response.error || 'Gagal menghapus pesanan');
      }
      
      toast({
        title: "Pesanan berhasil dihapus",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      
      // Redirect ke halaman admin orders setelah berhasil hapus
      navigate('/admin/orders');
    } catch (err) {
      toast({
        title: "Gagal menghapus pesanan",
        description: err.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsDeleting(false);
      onClose(); // Tutup modal
    }
  };

  const getPaymentStatusBadge = (status) => {
    const statusMap = {
      pending: { scheme: 'yellow', text: 'Menunggu Pembayaran' },
      paid: { scheme: 'green', text: 'Dibayar' },
      settlement: { scheme: 'green', text: 'Dibayar' },
      capture: { scheme: 'green', text: 'Dibayar' },
      deny: { scheme: 'red', text: 'Ditolak' },
      cancel: { scheme: 'red', text: 'Dibatalkan' },
      expire: { scheme: 'red', text: 'Kadaluarsa' },
      failure: { scheme: 'red', text: 'Gagal' }
    };

    const statusInfo = statusMap[status] || { scheme: 'gray', text: status || 'Tidak Diketahui' };
    return <Badge colorScheme={statusInfo.scheme}>{statusInfo.text}</Badge>;
  };

  const getShippingStatusBadge = (status) => {
    const statusConfig = getShippingStatusConfig(status);
    return <Badge colorScheme={statusConfig.color}>{statusConfig.text}</Badge>;
  };

  // Handler untuk memilih gambar dan langsung upload ke server
  const handleImageSelect = async (type, file) => {
    if (!file) {
      return;
    }
    
    // Validasi tipe file
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validMimeTypes.includes(file.type)) {
      toast({
        title: "Format file tidak didukung",
        description: "Gunakan format JPG, PNG, WebP, atau GIF",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }
    
    // Validasi ukuran file (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File terlalu besar",
        description: "Ukuran maksimal file adalah 5MB",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }
    
    try {
      setIsUploading(true);
      console.log(`[DEBUG-IMAGE] Processing new image for ${type}`);
      
      // Tampilkan preview gambar
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          // Update state untuk preview lokal
          setUploadedImages(prev => {
            return {
              ...prev,
              [type]: e.target.result
            };
          });
          
          // Tidak perlu menyimpan ke localStorage karena sudah di state
          // dan gambar sudah diupload ke server
        } catch (uploadError) {
          console.error(`[DEBUG-IMAGE] Error uploading ${type} image:`, uploadError);
          toast({
            title: "Gagal menyimpan foto",
            description: uploadError.message,
            status: "error",
            duration: 5000,
            isClosable: true,
          });
        } finally {
          setIsUploading(false);
        }
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(`[DEBUG-IMAGE] General error in handleImageSelect for ${type}:`, error);
      toast({
        title: "Terjadi kesalahan",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      setIsUploading(false);
    }
  };

  // Fungsi untuk menampilkan gambar yang diupload
  // Helper to convert backend types to frontend types
  const mapTypeToBackendFormat = (type) => {
    // Map frontend types to backend format
    const typeMapping = {
      'readyForPickup': 'ready_for_pickup',
      'pickedUp': 'picked_up',
      'received': 'delivered',
      'shipmentProof': 'shipment_proof'
    };
    return typeMapping[type] || type;
  };
  
  const renderUploadedImage = (type) => {
    // Find by either frontend or backend type format for maximum compatibility
    const imageUrl = uploadedImages[type] || uploadedImages[mapTypeToBackendFormat(type)];
    
    console.log(`[RENDER-DEBUG] Rendering image for type: ${type}, URL:`, imageUrl);
    
    if (!imageUrl || imageUrl === "") {
      return (
        <Box 
          w="100%" 
          h="150px" 
          border="2px dashed" 
          borderColor="gray.200"
          borderRadius="md"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Text color="gray.500">Belum ada foto</Text>
        </Box>
      );
    }
    
    // Tambahkan key dengan timestamp untuk memaksa re-render komponen Image
    // saat URL berubah (bahkan jika base URL sama)
    const imageKey = `${type}-${Date.now()}`;
    
    return (
      <Image 
        key={imageKey}
        src={imageUrl} 
        alt={`Foto ${type}`}
        maxH="200px"
        objectFit="contain"
        mb={2}
        // Tambahkan onError handler untuk mengatasi kasus loading gagal
        onError={(e) => {
          console.error(`[IMAGE-ERROR] Failed to load image for ${type}:`, imageUrl);
          // Coba load ulang dengan cache busting baru jika terjadi error
          if (!imageUrl.includes('?t=')) {
            e.target.src = `${imageUrl}?t=${Date.now()}`;
          }
        }}
      />
    );
  };

if (loading) {
  return (
    <Flex justify="center" align="center" height="200px">
      <Spinner size="xl" />
    </Flex>
  );
}

if (error || !order) {
  return (
    <Box p={4} maxW="1200px" mx="auto">
      {loading ? (
        <Flex justify="center" align="center" minH="60vh">
          <Spinner size="xl" />
        </Flex>
      ) : error ? (
        <Box textAlign="center" py={10} px={6}>
          <Alert status="error" variant="solid" mb={6}>
            <AlertIcon />
            {error}
          </Alert>
          
          <Heading as="h2" size="xl" mt={6} mb={2}>
            Pesanan tidak ditemukan
          </Heading>
          
          <Text color={"gray.500"} mb={6}>
            Pesanan dengan ID <strong>{id}</strong> tidak dapat ditemukan di database. 
            Silakan periksa ID pesanan atau kembali ke daftar pesanan.
          </Text>

          <Button
            colorScheme="blue"
            onClick={() => navigate('/admin/orders')}
            size="lg"
            mt={4}
          >
            Kembali ke Daftar Pesanan
          </Button>
        </Box>
      ) : (
        <Alert status="warning">
          <AlertIcon />
          Pesanan tidak ditemukan.
        </Alert>
      )}
    </Box>
  );
}

const isPaid = ['paid', 'settlement', 'capture'].includes(order.payment_status);

return (
  <Box p={4} maxW="1200px" mx="auto">
    <HStack mb={6} justify="space-between">
      <Heading size="lg">
        Detail Pesanan #{order.id.substring(0, 8)}
      </Heading>
      <HStack spacing={4}>
        <Button 
          as={RouterLink} 
          to="/admin/orders" 
          variant="outline"
        >
          Kembali ke Daftar
        </Button>
        {isPublicOrderPage && (
          <Button
            as={RouterLink}
            to={`/orders/${id}`}
            colorScheme="blue"
            variant="outline"
            leftIcon={<span role="img" aria-label="eye">👁️</span>}
          >
            Lihat sebagai Pelanggan
          </Button>
        )}
      </HStack>
    </HStack>

    <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={6}>
      {/* Main order details */}
      <GridItem colSpan={{ base: 1, lg: 2 }}>
        <Card mb={6}>
          <CardHeader>
            <Heading size="md">Informasi Pesanan</Heading>
          </CardHeader>
          <CardBody>
            <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={6}>
              <GridItem>
                <Heading size="sm" mb={4}>Informasi Pelanggan</Heading>
                <Text><strong>Tanggal Pesanan:</strong> {formatDate(order.created_at)}</Text>
                <Text><strong>Nama:</strong> {order.customer_name}</Text>
                <Text><strong>Email:</strong> {order.customer_email}</Text>
                <Text><strong>Telepon:</strong> {order.customer_phone}</Text>
                {order.customer_address && (
                  <Text whiteSpace="pre-wrap"><strong>Alamat:</strong> {order.customer_address}</Text>
                )}
              </GridItem>
              <GridItem>
                <Heading size="sm" mb={4}>Detail Teknis Pengiriman</Heading>
                <Text><strong>Total:</strong> Rp {order.total_amount?.toLocaleString('id-ID')}</Text>
                <HStack mt={2}>
                  <Text><strong>Status Pengiriman:</strong></Text>
                  {getShippingStatusBadge(order.shipping_status)}
                </HStack>
                {order.shipping_area !== 'luar-kota' && <Text><strong>Tipe Pesanan:</strong> {order.tipe_pesanan || '-'}</Text>}
                <Text><strong>Area Pengiriman:</strong> {order.shipping_area === 'dalam-kota' ? 'Dalam Kota' : 'Luar Kota'}</Text>
                {order.tipe_pesanan === 'Pesan Ambil' && (
                  <Text><strong>Lokasi Pengambilan:</strong> {order.lokasi_pengambilan || '-'}</Text>
                )}
                {order.tipe_pesanan === 'Pesan Antar' && order.shipping_area !== 'luar-kota' && (
                  <Text><strong>Lokasi Pengiriman:</strong> {order.lokasi_pengiriman || '-'}</Text>
                )}
                {order.shipping_area !== 'luar-kota' && <Text><strong>Metode {order.tipe_pesanan === 'Pesan Ambil' ? 'Ambil' : 'Antar'}:</strong> {order.pickup_method === 'deliveryman' || order.pickup_method === 'sendiri' ? (order.tipe_pesanan === 'Pesan Ambil' ? 'Di Ambil Konsumen' : 'Di Antar Deliveryman') : order.pickup_method === 'ojek-online' ? (order.tipe_pesanan === 'Pesan Ambil' ? 'Di Ambil Driver Ojek Online' : 'Di Antar Driver Ojek Online') : order.pickup_method === 'team-delivery' ? 'Deliveryman' : '-'}</Text>}
                {order.shipping_area === 'luar-kota' && (
                  <>
                    <Text><strong>Jasa Kurir:</strong> {order.courier_service || '-'}</Text>
                    <Text><strong>No. Resi:</strong> {order.tracking_number || '-'}</Text>
                  </>
                )}
                <Text><strong>Dibuat:</strong> {formatDate(order.created_at)}</Text>
              </GridItem>
            </Grid>

            <Divider my={6} />

            <Heading size="sm" mb={4}>Barang Pesanan</Heading>
            <Box overflowX="auto">
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
            </Box>
          </CardBody>
        </Card>

        {/* Payment details accordion */}
        {order.payment_response && (
          <Card mb={6}>
            <CardHeader p={0}>
              <Accordion allowToggle defaultIndex={[0]} mt={4}>
                <AccordionItem>
                  <h2>
                    <AccordionButton>
                      <Box flex="1" textAlign="left">
                        <Heading size="md">Detail Teknis Pengiriman</Heading>
                      </Box>
                      <AccordionIcon />
                    </AccordionButton>
                  </h2>
                  <AccordionPanel pb={4}>
                    <Tabs variant="enclosed" index={tabIndex} onChange={setTabIndex}>
                      <TabList>
                        <Tab isDisabled={shippingArea !== 'dalam-kota'}>Dalam Kota</Tab>
                        <Tab isDisabled={shippingArea !== 'luar-kota'}>Luar Kota</Tab>
                        <Tab>QR Code Pengambilan</Tab>
                      </TabList>
                      <TabPanels>
                        {/* Tab Dalam Kota */}
                        <TabPanel>
                          <VStack spacing={4} align="stretch">
                            <Text fontWeight="medium">Status Foto - Dalam Kota ({order.tipe_pesanan === "Pesan Antar" ? "Pengantaran" : "Pengambilan"})</Text>
                            <Text fontSize="sm" color="gray.500">Unggah foto untuk setiap tahap pengiriman. Foto akan otomatis tersimpan.</Text>

                            {/* Foto Siap Ambil */}
                            <Box borderWidth="1px" borderRadius="lg" p={4}>
                              <Heading size="sm" mb={2}>
                                1. {order.tipe_pesanan === "Pesan Antar" ? "Siap Diantar" : "Siap Diambil"}
                              </Heading>
                              {renderUploadedImage('readyForPickup')}
                              <HStack mt={2} spacing={2}>
                                <Button
                                  onClick={() => fileInputRefs.readyForPickup.current.click()}
                                  isLoading={isUploading}
                                  size="sm"
                                  colorScheme="blue"
                                >
                                  {uploadedImages.readyForPickup ? 'Ganti Foto' : 'Upload Foto'}
                                </Button>
                                {uploadedImages.readyForPickup && (
                                  <>
                                    <Button
                                      size="sm"
                                      colorScheme="green"
                                      isLoading={isUploading}
                                      onClick={() => setFormChanged(true)}
                                    >
                                      Simpan Foto
                                    </Button>
                                    <Button
                                      size="sm"
                                      colorScheme="red"
                                      isLoading={isUploading}
                                      onClick={() => handleDeleteImage('readyForPickup')}
                                    >
                                      Hapus
                                    </Button>
                                  </>
                                )}
                              </HStack>
                              <Input
                                type="file"
                                accept="image/*"
                                hidden
                                ref={fileInputRefs.readyForPickup}
                                onChange={(e) => handleImageSelect('readyForPickup', e.target.files[0])}
                              />
                            </Box>

                            {/* Foto Sudah Diambil */}
                            <Box borderWidth="1px" borderRadius="lg" p={4}>
                              <Heading size="sm" mb={2}>
                                2. {order.tipe_pesanan === "Pesan Antar" ? "Sudah Diantar" : "Sudah Diambil"}
                              </Heading>
                              {renderUploadedImage('pickedUp')}
                              <HStack mt={2} spacing={2}>
                                <Button
                                  onClick={() => fileInputRefs.pickedUp.current.click()}
                                  isLoading={isUploading}
                                  size="sm"
                                  colorScheme="blue"
                                >
                                  {uploadedImages.pickedUp ? 'Ganti Foto' : 'Upload Foto'}
                                </Button>
                                {uploadedImages.pickedUp && (
                                  <>
                                    <Button
                                      size="sm"
                                      colorScheme="green"
                                      isLoading={isUploading}
                                      onClick={() => setFormChanged(true)}
                                    >
                                      Simpan Foto
                                    </Button>
                                    <Button
                                      size="sm"
                                      colorScheme="red"
                                      isLoading={isUploading}
                                      onClick={() => handleDeleteImage('pickedUp')}
                                    >
                                      Hapus
                                    </Button>
                                  </>
                                )}
                              </HStack>
                              <Input
                                type="file"
                                accept="image/*"
                                hidden
                                ref={fileInputRefs.pickedUp}
                                onChange={(e) => handleImageSelect('pickedUp', e.target.files[0])}
                              />
                            </Box>

                            {/* Foto Sudah Diterima */}
                            <Box borderWidth="1px" borderRadius="lg" p={4}>
                              <Heading size="sm" mb={2}>3. Sudah Diterima</Heading>
                              {renderUploadedImage('received')}
                              <HStack mt={2} spacing={2}>
                                <Button
                                  onClick={() => fileInputRefs.received.current.click()}
                                  isLoading={isUploading}
                                  size="sm"
                                  colorScheme="blue"
                                >
                                  {uploadedImages.received ? 'Ganti Foto' : 'Upload Foto'}
                                </Button>
                                {uploadedImages.received && (
                                  <>
                                    <Button
                                      size="sm"
                                      colorScheme="green"
                                      isLoading={isUploading}
                                      onClick={() => setFormChanged(true)}
                                    >
                                      Simpan Foto
                                    </Button>
                                    <Button
                                      size="sm"
                                      colorScheme="red"
                                      isLoading={isUploading}
                                      onClick={() => handleDeleteImage('received')}
                                    >
                                      Hapus
                                    </Button>
                                  </>
                                )}
                              </HStack>
                              <Input
                                type="file"
                                accept="image/*"
                                hidden
                                ref={fileInputRefs.received}
                                onChange={(e) => handleImageSelect('received', e.target.files[0])}
                              />
                            </Box>
                          </VStack>
                        </TabPanel>
                        {/* Tab Luar Kota */}
                        <TabPanel>
                          <VStack spacing={4} align="stretch">
                            <Text fontWeight="medium">Status Foto - Luar Kota</Text>
                            <Text fontSize="sm" color="gray.500">Unggah satu foto sebagai bukti pengiriman untuk pesanan luar kota.</Text>
                            
                            {/* Bukti Pengiriman */}
                            <Box borderWidth="1px" borderRadius="lg" p={4}>
                              <Heading size="sm" mb={2}>Bukti Pengiriman</Heading>
                              {renderUploadedImage('shipmentProof')}
                              <HStack mt={2} spacing={2}>
                                <Button
                                  onClick={() => fileInputRefs.shipmentProof.current.click()}
                                  isLoading={isUploading}
                                  size="sm"
                                  colorScheme="blue"
                                >
                                  {uploadedImages.shipmentProof ? 'Ganti Foto' : 'Upload Foto'}
                                </Button>
                                {uploadedImages.shipmentProof && (
                                  <Button
                                    size="sm"
                                    colorScheme="red"
                                    isLoading={isUploading}
                                    onClick={() => handleDeleteImage('shipmentProof')}
                                  >
                                    Hapus
                                  </Button>
                                )}
                              </HStack>
                              <Input
                                type="file"
                                accept="image/*"
                                hidden
                                ref={fileInputRefs.shipmentProof}
                                onChange={(e) => handleImageSelect('shipmentProof', e.target.files[0])}
                              />
                            </Box>
                          </VStack>
                        </TabPanel>
                        {/* Tab QR Code */}
                        <TabPanel>
                          <VStack spacing={4} align="stretch">
                            <Heading size="sm">QR Code untuk Pengambilan</Heading>
                            <Text fontSize="sm" color="gray.500">Tunjukkan QR code ini saat mengambil pesanan di outlet.</Text>
                            
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
                                      // Logo dihapus untuk menghindari 404 error
                                      // Jika ingin menggunakan logo, gunakan path relatif seperti '/src/assets/react.svg'
                                    />
                                    <Text pt={2} fontSize="sm" fontWeight="bold">Order #{order.id}</Text>
                                  </VStack>
                                ) : (
                                  <Text>Order ID tidak tersedia.</Text>
                                )}
                              </Box>
                            </Flex>
                            
                            <Button
                              onClick={() => {
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
                              }}
                            >
                              Download QR Code
                            </Button>
                            <Button
                              variant="outline"
                              colorScheme="blue"
                              onClick={() => {
                                if (order && order.id) {
                                  const publicUrl = `https://tagihan.kurniasari.co.id/orders/${order.id}`;
                                  // Salin link ke clipboard
                                  navigator.clipboard.writeText(publicUrl)
                                    .then(() => {
                                      toast({
                                        title: "Link berhasil disalin",
                                        description: "Link status pesanan konsumen telah disalin ke clipboard",
                                        status: "success",
                                        duration: 2000,
                                        isClosable: true,
                                      });
                                    })
                                    .catch(err => {
                                      console.error('Gagal menyalin link:', err);
                                      toast({
                                        title: "Gagal menyalin link",
                                        description: "Terjadi kesalahan saat menyalin link ke clipboard",
                                        status: "error",
                                        duration: 3000,
                                        isClosable: true,
                                      });
                                    });
                                } else {
                                  toast({
                                    title: "Gagal menyalin link",
                                    description: "Data pesanan belum siap.",
                                    status: "error",
                                    duration: 3000,
                                    isClosable: true,
                                  });
                                }
                              }}
                            >
                              Salin Link Status Pesanan Konsumen
                            </Button>
                          </VStack>
                        </TabPanel>
                      </TabPanels>
                    </Tabs>
                  </AccordionPanel>
                </AccordionItem>
              </Accordion>
            </CardHeader>
          </Card>
          )}
        </GridItem>

        {/* Admin action panel */}
        <GridItem>
          <Card>
            <CardHeader>
              <Heading size="md">Aksi Admin</Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={4} align="stretch">
                <FormControl id="shipping_status" isRequired>
                  <FormLabel>Status Pengiriman</FormLabel>
                  <Select 
                    value={shippingStatus} 
                    onChange={(e) => {
                      setShippingStatus(e.target.value);
                      setFormChanged(true);
                    }}
                    placeholder="Pilih status"
                  >
                    {getShippingStatusOptions().map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>Area Pengiriman</FormLabel>
                  <Select 
                    value={shippingArea} 
                    onChange={(e) => {
                      const newValue = e.target.value;
                      console.log('DEBUG - Changing shipping area from', shippingArea, 'to', newValue);
                      setShippingArea(newValue);
                      setFormChanged(true);
                      // Atur tab aktif berdasarkan area pengiriman
                      if (newValue === 'dalam-kota') {
                        setTabIndex(0); // Tab Dalam Kota
                        // Reset state jika sebelumnya luar kota
                        setCourierService('');
                        setTrackingNumber('');
                        setTrackingNumberError('');
                      } else if (newValue === 'luar-kota') {
                        setTabIndex(1); // Tab Luar Kota
                        // Reset state tipe pesanan untuk luar kota
                        setPickupMethod(''); // Nonaktifkan Pesan Ambil
                        setMetodePengiriman(''); // Reset Metode Kirim
                      }
                    }}
                  >
                    <option value="dalam-kota">Dalam Kota</option>
                    <option value="luar-kota">Luar Kota</option>
                  </Select>
                </FormControl>
                
                {/* Tipe Pesanan selection - hanya tampil jika area pengiriman Dalam Kota */}
                {shippingArea === 'dalam-kota' && (
                  <FormControl mt={4}>
                    <FormLabel>Tipe Pesanan</FormLabel>
                    <Select
                      value={tipe_pesanan}
                      onChange={(e) => {
                        setTipePesanan(e.target.value);
                        setFormChanged(true);
                      }}
                    >
                      <option value="">Pilih Tipe Pesanan</option>
                      <option value="Pesan Antar">Pesan Antar</option>
                      <option value="Pesan Ambil">Pesan Ambil</option>
                    </Select>
                  </FormControl>
                )}
                
                {/* Metode dinamis berdasarkan tipe pesanan - tidak ditampilkan untuk Luar Kota */}
                {tipe_pesanan && shippingArea !== 'luar-kota' && (
                  <FormControl mt={4}>
                    <FormLabel>{tipe_pesanan === 'Pesan Ambil' ? 'Metode Ambil' : 'Metode Antar'}</FormLabel>
                    <Select
                      placeholder={`Pilih ${tipe_pesanan === 'Pesan Ambil' ? 'Metode Ambil' : 'Metode Antar'}`}
                      value={pickupMethod}
                      onChange={(e) => {
                        setPickupMethod(e.target.value);
                        setFormChanged(true);
                      }}
                    >
                      {tipe_pesanan === 'Pesan Ambil' ? (
                        <>
                          <option value="deliveryman">Di Ambil Konsumen</option>
                          <option value="ojek-online">Di Ambil Driver Ojek Online</option>
                        </>
                      ) : (
                        <>
                          <option value="deliveryman">Di Antar Deliveryman</option>
                          <option value="ojek-online">Di Antar Driver Ojek Online</option>
                        </>
                      )}
                    </Select>
                  </FormControl>
                )}
                
                {/* Lokasi Pengiriman selection - shown when tipe_pesanan is "Pesan Antar" AND shipping area is not 'luar-kota' */}
                {tipe_pesanan === 'Pesan Antar' && shippingArea !== 'luar-kota' && (
                  <FormControl mt={4}>
                    <FormLabel>Lokasi Pengiriman</FormLabel>
                    <Select
                      placeholder="Pilih Lokasi Pengiriman"
                      value={lokasi_pengiriman}
                      onChange={(e) => {
                        setLokasiPengiriman(e.target.value);
                        setFormChanged(true);
                      }}
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.nama_lokasi}>
                          {loc.nama_lokasi}
                        </option>
                      ))}
                    </Select>
                    {locations.length === 0 && <Text mt={2} color="red.500">Tidak ada data lokasi</Text>}
                  </FormControl>
                )}
                
                {/* Lokasi Pengambilan selection - shown when tipe_pesanan is "Pesan Ambil" and area is Dalam Kota */}
                {tipe_pesanan === 'Pesan Ambil' && shippingArea === 'dalam-kota' && (
                  <FormControl mt={4}>
                    <FormLabel>Lokasi Pengambilan</FormLabel>
                    <Select
                      placeholder="Pilih Lokasi Pengambilan"
                      value={lokasi_pengambilan}
                      onChange={(e) => {
                        setLokasiPengambilan(e.target.value);
                        setFormChanged(true);
                      }}
                    >
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.nama_lokasi}>
                          {loc.nama_lokasi}
                        </option>
                      ))}
                    </Select>
                    {locations.length === 0 && <Text mt={2} color="red.500">Tidak ada data lokasi</Text>}
                  </FormControl>
                )}
                
                {/* UI Tipe Pesanan telah dihapus karena sudah ada di dropdown */}
                
                {/* UI Tipe Pesanan untuk Luar Kota - hanya menampilkan Pesan Kirim */}
                {shippingArea === 'luar-kota' && (
                  <Box mt={4}>
                    <Heading as="h3" size="md" mb={3}>Tipe Pesanan</Heading>
                    <Box
                      p={4}
                      borderWidth="1px"
                      borderRadius="lg"
                      borderColor="green.500"
                      bg="green.50"
                      width="100%"
                    >
                      <HStack spacing={3}>
                        <Box boxSize="30px">
                          <Box as="span" fontSize="24px">🚚</Box>
                        </Box>
                        <Box>
                          <Text fontWeight="bold">Pesan Kirim (Luar Kota)</Text>
                          <Text fontSize="sm" color="gray.600">Kirim ke alamat</Text>
                        </Box>
                      </HStack>
                    </Box>
                  </Box>
              )}
              
              {/* Metode Kirim - hanya muncul jika Pesan Kirim aktif, Pesan Ambil tidak aktif, dan tidak di luar kota */}
              {metodePengiriman !== '' && pickupMethod === '' && shippingArea !== 'luar-kota' && (
                <FormControl mt={4}>
                  <FormLabel>Metode Kirim</FormLabel>
                  <Select
                    value={metodePengiriman}
                    onChange={(e) => {
                      setMetodePengiriman(e.target.value);
                      setFormChanged(true);
                    }}
                    placeholder="Pilih metode pengiriman"
                  >
                    <option value="ojek-online">Ojek Online</option>
                    <option value="team-delivery">Team Delivery</option>
                  </Select>
                </FormControl>
              )}
                
              {shippingArea === 'luar-kota' && (
                <>
                  <FormControl>
                    <FormLabel>Jasa Kurir</FormLabel>
                    <HStack spacing={4}>
                      <Checkbox 
                        isChecked={courierService === 'TIKI'}
                        onChange={(e) => {
                          const newService = e.target.checked ? 'TIKI' : '';
                          setCourierService(newService);
                          setFormChanged(true);
                          
                          // Reset error ketika layanan berubah
                          if (trackingNumber) {
                            if (newService === 'TIKI' && (trackingNumber.length < 10 || trackingNumber.length > 16)) {
                              setTrackingNumberError('Nomor resi TIKI harus 10-16 digit');
                            } else if (newService === 'JNE' && trackingNumber.length !== 16) {
                              setTrackingNumberError('Nomor resi JNE harus 16 karakter');
                            } else {
                              setTrackingNumberError('');
                            }
                          }
                        }}
                      >
                        TIKI (10-16 digit)
                      </Checkbox>
                      <Checkbox 
                        isChecked={courierService === 'JNE'}
                        onChange={(e) => {
                          const newService = e.target.checked ? 'JNE' : '';
                          setCourierService(newService);
                          setFormChanged(true);
                          
                          // Reset error ketika layanan berubah
                          if (trackingNumber) {
                            if (newService === 'TIKI' && (trackingNumber.length < 10 || trackingNumber.length > 16)) {
                              setTrackingNumberError('Nomor resi TIKI harus 10-16 digit');
                            } else if (newService === 'JNE' && trackingNumber.length !== 16) {
                              setTrackingNumberError('Nomor resi JNE harus 16 karakter');
                            } else {
                              setTrackingNumberError('');
                            }
                          }
                        }}
                      >
                        JNE (16-20 karakter alphanumeric)
                      </Checkbox>
                      <Checkbox 
                        isChecked={courierService === 'TRAVEL'}
                        onChange={(e) => {
                          const newService = e.target.checked ? 'TRAVEL' : '';
                          setCourierService(newService);
                          setFormChanged(true);
                          
                          // Reset tracking number dan error jika Travel dipilih
                          if (newService === 'TRAVEL') {
                            setTrackingNumber(''); // Kosongkan nomor resi
                            setTrackingNumberError('');
                          }
                        }}
                      >
                        Travel
                      </Checkbox>
                    </HStack>
                  </FormControl>

                  {/* Tampilkan input Nomor Resi hanya jika TRAVEL tidak dipilih */}
                  {courierService !== 'TRAVEL' && (
                    <FormControl isInvalid={trackingNumberError !== ''}>
                      <FormLabel>Nomor Resi</FormLabel>
                      <Input
                        value={trackingNumber}
                        onChange={(e) => {
                          const value = e.target.value;
                          setTrackingNumber(value);
                          setFormChanged(true);
                          
                          // Validasi karakter untuk TIKI
                          if (courierService === 'TIKI' && value && !/^\d*$/.test(value)) {
                            setTrackingNumberError('Nomor resi TIKI hanya boleh berisi angka');
                            return;
                          }
                          
                          // Validasi karakter alphanumeric untuk JNE
                          if (courierService === 'JNE' && value && !/^[a-zA-Z0-9]*$/.test(value)) {
                            setTrackingNumberError('Nomor resi JNE hanya boleh berisi huruf dan angka');
                            return;
                          }
                          
                          // Validasi panjang berdasarkan jasa kurir
                          if (courierService === 'TIKI' && value && (value.length < 10 || value.length > 16)) {
                            setTrackingNumberError('Nomor resi TIKI harus 10-16 digit');
                          } else if (courierService === 'JNE' && value && (value.length < 16 || value.length > 20)) {
                            setTrackingNumberError('Nomor resi JNE harus 16-20 karakter');
                          } else {
                            setTrackingNumberError('');
                          }
                        }}
                        placeholder="Masukkan nomor resi"
                      />
                      {trackingNumberError && (
                        <FormErrorMessage>{trackingNumberError}</FormErrorMessage>
                      )}
                    </FormControl>
                  )}
                  
                  <FormControl>
                      <FormLabel>Catatan Admin</FormLabel>
                      {isEditingNote ? (
                        <>
                          <Textarea 
                            value={adminNote}
                            onChange={e => {
                              setAdminNote(e.target.value);
                              setFormChanged(true);
                            }}
                            placeholder="Tambahkan catatan terkait pesanan (opsional)"
                          />
                          <HStack mt={2} spacing={2}>
                            <Button 
                              colorScheme="green" 
                              onClick={handleSaveNote}
                              isLoading={isSavingNote}
                              size="sm"
                            >
                              Simpan Catatan
                            </Button>
                            <Button 
                              onClick={handleCancelEdit}
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
                  </>
                )}

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
        </GridItem>
      </SimpleGrid>

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
            <Button variant="ghost" onClick={onClose} isDisabled={isDeleting}>Batal</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

export default AdminOrderDetailPage;
