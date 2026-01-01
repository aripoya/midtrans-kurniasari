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
  useBreakpointValue,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Stack,
} from '@chakra-ui/react';
import { useAuth } from '../../auth/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { FaBox, FaShippingFast, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { FiCalendar } from 'react-icons/fi';

// Import API services
import { adminApi } from '../../api/adminApi';
import { outletApi, OutletMonthlyTrendRow } from '../../api/outletApi';
import { getShippingStatusOptions } from '../../utils/orderStatusUtils';
import { useRealTimeSync, useNotificationSync } from '../../hooks/useRealTimeSync';
import { formatDateShort } from '../../utils/formatters';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const OutletDashboard: React.FC = () => {
  const isMobile = useBreakpointValue({ base: true, md: false });
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [, setError] = useState<string | null>(null);
  const [monthlyTrend, setMonthlyTrend] = useState<OutletMonthlyTrendRow[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState<boolean>(false);
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0
  });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);
  const toast = useToast();
  const cardBgColor = useColorModeValue('white', 'gray.700');

  // Export PDF function
  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text('Laporan Pesanan Outlet', 14, 20);
    
    // Add date
    doc.setFontSize(11);
    doc.text(`Tanggal Export: ${formatDateShort(new Date())}`, 14, 28);
    doc.text(`Outlet: ${user?.outlet_id || 'N/A'}`, 14, 34);
    
    // Prepare data for table
    const tableData = orders.map((order) => [
      order.id.substring(0, 8),
      order.customer_name,
      `Rp ${order.total_amount?.toLocaleString('id-ID') || '0'}`,
      getPaymentStatusText(order.payment_status),
      order.shipping_status || 'N/A',
      formatDateShort(order.created_at)
    ]);
    
    // Add table
    autoTable(doc, {
      head: [['ID Order', 'Pelanggan', 'Total', 'Pembayaran', 'Pengiriman', 'Tanggal']],
      body: tableData,
      startY: 40,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [66, 153, 225], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { top: 40 },
    });
    
    // Add summary
    const finalY = (doc as any).lastAutoTable.finalY || 40;
    doc.setFontSize(10);
    doc.text(`Total Pesanan: ${orders.length}`, 14, finalY + 10);
    doc.text(`Total Pendapatan: Rp ${orders.reduce((sum, order) => sum + (order.total_amount || 0), 0).toLocaleString('id-ID')}`, 14, finalY + 16);
    
    // Save PDF
    doc.save(`laporan-outlet-${formatDateShort(new Date()).replace(/\//g, '-')}.pdf`);
  };
  
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

  const handleOpenPhotoModal = (order: Order): void => {
    try {
      Object.values(uploadedImages).forEach((url) => {
        if (url && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    } catch (_) {
      // ignore
    }

    setSelectedOrder(order);
    setPhotoFiles({ readyForPickup: null, pickedUp: null, delivered: null });
    setUploadedImages({ readyForPickup: null, pickedUp: null, delivered: null });
    onPhotoModalOpen();
  };

  const handleClosePhotoModal = (): void => {
    try {
      Object.values(uploadedImages).forEach((url) => {
        if (url && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    } catch (_) {
      // ignore
    }

    setSelectedOrder(null);
    setPhotoFiles({ readyForPickup: null, pickedUp: null, delivered: null });
    setUploadedImages({ readyForPickup: null, pickedUp: null, delivered: null });
    onPhotoModalClose();
  };

  // Real-time sync hooks
  useRealTimeSync({
    role: 'outlet',
    onUpdate: () => {
      console.log('Real-time update detected, refreshing orders...');
      fetchOrders();
    },
    pollingInterval: 5000, // Poll every 5 seconds - optimized for real-time responsiveness
    enabled: true
  });

  useNotificationSync({
    userId: user?.id,
    pollingInterval: 5000 // Poll every 5 seconds - optimized for real-time responsiveness
  });

  // Function to fetch orders (extracted for reuse)
  const fetchOrders = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // Get date range for last 3 months to show recent orders
      const now = new Date();
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(now.getMonth() - 3);
      
      const dateFrom = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;
      const dateTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      // Use outlet report API with date filter
      const baseApiUrl = import.meta.env.DEV 
        ? '/api/outlet/report' 
        : `${import.meta.env.VITE_API_BASE_URL || 'https://order-management-app-production.wahwooh.workers.dev'}/api/outlet/report`;

      const apiUrl = `${baseApiUrl}?type=orders&date_from=${dateFrom}&date_to=${dateTo}&limit=200`;
      
      console.log('Dashboard fetching orders (last 3 months):', { dateFrom, dateTo, apiUrl });
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: any = await response.json();
      console.log('Dashboard orders response:', data);
      
      if (data.success) {
        const fetchedOrders = data.orders || [];
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

  useEffect(() => {
    const run = async () => {
      try {
        setMonthlyLoading(true);
        const resp = await outletApi.getMonthlyTrend();
        if (resp.success && resp.data) {
          setMonthlyTrend(resp.data.monthly_trend || []);
        } else {
          console.error('Outlet monthly trend API returned failure:', resp.error);
          toast({
            title: 'Gagal memuat trend bulanan',
            description: resp.error || 'API laporan outlet tidak dapat diakses atau tidak mengembalikan data.',
            status: 'error',
            duration: 7000,
            isClosable: true,
          });
        }
      } catch (e) {
        console.error('Error fetching outlet monthly trend:', e);
        toast({
          title: 'Gagal memuat trend bulanan',
          description: 'API laporan outlet tidak dapat diakses atau tidak mengembalikan data.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setMonthlyLoading(false);
      }
    };

    run();
  }, []);
  
  // Helper function to check if order is eligible for Status Foto
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
      
      // Map outlet types to backend types correctly
      const backendTypeMapping: Record<string, 'ready_for_pickup' | 'picked_up' | 'delivered'> = {
        'siap_kirim': 'ready_for_pickup',
        'pengiriman': 'picked_up', 
        'diterima': 'delivered'
      };
      
      const correctBackendType = backendTypeMapping[backendType] || 'ready_for_pickup';
      
      // Use standardized adminApi.uploadShippingImage
      const response = await adminApi.uploadShippingImage(selectedOrder.id, correctBackendType, photoFiles[type]!);
      
      console.log('📤 Modal upload response:', response);
      
      // Check backend success flag only
      if (response.success) {
        // Update uploaded images state with the image URL from API response
        const imageUrl = response.data?.imageUrl || '';
        setUploadedImages(prev => ({
          ...prev,
          [type]: imageUrl
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

        // Jika ini adalah foto tahap akhir (diterima) dari modal Status Foto,
        // otomatis ubah status pesanan menjadi 'diterima'
        if (type === 'delivered') {
          try {
            await updateOrderStatus(selectedOrder.id, 'diterima' as ShippingStatus);
          } catch (e) {
            console.error('Error auto-updating order status to diterima after final photo upload:', e);
          }
        }
      } else {
        throw new Error(response.error || 'Upload gagal dari server');
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

  // Quick photo upload function for inline camera button
  const handleQuickPhotoUpload = async (orderId: string, event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    // Determine photo type based on current shipping status
    const getPhotoTypeFromStatus = (status: string): 'ready_for_pickup' | 'picked_up' | 'delivered' => {
      switch (status) {
        case 'pending':
        case 'processing':
        case 'dikemas':
        case 'siap kirim':
          return 'ready_for_pickup';
        case 'shipping':
        case 'dalam pengiriman':
          return 'picked_up';
        case 'delivered':
        case 'diterima':
          return 'delivered';
        default:
          return 'ready_for_pickup'; // Default fallback
      }
    };
    
    const photoType = getPhotoTypeFromStatus(order.shipping_status || 'pending');
    
    try {
      console.log(`📸 Quick upload: ${photoType} photo for order ${orderId}`);
      
      toast({
        title: 'Mengupload foto...',
        description: `Sedang upload foto untuk status "${order.shipping_status}"`,
        status: 'info',
        duration: 2000,
        isClosable: true,
      });
      
      // Use standardized adminApi.uploadShippingImage
      const response = await adminApi.uploadShippingImage(orderId, photoType, file);
      
      console.log('📤 Quick upload response:', response);
      console.log('📤 Response success flag:', response.success);
      console.log('📤 Response type:', typeof response.success);
      
      // Check backend success flag, not just imageUrl existence
      if (response.success === true) {
        toast({
          title: '✅ Foto berhasil diupload',
          description: `Foto untuk status "${order.shipping_status}" berhasil disimpan`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // Refresh orders to get updated data
        await fetchOrders();

        // Jika quick upload ini adalah foto tahap akhir, otomatis set status pengiriman menjadi 'diterima'
        if (photoType === 'delivered') {
          try {
            await updateOrderStatus(orderId, 'diterima' as ShippingStatus);
          } catch (e) {
            console.error('Error auto-updating order status to diterima after quick final photo upload:', e);
          }
        }
      } else {
        throw new Error(response.error || 'Upload gagal dari server');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error in quick photo upload:', error);
      toast({
        title: '❌ Gagal upload foto',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
    
    // Clear the file input
    event.target.value = '';
  };

  const updateOrderStatus = async (orderId: string, newStatus: ShippingStatus): Promise<void> => {
    try {
      console.log('📦 Memperbarui status pesanan:', orderId, newStatus);
      
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
          'Authorization': `Bearer ${localStorage.getItem('token')}`
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
      case 'settlement': return 'green';
      case 'dikemas': return 'blue';
      case 'siap kirim': return 'purple';
      case 'dalam_pengiriman': return 'cyan';
      case 'diterima': return 'green';
      default: return 'gray';
    }
  };

  // Helper function to format payment status display text
  const getPaymentStatusText = (status: string): string => {
    switch(status) {
      case 'settlement': return 'LUNAS';
      case 'pending': return 'PENDING';
      default: return status.toUpperCase();
    }
  };

  // Helper function to get shipping status badge - REMOVED (currently unused)
  // const getShippingStatusBadge = (status: string) => {
  //   const config = getShippingStatusConfig(status);
  //   return <Badge colorScheme={config.color}>{config.text}</Badge>;
  // };

  const totalOrders = orders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrders = orders.slice(startIndex, endIndex);

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
            <Box>
              <Heading size="md">Tren 12 Bulan Terakhir</Heading>
              <Text fontSize="sm" color="gray.600" mt={1}>
                Klik pada bulan untuk melihat breakdown per minggu
              </Text>
            </Box>
          </Flex>

          <Box p={4}>
            {monthlyLoading ? (
              <Flex justify="center" align="center" py={8}>
                <Spinner />
                <Text ml={3}>Memuat trend...</Text>
              </Flex>
            ) : monthlyTrend.length === 0 ? (
              <Box py={8} textAlign="center">
                <Text color="gray.500">Belum ada data trend bulanan</Text>
              </Box>
            ) : (
              <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing={4}>
                {[...monthlyTrend]
                  .filter((m) => (m.count || 0) > 0 || (m.revenue || 0) > 0)
                  .sort((a, b) => a.month.localeCompare(b.month))
                  .map((m) => {
                    const [yy, mm] = (m.month || '').split('-');
                    return (
                      <Box
                        key={m.month}
                        p={4}
                        borderWidth="1px"
                        borderRadius="md"
                        cursor="pointer"
                        transition="all 0.2s"
                        _hover={{
                          borderColor: 'blue.500',
                          boxShadow: 'md',
                          transform: 'translateY(-2px)',
                        }}
                        onClick={() => navigate(`/outlet/report/weekly/${yy}/${mm}`)}
                      >
                        <HStack mb={2}>
                          <Icon as={FiCalendar} color="blue.500" />
                          <Text fontWeight="bold" fontSize="sm">{`${mm}-${yy}`}</Text>
                        </HStack>
                        <Text fontSize="sm" color="gray.600">{m.count} pesanan</Text>
                        <Text fontSize="md" fontWeight="bold" color="purple.600">{m.revenue_formatted}</Text>
                      </Box>
                    );
                  })}
              </SimpleGrid>
            )}
          </Box>
        </Box>

        <Box borderWidth="1px" borderRadius="lg" overflow="hidden" bg={cardBgColor}>
      <Flex p={4} justifyContent="space-between" alignItems="center" borderBottomWidth="1px">
        <Heading size="md">Daftar Pesanan Terbaru</Heading>
      </Flex>

      {/* Pagination controls */}
      {orders.length > 0 && (
        <Flex p={4} pt={2} pb={2} justify="space-between" align="center" wrap="wrap" gap={4}>
          <HStack spacing={2} flex="1">
            <Text fontSize="sm" color="gray.600">
              Tampilkan:
            </Text>
            <Select
              size="sm"
              maxW="100px"
              value={itemsPerPage}
              onChange={(e) => {
                const value = Number(e.target.value) || 10;
                setItemsPerPage(value);
                setCurrentPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
            </Select>
            <Text fontSize="sm" color="gray.600">
              data per halaman
            </Text>
          </HStack>

          <HStack spacing={2}>
            <Button
              size="sm"
              colorScheme="green"
              leftIcon={<FaBox />}
              onClick={exportToPDF}
            >
              Export PDF
            </Button>
          </HStack>

          <HStack spacing={2}>
            <Button
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              isDisabled={safeCurrentPage === 1}
            >
              Prev
            </Button>
            <Text fontSize="sm">
              Halaman {safeCurrentPage} dari {totalPages}
            </Text>
            <Button
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              isDisabled={safeCurrentPage >= totalPages}
            >
              Next
            </Button>
          </HStack>

          <Text fontSize="sm" color="gray.600">
            Total: {totalOrders} pesanan
          </Text>
        </Flex>
      )}

      {orders.length > 0 ? (
        isMobile ? (
          <Accordion allowToggle>
            {paginatedOrders.map((order) => (
              <AccordionItem key={order.id} >
                <AccordionButton >
                  <Box flex="1" textAlign="left" fontWeight="semibold">
                    #{order.id} - {order.customer_name}
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel pb={4}>
                  <Stack spacing={2}>
                    <Box><strong>Total:</strong> Rp {order.total_amount.toLocaleString()}</Box>
                    <Box>
                      <strong>Status:</strong>{' '}
                      <Badge colorScheme={getStatusColor(order.payment_status)}>
                        {getPaymentStatusText(order.payment_status)}
                      </Badge>
                    </Box>
                    <Box>
                      <strong>Pengiriman:</strong>{' '}
                      <Badge colorScheme={getStatusColor(order.shipping_status)}>
                        {order.shipping_status}
                      </Badge>
                    </Box>
                    <Box><strong>Tanggal:</strong> {formatDateShort(order.created_at)}</Box>

                    <HStack spacing={2} pt={2}>
                      <Button
                        as={Link}
                        to={`/outlet/orders/${order.id}`}
                        size="sm"
                        colorScheme="blue"
                        variant="outline"
                      >
                        Detail
                      </Button>

                      {order.payment_status === 'settlement' && (
                        <>
                          <Button
                            size="sm"
                            colorScheme="purple"
                            variant="outline"
                            onClick={() => handleOpenPhotoModal(order)}
                          >
                            Status Foto
                          </Button>

                          <Select
                            size="sm"
                            width="auto"
                            value={order.shipping_status || 'menunggu diproses'}
                            onChange={(e) =>
                              updateOrderStatus(order.id, e.target.value as ShippingStatus)
                            }
                            placeholder="Pilih status"
                          >
                            {getShippingStatusOptions().map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Select>

                          <Box position="relative">
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleQuickPhotoUpload(order.id, e)}
                              style={{
                                position: 'absolute',
                                opacity: 0,
                                width: '100%',
                                height: '100%',
                                cursor: 'pointer',
                              }}
                              id={`quick-photo-${order.id}`}
                            />
                            <Button
                              as="label"
                              htmlFor={`quick-photo-${order.id}`}
                              size="sm"
                              colorScheme="teal"
                              variant="outline"
                              cursor="pointer"
                              title="Upload foto"
                              px={3}
                            >
                              📷
                            </Button>
                          </Box>
                        </>
                      )}
                    </HStack>
                  </Stack>
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <Box overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>ID Pesanan</Th>
                  <Th>Nama Pelanggan</Th>
                  <Th>Total</Th>
                  <Th>Status</Th>
                  <Th>Status Pesanan</Th>
                  <Th>Tanggal</Th>
                  <Th>Aksi</Th>
                </Tr>
              </Thead>
              <Tbody>
                {paginatedOrders.map((order) => (
                  <Tr key={order.id}>
                    <Td fontWeight="medium">{order.id}</Td>
                    <Td>{order.customer_name}</Td>
                    <Td>Rp {order.total_amount.toLocaleString()}</Td>
                    <Td>
                      <Badge colorScheme={getStatusColor(order.payment_status)}>
                        {getPaymentStatusText(order.payment_status)}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge colorScheme={getStatusColor(order.shipping_status)}>
                        {order.shipping_status}
                      </Badge>
                    </Td>
                    <Td>{formatDateShort(order.created_at)}</Td>
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
                        {order.payment_status === 'settlement' && (
                          <HStack spacing={1}>
                            <Button
                              size="sm"
                              colorScheme="purple"
                              variant="outline"
                              onClick={() => handleOpenPhotoModal(order)}
                            >
                              Status Foto
                            </Button>

                            <Select
                              size="sm"
                              width="160px"
                              value={order.shipping_status || 'menunggu diproses'}
                              onChange={(e) =>
                                updateOrderStatus(order.id, e.target.value as ShippingStatus)
                              }
                              placeholder="Pilih status"
                            >
                              {getShippingStatusOptions().map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </Select>

                            <Box position="relative">
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleQuickPhotoUpload(order.id, e)}
                                style={{
                                  position: 'absolute',
                                  opacity: 0,
                                  width: '100%',
                                  height: '100%',
                                  cursor: 'pointer',
                                }}
                                id={`quick-photo-${order.id}`}
                              />
                              <Button
                                as="label"
                                htmlFor={`quick-photo-${order.id}`}
                                size="sm"
                                colorScheme="teal"
                                variant="outline"
                                cursor="pointer"
                                title="Upload foto"
                                px={3}
                              >
                                📷
                              </Button>
                            </Box>
                          </HStack>
                        )}
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )
      ) : (
        <Box p={8} textAlign="center">
          <Text>Tidak ada pesanan untuk ditampilkan</Text>
        </Box>
      )}
    </Box>
        
        {/* Status Foto Modal */}
        <Modal isOpen={isPhotoModalOpen} onClose={handleClosePhotoModal} size="xl">
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
              <Button colorScheme="gray" onClick={handleClosePhotoModal}>
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
