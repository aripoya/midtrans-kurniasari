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

  useEffect(() => {
    fetchOrder();
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
  
  // Fungsi untuk menyimpan semua foto ke backend
  const handleSaveImages = async () => {
    setIsUploading(true);
    
    try {
      // Cek apakah ada foto yang perlu diupload
      const imageTypes = ['readyForPickup', 'pickedUp', 'received'];
      const apiTypeMap = {
        readyForPickup: 'ready_for_pickup',
        pickedUp: 'picked_up',
        received: 'delivered'
      };
      
      // Array untuk menampung semua promise upload
      const uploadPromises = [];
      
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
        if (uploadedImages[type]) {
          // Cek apakah gambar sudah dalam format base64 (hasil dari FileReader)
          if (uploadedImages[type].startsWith('data:')) {
            const file = dataURLtoFile(
              uploadedImages[type], 
              `${type}_${new Date().getTime()}.jpg`
            );
            
            uploadPromises.push(
              adminApi.uploadShippingImage(id, apiTypeMap[type], file)
            );
          }
        }
      }
      
      // Jika tidak ada foto yang perlu diupload
      if (uploadPromises.length === 0) {
        toast({
          title: "Tidak ada foto untuk disimpan",
          status: "info",
          duration: 3000,
          isClosable: true,
        });
        setIsUploading(false);
        return;
      }
      
      // Jalankan semua upload secara paralel
      const results = await Promise.all(uploadPromises);
      
      // Cek hasil upload
      const failedUploads = results.filter(r => !r.success);
      
      if (failedUploads.length > 0) {
        throw new Error(`${failedUploads.length} foto gagal diupload`);
      }
      
      // Berhasil upload semua foto
      toast({
        title: "Foto berhasil disimpan",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      
      // Refresh data order untuk mendapatkan URL gambar dari backend
      fetchOrder();
      
    } catch (error) {
      console.error('Error saving images:', error);
      toast({
        title: "Gagal menyimpan foto",
        description: error.message,
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
                              {uploadedImages.readyForPickup ? (
                                <Box position="relative">
                                  <Image 
                                    src={uploadedImages.readyForPickup} 
                                    alt="Siap Ambil" 
                                    maxH="200px"
                                    borderRadius="md" 
                                  />
                                  <Button 
                                    size="xs" 
                                    colorScheme="red" 
                                    position="absolute" 
                                    top="2" 
                                    right="2"
                                    onClick={() => {
                                      setUploadedImages(prev => ({
                                        ...prev,
                                        readyForPickup: null
                                      }));
                                    }}
                                  >
                                    Hapus
                                  </Button>
                                </Box>
                              ) : (
                                <Button 
                                  onClick={() => fileInputRefs.readyForPickup.current.click()}
                                  isLoading={isUploading}
                                >
                                  Upload Foto
                                </Button>
                              )}
                              <Input 
                                type="file" 
                                accept="image/*" 
                                hidden 
                                ref={fileInputRefs.readyForPickup} 
                                onChange={(e) => handleImageUpload(e, 'readyForPickup')}
                              />
                            </Box>
                            
                            {/* Foto Sudah Diambil */}
                            <Box borderWidth="1px" borderRadius="lg" p={4}>
                              <Heading size="sm" mb={2}>Sudah Diambil</Heading>
                              {uploadedImages.pickedUp ? (
                                <Box position="relative">
                                  <Image 
                                    src={uploadedImages.pickedUp} 
                                    alt="Sudah Diambil" 
                                    maxH="200px"
                                    borderRadius="md" 
                                  />
                                  <Button 
                                    size="xs" 
                                    colorScheme="red" 
                                    position="absolute" 
                                    top="2" 
                                    right="2"
                                    onClick={() => {
                                      setUploadedImages(prev => ({
                                        ...prev,
                                        pickedUp: null
                                      }));
                                    }}
                                  >
                                    Hapus
                                  </Button>
                                </Box>
                              ) : (
                                <Button 
                                  onClick={() => fileInputRefs.pickedUp.current.click()}
                                  isLoading={isUploading}
                                >
                                  Upload Foto
                                </Button>
                              )}
                              <Input 
                                type="file" 
                                accept="image/*" 
                                hidden 
                                ref={fileInputRefs.pickedUp} 
                                onChange={(e) => handleImageUpload(e, 'pickedUp')}
                              />
                            </Box>
                            
                            {/* Foto Sudah Diterima */}
                            <Box borderWidth="1px" borderRadius="lg" p={4}>
                              <Heading size="sm" mb={2}>Sudah Diterima</Heading>
                              {uploadedImages.received ? (
                                <Box position="relative">
                                  <Image 
                                    src={uploadedImages.received} 
                                    alt="Sudah Diterima" 
                                    maxH="200px"
                                    borderRadius="md" 
                                  />
                                  <Button 
                                    size="xs" 
                                    colorScheme="red" 
                                    position="absolute" 
                                    top="2" 
                                    right="2"
                                    onClick={() => {
                                      setUploadedImages(prev => ({
                                        ...prev,
                                        received: null
                                      }));
                                    }}
                                  >
                                    Hapus
                                  </Button>
                                </Box>
                              ) : (
                                <Button 
                                  onClick={() => fileInputRefs.received.current.click()}
                                  isLoading={isUploading}
                                >
                                  Upload Foto
                                </Button>
                              )}
                              <Input 
                                type="file" 
                                accept="image/*" 
                                hidden 
                                ref={fileInputRefs.received} 
                                onChange={(e) => handleImageUpload(e, 'received')}
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
                            <Box p={4} borderWidth="1px" borderRadius="lg" bg="white">
                              <QRCodeSVG 
                                value={`https://tagihan.kurniasari.co.id/admin/orders/${order.id}`} 
                                size={200}
                                includeMargin={true}
                                level="H"
                              />
                            </Box>
                            <Text fontSize="sm">URL: https://tagihan.kurniasari.co.id/admin/orders/{order.id}</Text>
                            <Button colorScheme="blue" onClick={() => window.print()}>
                              Cetak QR Code
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
