import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Heading, Text, VStack, HStack, Badge, Button,
  Table, Tbody, Tr, Td, Th, Thead, Divider, Spinner,
  Alert, AlertIcon, Card, CardBody, CardHeader, CardFooter,
  useToast, Flex, Grid, GridItem, Select, FormControl, 
  FormLabel, Textarea, SimpleGrid, Stack, Tag, Image,
  useDisclosure, Modal, ModalOverlay, ModalContent,
  ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
  Accordion, AccordionItem, AccordionButton, 
  AccordionPanel, AccordionIcon, Input, IconButton,
  Tabs, TabList, TabPanels, Tab, TabPanel
} from '@chakra-ui/react';
import { QRCodeSVG } from 'qrcode.react';
import { orderService } from '../../api/orderService';
import { refreshOrderStatus } from '../../api/api';
import { adminApi } from '../../api/adminApi';
import html2canvas from 'html2canvas';

function AdminOrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shippingStatus, setShippingStatus] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [savedAdminNote, setSavedAdminNote] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isDeletingNote, setIsDeletingNote] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState({
    readyForPickup: null,
    pickedUp: null,
    received: null
  });
  const [showQRCode, setShowQRCode] = useState(false);
  const fileInputRefs = {
    readyForPickup: useRef(null),
    pickedUp: useRef(null),
    received: useRef(null)
  };
  const qrCodeRef = useRef(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const navigate = useNavigate();

  const fetchOrder = async () => {
    try {
      console.log('[AdminOrderDetailPage] Fetching order:', id);
      setLoading(true);
      setError(null);
      const data = await orderService.getOrderById(id);
      console.log('[AdminOrderDetailPage] API response:', data);
      
      if (data.success && data.order) {
        let finalOrder = data.order;
        console.log('[AdminOrderDetailPage] Original order data:', finalOrder);
        
        if (finalOrder.payment_response) {
          try {
            const paymentDetails = JSON.parse(finalOrder.payment_response);
            finalOrder = {
              ...finalOrder,
              payment_method: paymentDetails.payment_type || finalOrder.payment_method,
              payment_time: paymentDetails.settlement_time || finalOrder.payment_time,
              status: paymentDetails.transaction_status || finalOrder.status,
            };
            console.log('[AdminOrderDetailPage] Enhanced order with payment details:', finalOrder);
          } catch (e) {
            console.error("Failed to parse payment_response:", e);
          }
        }
        setOrder(finalOrder);
        setShippingStatus(finalOrder.shipping_status || '');
      // Cek jika ada catatan admin yang tersimpan
      if (finalOrder.admin_note) {
        setSavedAdminNote(finalOrder.admin_note);
        setAdminNote(finalOrder.admin_note);
      }
      } else {
        console.error('[AdminOrderDetailPage] Order not found or API returned error');
        setError(`Pesanan tidak ditemukan.`);
      }
    } catch (err) {
      console.error('[AdminOrderDetailPage] Error fetching order:', err);
      setError(`Gagal memuat detail pesanan: ${err.message}.`);
    } finally {
      setLoading(false);
    }
  };

  // Fungsi untuk mengubah URL dari domain lama ke domain baru
  const transformURL = (url) => {
    if (!url) return null;
    
    // Ubah domain lama ke domain baru
    if (url.includes('kurniasari-shipping-images.kurniasari.co.id')) {
      const fileName = url.split('/').pop().split('?')[0]; // Ambil nama file saja, hapus query params
      return `https://proses.kurniasari.co.id/${fileName}?t=${Date.now()}`;
    }
    
    // Jika sudah menggunakan domain baru, pastikan ada cache busting
    if (url.includes('proses.kurniasari.co.id') && !url.includes('?t=')) {
      return `${url}?t=${Date.now()}`;
    }
    
    return url;
  };
  
  // Fungsi untuk mengambil data gambar pengiriman
  const fetchShippingImages = async (orderId) => {
    try {
      console.log('[DEBUG-SHIPPING] Fetching shipping images for order:', orderId);
      const result = await adminApi.getShippingImages(orderId);
      console.log('[DEBUG-SHIPPING] API response:', result);
      
      if (result.success && result.data) {
        console.log('[DEBUG-SHIPPING] Shipping images found:', result.data.length);
        console.log('[DEBUG-SHIPPING] Raw image data:', JSON.stringify(result.data));
        
        // Reset state uploadedImages
        const newImages = {
          readyForPickup: null,
          pickedUp: null,
          received: null
        };
        
        // Map hasil API ke state uploadedImages
        result.data.forEach(image => {
          console.log('[DEBUG-SHIPPING] Processing image:', image);
          switch(image.image_type) {
            case 'ready_for_pickup':
              console.log('[DEBUG-SHIPPING] Setting readyForPickup image URL:', image.image_url);
              // Transform URL & tambahkan cache busting
              newImages.readyForPickup = transformURL(image.image_url);
              break;
            case 'picked_up':
              console.log('[DEBUG-SHIPPING] Setting pickedUp image URL:', image.image_url);
              // Transform URL & tambahkan cache busting
              newImages.pickedUp = transformURL(image.image_url);
              break;
            case 'delivered':
              console.log('[DEBUG-SHIPPING] Setting received image URL:', image.image_url);
              // Transform URL & tambahkan cache busting
              newImages.received = transformURL(image.image_url);
              break;
            default:
              console.log('[DEBUG-SHIPPING] Unknown image type:', image.image_type);
          }
        });
        
        console.log('[DEBUG-SHIPPING] Final images state to set:', newImages);
        
        // Update state dengan data baru (force update dengan setState function)
        setUploadedImages(current => {
          const updatedImages = {...newImages};
          // Simpan ke localStorage untuk persistensi
          try {
            localStorage.setItem(`shipping_images_${orderId}`, JSON.stringify(updatedImages));
            console.log('[DEBUG-SHIPPING] Saved images to localStorage');
          } catch (storageErr) {
            console.error('[DEBUG-SHIPPING] Failed to save to localStorage:', storageErr);
          }
          return updatedImages;
        });
        
        // Debug untuk memverifikasi state setelah update
        setTimeout(() => {
          console.log('[DEBUG-SHIPPING] Verifying state after update:', uploadedImages);
        }, 100);
      } else {
        console.log('[DEBUG-SHIPPING] No shipping images found or API error:', result);
        
        // Cek jika ada data tersimpan di localStorage
        try {
          const savedImages = localStorage.getItem(`shipping_images_${orderId}`);
          if (savedImages) {
            const parsedImages = JSON.parse(savedImages);
            console.log('[DEBUG-SHIPPING] Found saved images in localStorage:', parsedImages);
            setUploadedImages(parsedImages);
          }
        } catch (storageErr) {
          console.error('[DEBUG-SHIPPING] Failed to retrieve from localStorage:', storageErr);
        }
      }
    } catch (err) {
      console.error('[DEBUG-SHIPPING] Error fetching shipping images:', err);
      
      // Cek jika ada data tersimpan di localStorage
      try {
        const savedImages = localStorage.getItem(`shipping_images_${orderId}`);
        if (savedImages) {
          const parsedImages = JSON.parse(savedImages);
          console.log('[DEBUG-SHIPPING] Found saved images in localStorage after API error:', parsedImages);
          setUploadedImages(parsedImages);
        }
      } catch (storageErr) {
        console.error('[DEBUG-SHIPPING] Failed to retrieve from localStorage:', storageErr);
      }
    }
  };

  useEffect(() => {
    fetchOrder();
    if (id) {
      // Cek dahulu jika ada data di localStorage
      try {
        const savedImages = localStorage.getItem(`shipping_images_${id}`);
        if (savedImages) {
          const parsedImages = JSON.parse(savedImages);
          console.log('[DEBUG-SHIPPING] Loading initial images from localStorage:', parsedImages);
          setUploadedImages(parsedImages);
        }
      } catch (err) {
        console.error('[DEBUG-SHIPPING] Error loading from localStorage:', err);
      }
      
      // Kemudian ambil data terbaru dari API
      fetchShippingImages(id);
    }
  }, [id]);

  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    try {
      const { data } = await refreshOrderStatus(id);
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

  // Function for updating shipping status using adminApi
  const handleUpdateStatus = async () => {
    setIsUpdating(true);
    try {
      const response = await adminApi.updateOrderStatus(id, shippingStatus, adminNote);
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Update local state
      setOrder(prev => ({
        ...prev,
        shipping_status: shippingStatus
      }));
      
      // Update saved admin note
      setSavedAdminNote(adminNote);
      
      toast({
        title: "Status pesanan diperbarui",
        description: `Status berhasil diubah menjadi: ${shippingStatus}`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      toast({
        title: "Gagal memperbarui status",
        description: err.message,
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
  
  // Fungsi untuk menangani upload gambar
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
    
    // Konversi type ke format yang digunakan API
    const imageTypeMap = {
      readyForPickup: 'ready_for_pickup',
      pickedUp: 'picked_up',
      received: 'delivered'
    };
    
    // Tampilkan preview gambar
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImages(prev => ({
        ...prev,
        [type]: e.target.result
      }));
    };
    reader.readAsDataURL(file);
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
      
      // Jika tidak ada foto yang perlu diupload
      if (uploadPromises.length === 0) {
        console.log('[DEBUG-UPLOAD] No new images to upload');
        toast({
          title: "Tidak ada foto baru untuk disimpan",
          description: "Tidak ada perubahan yang perlu disimpan",
          status: "info",
          duration: 3000,
          isClosable: true,
        });
        setIsUploading(false);
        return;
      }
      
      // Upload semua gambar sekaligus
      console.log(`[DEBUG-UPLOAD] Uploading ${uploadPromises.length} images...`);
      const results = await Promise.all(uploadPromises);
      console.log('[DEBUG-UPLOAD] Upload results:', results);
      
      // Periksa hasil upload
      const failedUploads = results.filter(result => !result.success);
      
      if (failedUploads.length > 0) {
        throw new Error(`Gagal mengupload ${failedUploads.length} gambar`);
      }
      
      // Update URL gambar setelah upload berhasil
      const updatedImages = {...uploadedImages}; // Clone state saat ini
      
      for (let i = 0; i < results.length; i++) {
        const { success, image_url } = results[i];
        const { type } = uploadDetails[i];
        
        if (success && image_url) {
          console.log(`[DEBUG-UPLOAD] Setting new URL for ${type}:`, image_url);
          // Tambahkan cache busting ke URL
          const imageUrlWithCacheBusting = `${image_url}?t=${Date.now()}`;
          updatedImages[type] = imageUrlWithCacheBusting;
        }
      }
      
      // Update state sekali dengan semua perubahan
      setUploadedImages(updatedImages);
      
      // Simpan ke localStorage untuk persistensi
      try {
        localStorage.setItem(`shipping_images_${id}`, JSON.stringify(updatedImages));
        console.log('[DEBUG-UPLOAD] Saved updated images to localStorage after upload');
      } catch (storageErr) {
        console.error('[DEBUG-UPLOAD] Failed to save to localStorage:', storageErr);
      }
      
      // Segera ambil ulang data gambar dari API setelah upload berhasil
      await fetchShippingImages(id);
      
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
        title: "Catatan berhasil dihapus",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      toast({
        title: "Gagal menghapus catatan",
        description: err.message,
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
    const statusMap = {
      "dikemas": { color: "blue", text: "Dikemas" },
      "siap kirim": { color: "purple", text: "Siap Kirim" },
      "dikirim": { color: "orange", text: "Dikirim" },
      "sedang dikirim": { color: "orange", text: "Sedang Dikirim" },
      "received": { color: "green", text: "Diterima" },
    };

    const statusInfo = statusMap[status?.toLowerCase()] || { color: "gray", text: status || "Menunggu Diproses" };
    
    return <Badge colorScheme={statusInfo.color}>{statusInfo.text}</Badge>;
  };

  // Handler untuk memilih gambar
  const handleImageSelect = (type, file) => {
    if (!file) {
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
    
    // Tampilkan preview gambar
    const reader = new FileReader();
    reader.onload = (e) => {
      // Update state secara atomic dan simpan ke localStorage
      setUploadedImages(prev => {
        const newState = {
          ...prev,
          [type]: e.target.result
        };
        
        // Simpan ke localStorage sementara (untuk preview)
        try {
          localStorage.setItem(`shipping_images_${id}`, JSON.stringify(newState));
          console.log(`[DEBUG-IMAGE] Saved preview image for ${type} to localStorage`);
        } catch (err) {
          console.error('[DEBUG-IMAGE] Failed to save preview to localStorage:', err);
        }
        
        return newState;
      });
    };
    reader.readAsDataURL(file);
  };

  // Fungsi untuk menampilkan gambar yang diupload
  const renderUploadedImage = (type) => {
    if (!uploadedImages[type]) return null;
    
    // Tambahkan key dengan timestamp untuk memaksa re-render komponen Image
    // saat URL berubah (bahkan jika base URL sama)
    const imageKey = `${type}-${Date.now()}`;
    const imageUrl = uploadedImages[type];
    
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
    <Alert status="warning">
      <AlertIcon />
      {error || "Pesanan tidak ditemukan."}
    </Alert>
  );
}

const isPaid = ['paid', 'settlement', 'capture'].includes(order.payment_status);

return (
  <Box p={4} maxW="1200px" mx="auto">
    <HStack mb={6} justify="space-between">
      <Heading size="lg">
        Detail Pesanan #{order.id.substring(0, 8)}
      </Heading>
      <Button 
        as={RouterLink} 
        to="/admin/orders" 
        variant="outline"
      >
        Kembali ke Daftar
      </Button>
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
                <HStack mt={2}>
                  <Text><strong>Status Pembayaran:</strong></Text>
                  {getPaymentStatusBadge(order.payment_status)}
                </HStack>
                <HStack mt={2}>
                  <Text><strong>Status Pengiriman:</strong></Text>
                  {getShippingStatusBadge(order.shipping_status)}
                </HStack>
                <Text mt={2}><strong>Metode:</strong> <Tag>{order.payment_method || 'N/A'}</Tag></Text>
                {order.payment_time && (
                  <Text><strong>Waktu Pembayaran:</strong> {order.payment_time ? `${new Date(order.payment_time).getDate().toString().padStart(2, '0')}-${(new Date(order.payment_time).getMonth() + 1).toString().padStart(2, '0')}-${new Date(order.payment_time).getFullYear()}` : '-'}</Text>
                )}
                <Text><strong>Dibuat:</strong> {order.created_at ? `${new Date(order.created_at).getDate().toString().padStart(2, '0')}-${(new Date(order.created_at).getMonth() + 1).toString().padStart(2, '0')}-${new Date(order.created_at).getFullYear()}` : '-'}</Text>
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
                    <Tabs variant="enclosed">
                      <TabList>
                        <Tab>Status Foto</Tab>
                        <Tab>QR Code Pengambilan</Tab>
                      </TabList>
                      <TabPanels>
                        <TabPanel>
                          <VStack spacing={4} align="stretch">
                            {/* Foto Siap Ambil */}
                            <Box borderWidth="1px" borderRadius="lg" p={4}>
                              <Heading size="sm" mb={2}>Siap Ambil</Heading>
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
                                  <Button 
                                    size="sm" 
                                    colorScheme="red" 
                                    onClick={() => {
                                      setUploadedImages(prev => ({
                                        ...prev,
                                        readyForPickup: null
                                      }));
                                    }}
                                  >
                                    Hapus
                                  </Button>
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
                              <Heading size="sm" mb={2}>Sudah Diambil</Heading>
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
                                  <Button 
                                    size="sm" 
                                    colorScheme="red" 
                                    onClick={() => {
                                      setUploadedImages(prev => ({
                                        ...prev,
                                        pickedUp: null
                                      }));
                                    }}
                                  >
                                    Hapus
                                  </Button>
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
                              <Heading size="sm" mb={2}>Sudah Diterima</Heading>
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
                                  <Button 
                                    size="sm" 
                                    colorScheme="red" 
                                    onClick={() => {
                                      setUploadedImages(prev => ({
                                        ...prev,
                                        received: null
                                      }));
                                    }}
                                  >
                                    Hapus
                                  </Button>
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
                            
                            <Button 
                              colorScheme="blue" 
                              onClick={handleSaveImages}
                              isLoading={isUploading}
                            >
                              Simpan Semua Foto
                            </Button>
                          </VStack>
                        </TabPanel>
                        <TabPanel>
                          <VStack spacing={4} align="center">
                            <Heading size="sm">QR Code Pengambilan</Heading>
                            <Box id="qr-code-container" p={4} borderWidth="1px" borderRadius="lg" bg="white">
                              <QRCodeSVG 
                                value={`https://tagihan.kurniasari.co.id/admin/orders/${order.id}`} 
                                size={200}
                                includeMargin={true}
                                level="H"
                                ref={qrCodeRef}
                              />
                            </Box>
                            <Text fontSize="sm">URL: https://tagihan.kurniasari.co.id/admin/orders/{order.id}</Text>
                            <Button colorScheme="blue" onClick={() => {
                              try {
                                // Gunakan element QR code container untuk screenshot
                                const qrCodeContainer = document.getElementById('qr-code-container');
                                if (!qrCodeContainer) {
                                  toast({
                                    title: "Gagal mengunduh QR Code",
                                    description: "QR Code tidak tersedia",
                                    status: "error",
                                    duration: 3000,
                                    isClosable: true
                                  });
                                  return;
                                }
                                
                                // Gunakan html2canvas untuk mengambil screenshot elemen
                                html2canvas(qrCodeContainer, {
                                  backgroundColor: "#ffffff",
                                  scale: 2, // Scale untuk kualitas lebih baik
                                  logging: false
                                }).then(canvas => {
                                  try {
                                    // Konversi canvas ke URL dan download
                                    const link = document.createElement('a');
                                    link.download = `QR-${order.id}.png`;
                                    link.href = canvas.toDataURL('image/png');
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    
                                    toast({
                                      title: "QR Code berhasil diunduh",
                                      status: "success",
                                      duration: 2000,
                                      isClosable: true
                                    });
                                  } catch (downloadErr) {
                                    console.error('Error downloading QR code:', downloadErr);
                                    toast({
                                      title: "Gagal mengunduh QR Code",
                                      description: downloadErr.message,
                                      status: "error",
                                      duration: 3000,
                                      isClosable: true
                                    });
                                  }
                                }).catch(err => {
                                  console.error('Error capturing QR code with html2canvas:', err);
                                  toast({
                                    title: "Gagal mengambil gambar QR Code",
                                    description: err.message,
                                    status: "error",
                                    duration: 3000,
                                    isClosable: true
                                  });
                                });
                              } catch (err) {
                                console.error('Error creating QR code download:', err);
                                toast({
                                  title: "Gagal mengunduh QR Code",
                                  description: err.message,
                                  status: "error",
                                  duration: 3000,
                                  isClosable: true
                                });
                              }
                            }}>
                              Download QR Code
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
                <FormControl>
                  <FormLabel>Status Pengiriman</FormLabel>
                  <Select 
                    value={shippingStatus} 
                    onChange={e => setShippingStatus(e.target.value)}
                  >
                    <option value="">Menunggu Diproses</option>
                    <option value="dikemas">Dikemas</option>
                    <option value="siap kirim">Siap Kirim</option>
                    <option value="sedang dikirim">Dalam Pengiriman</option>
                    <option value="received">Diterima</option>
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>Catatan Admin</FormLabel>
                  {isEditingNote ? (
                    <>
                      <Textarea 
                        value={adminNote}
                        onChange={e => setAdminNote(e.target.value)}
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

                <Button 
                  colorScheme="blue" 
                  onClick={handleUpdateStatus}
                  isLoading={isUpdating}
                  isDisabled={order.shipping_status === shippingStatus}
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
