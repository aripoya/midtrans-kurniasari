import React, { useState, useEffect, useCallback } from 'react';
import type { 
  OrderStats
} from '../../types/index';
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
  useColorModeValue,
  Icon,
  Select
} from '@chakra-ui/react';
import { FaTruck, FaShippingFast, FaCheckCircle } from 'react-icons/fa';
import { useAuth } from '../../auth/AuthContext';
import { Link } from 'react-router-dom';
import { getShippingStatusConfig } from '../../utils/orderStatusUtils';
import { adminApi } from '../../api/adminApi';
import { useRealTimeSync, useNotificationSync } from '../../hooks/useRealTimeSync';

const DeliveryDashboard: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0
  });

  const toast = useToast();
  const cardBgColor = useColorModeValue('white', 'gray.700');

  // Real-time sync hooks
  const { syncStatus, manualRefresh } = useRealTimeSync({
    role: 'delivery',
    onUpdate: (updateInfo: any) => {
      console.log('DELIVERY SYNC: New updates detected:', updateInfo);
      // Refresh orders when updates are detected
      fetchOrders();
    },
    pollingInterval: 60000, // Poll every 60 seconds (1 minute) - optimized for cost efficiency
    enabled: true
  });

  const { unreadCount } = useNotificationSync({
    userId: user?.id,
    onNewNotification: (newNotifications: any[]) => {
      // Show toast for new notifications
      newNotifications.forEach(notification => {
        toast({
          title: notification.title,
          description: notification.message,
          status: 'info',
          duration: 5000,
          isClosable: true,
        });
      });
    },
    pollingInterval: 60000 // Check notifications every 60 seconds (1 minute) - optimized for cost efficiency
  });

  // Fetch orders function with useCallback to avoid dependency issues
  const fetchOrders = useCallback(async (): Promise<void> => {
    try {
      console.log('📡 Fetching deliveryman orders...');
      console.log('🔑 Auth Token:', sessionStorage.getItem('token'));
      
      // Get user info from token
      const token = sessionStorage.getItem('token');
      let deliverymanId: string | null = null;
      
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
        orders.forEach((order: Order) => {
          console.log(`Order ${order.id} - shipping_photo:`, (order as any).shipping_photo);
        });
      }
      
      setOrders(orders);
      
      // Update stats based on orders
      if (orders && Array.isArray(orders)) {
        const totalOrders = orders.length;
        
        // Normalisasi status untuk penghitungan yang lebih akurat (case-insensitive)
        const pendingOrders = orders.filter((order: any) => {
          const status = (order.shipping_status || '').toLowerCase();
          return status === 'menunggu pengiriman' || status === 'pending' || status === '';
        }).length;
        
        const inProgressOrders = orders.filter((order: any) => {
          const status = (order.shipping_status || '').toLowerCase();
          return status === 'dalam pengiriman' || status === 'shipping';
        }).length;
        
        const completedOrders = orders.filter((order: any) => {
          const status = (order.shipping_status || '').toLowerCase();
          return status === 'diterima' || status === 'delivered';
        }).length;
        
        setStats({
          total: totalOrders,
          pending: pendingOrders,
          inProgress: inProgressOrders,
          completed: completedOrders
        });
      }
    } catch (err: unknown) {
      console.error('Error fetching deliveryman orders:', err);
      const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat daftar pengiriman.';
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
  }, [toast]);

  // Update shipping status
  const updateShippingStatus = async (orderId: string, newStatus: string): Promise<void> => {
    try {
      console.log(`🔄 Updating shipping status for order ${orderId} to ${newStatus}`);
      
      const response = await adminApi.updateOrderShippingStatus(orderId, newStatus);
      
      if (response.success) {
        console.log('✅ Status updated successfully');
        
        // Update local state - using any type to avoid strict typing issues during migration
        setOrders(prevOrders => 
          prevOrders.map((order: any) => 
            order.id === orderId 
              ? { ...order, shipping_status: newStatus }
              : order
          )
        );
        
        // Update stats
        const updatedOrders = orders.map((order: any) => 
          order.id === orderId 
            ? { ...order, shipping_status: newStatus }
            : order
        );
        
        const totalOrders = updatedOrders.length;
        const pendingOrders = updatedOrders.filter((order: any) => {
          const status = (order.shipping_status || '').toLowerCase();
          return status === 'menunggu pengiriman' || status === 'pending' || status === '';
        }).length;
        
        const inProgressOrders = updatedOrders.filter((order: any) => {
          const status = (order.shipping_status || '').toLowerCase();
          return status === 'dalam pengiriman' || status === 'shipping';
        }).length;
        
        const completedOrders = updatedOrders.filter((order: any) => {
          const status = (order.shipping_status || '').toLowerCase();
          return status === 'diterima' || status === 'delivered';
        }).length;
        
        setStats({
          total: totalOrders,
          pending: pendingOrders,
          inProgress: inProgressOrders,
          completed: completedOrders
        });
        
        toast({
          title: 'Status Updated',
          description: `Order ${orderId} status updated to ${newStatus}`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        throw new Error(response.error || 'Failed to update status');
      }
    } catch (err: unknown) {
      console.error('Error updating shipping status:', err);
      const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan saat memperbarui status pesanan.';
      
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const getShippingStatusBadge = (status: string): React.ReactElement => {
    const config = getShippingStatusConfig(status);
    return <Badge colorScheme={config.color}>{config.text}</Badge>;
  };

  // Helper function for status color - REMOVED (currently unused)
  // const getStatusColor = (status: string): string => {
  //   const config = getShippingStatusConfig(status);
  //   return config.color;
  // };

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  if (loading) {
    return (
      <Container maxW="7xl" py={8}>
        <VStack spacing={8}>
          <Flex justify="center" align="center" h="200px">
            <Spinner size="xl" />
            <Text ml={4}>Memuat dashboard pengiriman...</Text>
          </Flex>
        </VStack>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxW="7xl" py={8}>
        <VStack spacing={8}>
          <Box textAlign="center" p={8}>
            <Text color="red.500" fontSize="lg">{error}</Text>
            <Button mt={4} onClick={fetchOrders} colorScheme="blue">
              Coba Lagi
            </Button>
          </Box>
        </VStack>
      </Container>
    );
  }

  return (
    <Container maxW="7xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Flex justify="space-between" align="center">
          <Heading>Dashboard Pengiriman</Heading>
          <HStack spacing={2}>
            {syncStatus && (
              <Badge colorScheme={syncStatus.isOnline ? 'green' : 'red'}>
                {syncStatus.isOnline ? 'Online' : 'Offline'}
              </Badge>
            )}
            {unreadCount > 0 && (
              <Badge colorScheme="red" variant="solid">
                {unreadCount} Notifikasi
              </Badge>
            )}
            <Button size="sm" onClick={manualRefresh}>
              Refresh
            </Button>
          </HStack>
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
                  <StatLabel>Menunggu</StatLabel>
                  <StatNumber>{stats.pending}</StatNumber>
                </Box>
              </Flex>
            </Stat>
          </Box>
          
          <Box p={5} shadow="md" borderWidth="1px" borderRadius="lg" bg={cardBgColor}>
            <Stat>
              <Flex align="center">
                <Icon as={FaShippingFast} boxSize={10} color="blue.400" mr={3} />
                <Box>
                  <StatLabel>Dalam Pengiriman</StatLabel>
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
                  <StatLabel>Diterima</StatLabel>
                  <StatNumber>{stats.completed}</StatNumber>
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
          
          {orders.length > 0 ? (
            <Box overflowX="auto">
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>ID Pesanan</Th>
                    <Th>Nama Pelanggan</Th>
                    <Th>Alamat</Th>
                    <Th>Lokasi Pengiriman</Th>
                    <Th>Status Pesanan</Th>
                    <Th>Aksi</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {orders.map((order: Order) => (
                    <Tr key={order.id}>
                      <Td fontWeight="medium">{order.id}</Td>
                      <Td>{order.customer_name}</Td>
                      <Td>{order.customer_address}</Td>
                      <Td>{order.lokasi_pengiriman || (order as any).shipping_location || order.outlet_id || 'Tidak tersedia'}</Td>
                      <Td>{getShippingStatusBadge(order.shipping_status)}</Td>
                      <Td>
                        <HStack spacing={2}>
                          {/* Order details button */}
                          <Button 
                            as={Link} 
                            to={`/delivery/orders/${order.id}`} 
                            size="sm" 
                            colorScheme="blue" 
                            variant="outline"
                          >
                            Detail
                          </Button>
                          
                          {/* Status Update Dropdown - TDD Compliance */}
                          <Select 
                            size="sm" 
                            width="200px"
                            value={order.shipping_status}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateShippingStatus(order.id, e.target.value)}
                            role="combobox"
                          >
                            <option value="menunggu diproses">Menunggu Diproses</option>
                            <option value="dikemas">Dikemas</option>
                            <option value="siap kirim">Siap Kirim</option>
                            <option value="dalam_pengiriman">Dalam Pengiriman</option>
                            <option value="diterima">Diterima</option>
                          </Select>
                          
                          {order.shipping_status === 'dalam_pengiriman' && (
                            <Button 
                              size="sm" 
                              colorScheme="green"
                              onClick={() => updateShippingStatus(order.id, 'diterima')}
                              leftIcon={<FaCheckCircle />}
                            >
                              Tandai Diterima
                            </Button>
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
              <Text>Tidak ada pengiriman yang ditugaskan</Text>
            </Box>
          )}
        </Box>
      </VStack>
    </Container>
  );
};

export default DeliveryDashboard;
