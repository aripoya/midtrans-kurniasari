import React, { useState, useEffect } from 'react';
import type { 
  Order, 
  OrderStats,
  ApiResponse,
  ShippingStatus
} from '../../types/index';
// import { Link as RouterLink } from 'react-router-dom'; // Commented out until needed
import {
  Box, 
  Container, 
  Heading, 
  Text, 
  SimpleGrid, 
  Stat, 
  StatLabel, 
  StatNumber,
  useColorModeValue,
  VStack,
  Flex,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Button,
  Select,
  useToast,
  Spinner,
  HStack,
  Icon,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Image,
  Input,
} from '@chakra-ui/react';
import { useAuth } from '../../auth/AuthContext';
import { Link } from 'react-router-dom';
import { FaBox, FaShippingFast, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

// Import API services
import { adminApi } from '../../api/adminApi';
import { getShippingStatusOptions, getShippingStatusConfig } from '../../utils/orderStatusUtils';
import { useRealTimeSync, useNotificationSync } from '../../hooks/useRealTimeSync';

const OutletDashboard: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0
  });
  const toast = useToast();
  const cardBgColor = useColorModeValue('white', 'gray.700');
  
  // Status Foto state
  const { isOpen: isPhotoModalOpen, onOpen: onPhotoModalOpen, onClose: onPhotoModalClose } = useDisclosure();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [photoFiles, setPhotoFiles] = useState<Record<string, File | null>>({
    readyForPickup: null,
    pickedUp: null,
    delivered: null
  });
  const [uploadedImages, setUploadedImages] = useState<Record<string, string | null>>({
    readyForPickup: null,
    pickedUp: null,
    delivered: null
  });
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Real-time sync hooks
  const { syncStatus, manualRefresh } = useRealTimeSync({
    role: 'outlet',
    onUpdate: () => {
      console.log('Real-time update detected, refreshing orders...');
      fetchOrders();
    },
    pollingInterval: 60000, // Poll every 60 seconds (1 minute) - optimized for cost efficiency
    enabled: true
  });

  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationSync({
    userId: user?.id,
    pollingInterval: 60000 // Poll every 60 seconds (1 minute) - optimized for cost efficiency
  });

  // Function to fetch orders (extracted for reuse)
  const fetchOrders = async (): Promise<void> => {
    try {
      setLoading(true);
      // Use relative path in development (proxy) and full URL in production
      const apiUrl = import.meta.env.DEV 
        ? '/api/orders/outlet-relational' 
        : `${import.meta.env.VITE_API_BASE_URL || 'https://order-management-app-production.wahwooh.workers.dev'}/api/orders/outlet-relational`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: ApiResponse<{ orders: Order[] }> = await response.json();
      
      if (data.success && data.data) {
        const fetchedOrders = data.data.orders || [];
        setOrders(fetchedOrders);
        
        // Calculate stats with proper typing
        const newStats: OrderStats = {
          total: fetchedOrders.length,
          pending: fetchedOrders.filter((order: Order) => order.shipping_status === 'pending').length,
          inProgress: fetchedOrders.filter((order: Order) => order.shipping_status === 'dalam_pengiriman').length,
          completed: fetchedOrders.filter((order: Order) => order.shipping_status === 'diterima').length
        };
        setStats(newStats);
      } else {
        throw new Error(data.message || 'Failed to fetch orders');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Error fetching orders:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Get orders for this outlet
  useEffect(() => {
    fetchOrders();
  }, []);
  
  // Helper function to check if order is eligible for Status Foto
  const isEligibleForStatusFoto = (order: Order): boolean => {
    // Debug logging untuk troubleshooting
    console.log('🔍 Checking eligibility for order:', order.id);
    console.log('📍 shipping_area:', order.shipping_area);
    console.log('📍 lokasi_pengiriman:', order.lokasi_pengiriman);
    console.log('📋 tipe_pesanan:', order.tipe_pesanan);
    
    // Improve matching logic - check multiple possible field names and formats
    const shippingAreaLower = order.shipping_area ? order.shipping_area.toLowerCase() : '';
    const lokasiPengirimanLower = order.lokasi_pengiriman ? order.lokasi_pengiriman.toLowerCase() : '';
    
    console.log('🔍 Debug string matching:');
    console.log('   - shippingAreaLower:', `"${shippingAreaLower}"`);
    console.log('   - lokasiPengirimanLower:', `"${lokasiPengirimanLower}"`);
    console.log('   - shippingAreaLower includes "dalam kota":', shippingAreaLower.includes('dalam kota'));
    console.log('   - shippingAreaLower === "dalam kota":', shippingAreaLower === 'dalam kota');
    console.log('   - lokasiPengirimanLower includes "dalam kota":', lokasiPengirimanLower.includes('dalam kota'));
    
    const isInKota = (
      // Check shipping_area field - handle both formats
      (shippingAreaLower.includes('dalam kota')) ||
      (shippingAreaLower.includes('dalam-kota')) ||
      // Check lokasi_pengiriman field
      (lokasiPengirimanLower.includes('dalam kota')) ||
      (lokasiPengirimanLower.includes('dalam-kota')) ||
      // Exact match
      (shippingAreaLower === 'dalam kota') ||
      (shippingAreaLower === 'dalam-kota') ||
      (lokasiPengirimanLower === 'dalam kota') ||
      (lokasiPengirimanLower === 'dalam-kota')
    );
    
    const tipePesananLower = order.tipe_pesanan ? order.tipe_pesanan.toLowerCase() : '';
    console.log('🔍 Debug tipe pesanan:');
    console.log('   - tipePesananLower:', `"${tipePesananLower}"`);
    console.log('   - includes "pesan antar":', tipePesananLower.includes('pesan antar'));
    console.log('   - includes "pesan ambil":', tipePesananLower.includes('pesan ambil'));
    
    const isPesanAntarOrAmbil = (
      tipePesananLower.includes('pesan antar') ||
      tipePesananLower.includes('pesan ambil')
    );
    
    console.log('✅ isInKota:', isInKota);
    console.log('✅ isPesanAntarOrAmbil:', isPesanAntarOrAmbil);
    console.log('🎯 Final eligibility:', isInKota && isPesanAntarOrAmbil);
    
    return isInKota && isPesanAntarOrAmbil;
  };
  
  // Open Status Foto modal for specific order
  const handleOpenStatusFoto = (order: Order): void => {
    setSelectedOrder(order);
    setPhotoFiles({ readyForPickup: null, pickedUp: null, delivered: null });
    setUploadedImages({ readyForPickup: null, pickedUp: null, delivered: null });
    onPhotoModalOpen();
  };
  
  // Handle photo file selection
  const handlePhotoFileChange = (type: string, file: File): void => {
    if (file) {
      setPhotoFiles(prev => ({ ...prev, [type]: file }));
      
      // Hapus URL objek lama jika ada untuk mencegah memory leak
      const currentImage = (uploadedImages as any)[type];
      if (currentImage && currentImage.startsWith('blob:')) {
        URL.revokeObjectURL(currentImage);
      }
      
      // Gunakan URL.createObjectURL untuk preview tanpa konversi base64
      const objectUrl = URL.createObjectURL(file);
      setUploadedImages(prev => ({ ...prev, [type]: objectUrl }));
    }
  };
  
  // Upload photo to server using standardized adminApi
  const uploadPhoto = async (type: string): Promise<void> => {
    if (!photoFiles[type] || !selectedOrder) return;
    
    setIsUploading(true);
    try {
      console.log(`📤 OutletDashboard uploading ${type} photo for order ${selectedOrder.id}`);
      
      // Map outlet photo types to backend types
      const typeMapping: Record<string, 'siap_kirim' | 'pengiriman' | 'diterima'> = {
        readyForPickup: 'siap_kirim',
        pickedUp: 'pengiriman', 
        delivered: 'diterima'
      };
      
      const backendType = typeMapping[type];
      if (!backendType) {
        throw new Error(`Invalid photo type: ${type}`);
      }
      
      // Use standardized adminApi.uploadShippingImage
      const response = await adminApi.uploadShippingImage(selectedOrder.id, backendType, photoFiles[type]!);
      
      if (response.success && response.data?.imageUrl) {
        // Update uploaded images state with the image URL from API response
        setUploadedImages(prev => ({
          ...prev,
          [type]: response.data!.imageUrl
        }));
        
        // Clear the file input
        setPhotoFiles(prev => ({
          ...prev,
          [type]: null
        }));
        
        toast({
          title: 'Foto berhasil diupload',
          description: 'Foto berhasil disimpan ke server',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Refresh orders to get updated data
        await fetchOrders();
      } else {
        throw new Error(response.error || 'Gagal upload foto');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error uploading photo:', error);
      setError(errorMessage);
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

  const updateOrderStatus = async (orderId: string, newStatus: ShippingStatus): Promise<void> => {
    try {
      console.log('📦 Memperbarui status pengiriman:', orderId, newStatus);
      
      // Update UI optimistically untuk pengalaman pengguna yang lebih baik
      // Kita akan tetap menampilkan status baru sebelum konfirmasi dari server
      setOrders(orders.map(order => {
        if (order.id === orderId) {
          return { ...order, shipping_status: newStatus };
        }
        return order;
      }));
      
      // Menggunakan endpoint yang benar sesuai dengan yang ada di backend
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://order-management-app-production.wahwooh.workers.dev'}/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`
        },
        body: JSON.stringify({
          status: newStatus
        })
      });
      
      let data;
      try {
        data = await response.json();
        console.log('✅ Hasil update status:', data);
      } catch (jsonError) {
        console.error('Error parsing response JSON:', jsonError);
        data = {};
      }
      
      // Log the result but don't show any toast notifications
      // This avoids confusing the user with inconsistent messages
      if (!response.ok) {
        console.warn('🔶 Respons API tidak sukses, tetapi UI sudah diupdate optimistically');
        console.log('Response status:', response.status);
      }
    } catch (err: unknown) {
      console.error('Error updating shipping status:', err);
      // Keep optimistic UI update even on error
    }
  };

  const getStatusColor = (status: string): string => {
    switch(status) {
      case 'pending': return 'orange';
      case 'dikemas': return 'blue';
      case 'siap kirim': return 'purple';
      case 'dalam_pengiriman': return 'cyan';
      case 'diterima': return 'green';
      default: return 'gray';
    }
  };

  // Helper function to get shipping status badge - REMOVED (currently unused)
  // const getShippingStatusBadge = (status: string) => {
  //   const config = getShippingStatusConfig(status);
  //   return <Badge colorScheme={config.color}>{config.text}</Badge>;
  // };

  if (loading) {
    return (
      <Flex justify="center" align="center" height="80vh">
        <Spinner size="xl" />
        <Text ml={4}>Memuat data...</Text>
      </Flex>
    );
  }

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Flex justify="space-between" align="center">
          <Box>
            <Heading size="lg" mb={2}>Dashboard Outlet</Heading>
            <Text color="gray.600">Selamat datang, {user?.name || 'Pengelola Outlet'}</Text>
            {user?.outlet_id && (
              <Text fontWeight="bold" color="teal.500">
                Outlet ID: {user.outlet_id}
              </Text>
            )}
          </Box>
        </Flex>

        {/* Stats Cards */}
        <SimpleGrid columns={{ base: 1, md: 4 }} spacing={6}>
          <Box p={5} shadow="md" borderWidth="1px" borderRadius="lg" bg={cardBgColor}>
            <Stat>
              <Flex align="center">
                <Icon as={FaBox} boxSize={10} color="blue.400" mr={3} />
                <Box>
                  <StatLabel>Total Pesanan</StatLabel>
                  <StatNumber>{stats.total}</StatNumber>
                </Box>
              </Flex>
            </Stat>
          </Box>
          
          <Box p={5} shadow="md" borderWidth="1px" borderRadius="lg" bg={cardBgColor}>
            <Stat>
              <Flex align="center">
                <Icon as={FaExclamationTriangle} boxSize={10} color="orange.400" mr={3} />
                <Box>
                  <StatLabel>Menunggu Pembayaran</StatLabel>
                  <StatNumber>{stats.pending}</StatNumber>
                </Box>
              </Flex>
            </Stat>
          </Box>
          
          <Box p={5} shadow="md" borderWidth="1px" borderRadius="lg" bg={cardBgColor}>
            <Stat>
              <Flex align="center">
                <Icon as={FaShippingFast} boxSize={10} color="purple.400" mr={3} />
                <Box>
                  <StatLabel>Dalam Proses</StatLabel>
                  <StatNumber>{stats.inProgress}</StatNumber>
                </Box>
              </Flex>
            </Stat>
          </Box>
          
          <Box p={5} shadow="md" borderWidth="1px" borderRadius="lg" bg={cardBgColor}>
            <Stat>
              <Flex align="center">
                <Icon as={FaCheckCircle} boxSize={10} color="green.400" mr={3} />
                <Box>
                  <StatLabel>Selesai</StatLabel>
                  <StatNumber>{stats.completed}</StatNumber>
                </Box>
              </Flex>
            </Stat>
          </Box>
        </SimpleGrid>

        <Box borderWidth="1px" borderRadius="lg" overflow="hidden" bg={cardBgColor}>
          <Flex p={4} justifyContent="space-between" alignItems="center" borderBottomWidth="1px">
            <Heading size="md">Daftar Pesanan Terbaru</Heading>
          </Flex>
          
          {orders.length > 0 ? (
            <Box overflowX="auto">
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>ID Pesanan</Th>
                    <Th>Nama Pelanggan</Th>
                    <Th>Total</Th>
                    <Th>Status</Th>
                    <Th>Status Pengiriman</Th>
                    <Th>Tanggal</Th>
                    <Th>Aksi</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {orders.map(order => (
                    <Tr key={order.id}>
                      <Td fontWeight="medium">{order.id}</Td>
                      <Td>{order.customer_name}</Td>
                      <Td>Rp {order.total_amount?.toLocaleString()}</Td>
                      <Td><Badge colorScheme={getStatusColor(order.payment_status)} size="sm">{order.payment_status}</Badge></Td>
                      <Td><Badge colorScheme={getStatusColor(order.shipping_status)} size="sm">{order.shipping_status}</Badge></Td>
                      <Td>{new Date(order.created_at).toLocaleDateString()}</Td>
                      <Td>
                        <HStack spacing={2}>
                          <Button 
                            as={Link} 
                            to={`/outlet/orders/${order.id}`} 
                            size="sm" 
                            colorScheme="blue" 
                            variant="outline"
                          >
                            Detail
                          </Button>
                          
                          {/* Status Foto button for eligible orders */}
                          {isEligibleForStatusFoto(order) && (
                            <Button 
                              size="sm" 
                              colorScheme="green" 
                              variant="outline"
                              onClick={() => handleOpenStatusFoto(order)}
                            >
                              📷 Status Foto
                            </Button>
                          )}
                          
                          {order.payment_status === 'settlement' && (
                            <Select 
                              size="sm" 
                              width="180px"
                              value={order.shipping_status || 'menunggu diproses'}
                              onChange={(e) => updateOrderStatus(order.id, e.target.value as ShippingStatus)}
                              placeholder="Pilih status"
                            >
                              {getShippingStatusOptions().map((option: any) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </Select>
                          )}
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          ) : (
            <Box p={8} textAlign="center">
              <Text>Tidak ada pesanan untuk ditampilkan</Text>
            </Box>
          )}
        </Box>
        
        {/* Status Foto Modal */}
        <Modal isOpen={isPhotoModalOpen} onClose={onPhotoModalClose} size="xl">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>
              Status Foto - {selectedOrder?.id}
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {selectedOrder && (
                <VStack spacing={6} align="stretch">
                  <Box>
                    <Text fontWeight="bold" mb={2}>
                      {selectedOrder.tipe_pesanan} - {selectedOrder.shipping_area || 'Dalam Kota'}
                    </Text>
                    <Text fontSize="sm" color="gray.500">
                      Unggah foto untuk setiap tahap pengiriman
                    </Text>
                  </Box>
                  
                  {/* Foto Siap Ambil/Antar */}
                  <Box borderWidth="1px" borderRadius="lg" p={4}>
                    <Text fontWeight="medium" mb={3}>
                      1. {selectedOrder.tipe_pesanan === "Pesan Antar" ? "Siap Diantar" : "Siap Diambil"}
                    </Text>
                    
                    {uploadedImages.readyForPickup && (
                      <Image 
                        src={uploadedImages.readyForPickup} 
                        alt="Siap diambil/antar" 
                        maxH="200px" 
                        mb={3}
                        borderRadius="md"
                      />
                    )}
                    
                    <HStack spacing={2}>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              const files = e.target.files;
                              if (files && files.length > 0) {
                                handlePhotoFileChange('readyForPickup', files[0]);
                              }
                            }} 
                        display="none"
                        id="readyForPickup-upload"
                      />
                      <Button
                        as="label"
                        htmlFor="readyForPickup-upload"
                        size="sm"
                        colorScheme="blue"
                        cursor="pointer"
                      >
                        {uploadedImages.readyForPickup ? 'Ganti Foto' : 'Pilih Foto'}
                      </Button>
                      
                      {photoFiles.readyForPickup && (
                        <Button
                          size="sm"
                          colorScheme="green"
                          isLoading={isUploading}
                          onClick={() => uploadPhoto('readyForPickup')}
                        >
                          Upload
                        </Button>
                      )}
                    </HStack>
                  </Box>
                  
                  {/* Foto Sedang Dikirim/Diambil */}
                  <Box borderWidth="1px" borderRadius="lg" p={4}>
                    <Text fontWeight="medium" mb={3}>
                      2. {selectedOrder.tipe_pesanan === "Pesan Antar" ? "Sedang Diantar" : "Sedang Diambil"}
                    </Text>
                    
                    {uploadedImages.pickedUp && (
                      <Image 
                        src={uploadedImages.pickedUp} 
                        alt="Sedang dikirim/diambil" 
                        maxH="200px" 
                        mb={3}
                        borderRadius="md"
                      />
                    )}
                    
                    <HStack spacing={2}>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const files = e.target.files;
                          if (files && files.length > 0) {
                            handlePhotoFileChange('pickedUp', files[0]);
                          }
                        }}
                        display="none"
                        id="pickedUp-upload"
                      />
                      <Button
                        as="label"
                        htmlFor="pickedUp-upload"
                        size="sm"
                        colorScheme="blue"
                        cursor="pointer"
                      >
                        {uploadedImages.pickedUp ? 'Ganti Foto' : 'Pilih Foto'}
                      </Button>
                      
                      {photoFiles.pickedUp && (
                        <Button
                          size="sm"
                          colorScheme="green"
                          isLoading={isUploading}
                          onClick={() => uploadPhoto('pickedUp')}
                        >
                          Upload
                        </Button>
                      )}
                    </HStack>
                  </Box>
                  
                  {/* Foto Diterima/Selesai */}
                  <Box borderWidth="1px" borderRadius="lg" p={4}>
                    <Text fontWeight="medium" mb={3}>
                      3. {selectedOrder.tipe_pesanan === "Pesan Antar" ? "Diterima" : "Selesai Diambil"}
                    </Text>
                    
                    {uploadedImages.delivered && (
                      <Image 
                        src={uploadedImages.delivered} 
                        alt="Diterima/selesai" 
                        maxH="200px" 
                        mb={3}
                        borderRadius="md"
                      />
                    )}
                    
                    <HStack spacing={2}>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const files = e.target.files;
                          if (files && files.length > 0) {
                            handlePhotoFileChange('delivered', files[0]);
                          }
                        }}
                        display="none"
                        id="delivered-upload"
                      />
                      <Button
                        as="label"
                        htmlFor="delivered-upload"
                        size="sm"
                        colorScheme="blue"
                        cursor="pointer"
                      >
                        {uploadedImages.delivered ? 'Ganti Foto' : 'Pilih Foto'}
                      </Button>
                      
                      {photoFiles.delivered && (
                        <Button
                          size="sm"
                          colorScheme="green"
                          isLoading={isUploading}
                          onClick={() => uploadPhoto('delivered')}
                        >
                          Upload
                        </Button>
                      )}
                    </HStack>
                  </Box>
                </VStack>
              )}
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="gray" onClick={onPhotoModalClose}>
                Tutup
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
        
      </VStack>
    </Container>
  );
}

export default OutletDashboard;
