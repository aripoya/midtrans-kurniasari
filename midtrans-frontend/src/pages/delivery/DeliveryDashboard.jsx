import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Button,
  useToast,
  Flex,
  Container,
  Stat,
  StatLabel,
  StatNumber,
  SimpleGrid,
  Spinner,
  Image,
  Tooltip,
  useColorModeValue,
  Icon,
  Select,
  FormControl,
  FormLabel,
  Input,
  useBreakpointValue,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from '@chakra-ui/react';
import { FaTruck, FaShippingFast, FaCheckCircle } from 'react-icons/fa';
import { useAuth } from '../../auth/AuthContext';
import { Link } from 'react-router-dom';
import { getShippingStatusOptions, getShippingStatusConfig } from '../../utils/orderStatusUtils';
import { adminApi } from '../../api/adminApi';
import { useRealTimeSync, useNotificationSync } from '../../hooks/useRealTimeSync';

function DeliveryDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMobile = useBreakpointValue({ base: true, md: false });
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    shipping: 0,
    delivered: 0
  });

  
  const toast = useToast();
  const cardBgColor = useColorModeValue('white', 'gray.700');

  // Fetch orders function with useCallback to avoid dependency issues
  const fetchOrders = useCallback(async () => {
    try {
      console.log('📡 Fetching deliveryman orders...');
      console.log('🔑 Auth Token:', sessionStorage.getItem('token'));
      
      // Get user info from token
      const token = sessionStorage.getItem('token');
      let deliverymanId = null;
      
      console.log('🔍 DEBUGGING TOKEN ISSUES:');
      console.log('- Token dari localStorage:', token ? 'Ada (panjang: ' + token.length + ')' : 'Tidak ada');
      
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          deliverymanId = payload.id || payload.userId;
          console.log('- Deliveryman ID dari token:', deliverymanId);
          console.log('- Token payload:', payload);
        } catch (e) {
          console.error('Error parsing token:', e);
        }
      }
      
      setLoading(true);
      setError(null);
      
      const response = await adminApi.getDeliveryOrders();
      
      console.log('✅ Response berhasil:', response);
      
      // Handle adminApi response format
      if (response.success === false && response.error) {
        throw new Error(response.error);
      }
      
      const data = response.data || {};
      const orders = data.orders || [];
      
      // Debug: Log setiap order dan shipping_photo-nya
      if (orders && Array.isArray(orders)) {
        orders.forEach(order => {
          console.log(`Order ${order.id} - shipping_photo:`, order.shipping_photo);
        });
      }
      
      setOrders(orders);
      
      // Update stats based on orders
      if (orders && Array.isArray(orders)) {
        const totalOrders = orders.length;
        
        // Normalisasi status untuk penghitungan yang lebih akurat (case-insensitive)
        const pendingOrders = orders.filter(order => {
          const status = (order.shipping_status || '').toLowerCase();
          return status === 'menunggu pengiriman' || status === 'pending' || status === '';
        }).length;
        
        const shippingOrders = orders.filter(order => {
          const status = (order.shipping_status || '').toLowerCase();
          return status === 'dalam pengiriman' || status === 'shipping';
        }).length;
        
        const deliveredOrders = data.orders.filter(order => {
          const status = (order.shipping_status || '').toLowerCase();
          return status === 'diterima' || status === 'delivered';
        }).length;
        
        setStats({
          total: totalOrders,
          pending: pendingOrders,
          shipping: shippingOrders,
          delivered: deliveredOrders
        });
      }
    } catch (err) {
      console.error('Error fetching deliveryman orders:', err);
      setError('Terjadi kesalahan saat memuat daftar pengiriman.');
      toast({
        title: 'Error',
        description: 'Terjadi kesalahan saat memuat daftar pengiriman.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Real-time sync hooks for deliveryman
  const { syncStatus, manualRefresh } = useRealTimeSync({
    role: 'deliveryman',
    onUpdate: (updateInfo) => {
      console.log('DELIVERY SYNC: New updates detected:', updateInfo);
      // Refresh orders when updates are detected
      fetchOrders();
    },
    pollingInterval: 60000, // Poll every 60 seconds (1 minute) - optimized for cost efficiency
    enabled: true
  });

  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationSync({
    userId: user?.id,
    onNewNotification: (newNotifications) => {
      // Show toast for new delivery notifications
      newNotifications.forEach(notification => {
        toast({
          title: `🚚 ${notification.title}`,
          description: notification.message,
          status: 'info',
          duration: 6000,
          isClosable: true,
          position: 'top-right'
        });
      });
    },
    pollingInterval: 60000 // Check notifications every 60 seconds (1 minute) - optimized for cost efficiency
  });

  // Load orders on component mount
  useEffect(() => {
    fetchOrders();
  }, []);



  // Update shipping status
const updateShippingStatus = async (orderId, newStatus ) => {
  try {
    setLoading(true);

    const result = await adminApi.updateOrderShippingStatus(orderId, newStatus);

    console.log('✅ Status update result:', result);

    if (result.success) {
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId
            ? { ...order, shipping_status: newStatus }
            : order
        )
      );

      const updatedStats = { ...stats };

      if (newStatus === 'diterima') {
        updatedStats.shipping = Math.max(0, updatedStats.shipping - 1);
        updatedStats.delivered += 1;
      } else if (newStatus === 'dalam-pengiriman') {
        updatedStats.pending = Math.max(0, updatedStats.pending - 1);
        updatedStats.shipping += 1;
      }
      setStats(updatedStats);
      toast({
        title: 'Status berhasil diperbarui',
        description: `Status pengiriman berhasil diubah menjadi ${newStatus.replace(/-/g, ' ')}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } else {
      throw new Error(result.message || 'Gagal memperbarui status pengiriman');
    }
  } catch (error) {
    toast({
      title: 'Terjadi kesalahan',
      description: error.message || 'Gagal memperbarui status. Silakan coba lagi.',
      status: 'error',
      duration: 5000,
      isClosable: true,
    });
  } finally {
    setLoading(false);
  }
};

  const getShippingStatusBadge = (status) => {
    const config = getShippingStatusConfig(status);
    return <Badge colorScheme={config.color}>{config.text}</Badge>;
  };

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
            <Heading size="lg" mb={2}>Dashboard Kurir</Heading>
            <Text color="gray.600">Selamat datang, {user?.name || 'Kurir'}</Text>
          </Box>
        </Flex>

        {/* Stats Cards */}
        <SimpleGrid columns={{ base: 1, md: 4 }} spacing={6}>
          <Box p={5} shadow="md" borderWidth="1px" borderRadius="lg" bg={cardBgColor}>
            <Stat>
              <Flex align="center">
                <Icon as={FaTruck} boxSize={10} color="blue.400" mr={3} />
                <Box>
                  <StatLabel>Total Pengiriman</StatLabel>
                  <StatNumber>{stats.total}</StatNumber>
                </Box>
              </Flex>
            </Stat>
          </Box>
          
          <Box p={5} shadow="md" borderWidth="1px" borderRadius="lg" bg={cardBgColor}>
            <Stat>
              <Flex align="center">
                <Icon as={FaTruck} boxSize={10} color="orange.400" mr={3} />
                <Box>
                  <StatLabel>Menunggu Pengambilan</StatLabel>
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
                  <StatLabel>Dalam Pengiriman</StatLabel>
                  <StatNumber>{stats.shipping}</StatNumber>
                </Box>
              </Flex>
            </Stat>
          </Box>
          
          <Box p={5} shadow="md" borderWidth="1px" borderRadius="lg" bg={cardBgColor}>
            <Stat>
              <Flex align="center">
                <Icon as={FaCheckCircle} boxSize={10} color="green.400" mr={3} />
                <Box>
                  <StatLabel>Diterima</StatLabel>
                  <StatNumber>{stats.delivered}</StatNumber>
                </Box>
              </Flex>
            </Stat>
          </Box>
        </SimpleGrid>

        {/* Orders Table */}
        <Box borderWidth="1px" borderRadius="lg" overflow="hidden" bg={cardBgColor}>
          <Flex p={4} justifyContent="space-between" alignItems="center" borderBottomWidth="1px">
            <Heading size="md">Pengiriman Yang Ditugaskan</Heading>
          </Flex>
          

          {orders.length === 0 ? (
          <Text textAlign="center">Tidak ada pengiriman yang ditugaskan</Text>
        ) : isMobile ? (
          <Accordion allowToggle>
            {orders.map((order) => (
              <AccordionItem key={order.id}>
                <AccordionButton _hover={{ bg: 'transparent' }} _focus={{ boxShadow: 'none' }}>
                  <Box flex="1" textAlign="left">
                    #{order.id} - {order.customer_name}
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
                <AccordionPanel pb={4}>
                  <VStack align="start" spacing={2}>
                    <Text><strong>Alamat:</strong> {order.customer_address}</Text>
                    <Text><strong>Lokasi:</strong> {order.lokasi_pengiriman || 'Tidak tersedia'}</Text>
                    <Text><strong>Status:</strong> {getShippingStatusBadge(order.shipping_status)}</Text>
                    <HStack>
                      <Button as={Link} to={`/delivery/orders/${order.id}`} size="sm" colorScheme="blue" variant="outline">Detail</Button>
                      {order.shipping_status !== 'diterima' && (
                        <Select
                          size="sm"
                          width="200px"
                          value={order.shipping_status || ''}
                          onChange={(e) => updateShippingStatus(order.id, e.target.value)}
                        >
                          <option value="siap kirim">Siap Kirim</option>
                          <option value="sedang dikirim">Dalam Pengiriman</option>
                          <option value="diterima">Diterima</option>
                        </Select>
                      )}
                    </HStack>
                  </VStack>
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <Box borderWidth="1px" borderRadius="lg" overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>ID Pesanan</Th>
                  <Th>Nama Pelanggan</Th>
                  <Th>Alamat</Th>
                  <Th>Lokasi</Th>
                  <Th>Status</Th>
                  <Th>Aksi</Th>
                </Tr>
              </Thead>
              <Tbody>
                {orders.map((order) => (
                  <Tr key={order.id}>
                    <Td>{order.id}</Td>
                    <Td>{order.customer_name}</Td>
                    <Td>{order.customer_address}</Td>
                    <Td>{order.lokasi_pengiriman || 'Tidak tersedia'}</Td>
                    <Td>{getShippingStatusBadge(order.shipping_status)}</Td>
                    <Td>
                      <HStack spacing={2}>
                        <Button as={Link} to={`/delivery/orders/${order.id}`} size="sm" colorScheme="blue" variant="outline">Detail</Button>
                        {order.shipping_status !== 'diterima' && (
                          <Select
                            size="sm"
                            width="150px"
                            value={order.shipping_status || ''}
                            onChange={(e) => updateShippingStatus(order.id, e.target.value)}
                          >
                            <option value="siap kirim">Siap Kirim</option>
                            <option value="sedang dikirim">Dalam Pengiriman</option>
                            <option value="diterima">Diterima</option>
                          </Select>
                        )}
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
        </Box>
      </VStack>


    </Container>
  );
}

export default DeliveryDashboard;
