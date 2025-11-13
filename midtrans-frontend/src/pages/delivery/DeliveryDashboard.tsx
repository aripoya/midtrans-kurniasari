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
import { useRealTimeSync } from '../../hooks/useRealTimeSync';

const DeliveryDashboard: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [overview, setOverview] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0
  });
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");

  const toast = useToast();
  const cardBgColor = useColorModeValue('white', 'gray.700');

  // Real-time sync disabled to prevent constant refresh
  const syncStatus = { connected: false };
  const manualRefresh = () => fetchOverview();

  const unreadCount = 0; // notifications polling disabled on Delivery Dashboard

  // Fetch overview function with useCallback to avoid dependency issues
  const fetchOverview = useCallback(async (): Promise<void> => {
    try {
      console.log('📡 Fetching delivery overview...');
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
      
      const response = await adminApi.getDeliveryOverview(statusFilter || undefined);

      console.log('✅ Overview response:', response);

      if (response.success === false && response.error) {
        throw new Error(response.error);
      }

      const data = response.data || {};
      setOverview(data);

      // Determine which driver's orders to show
      const url = new URL(window.location.href);
      const driverParam = (url.searchParams.get('driver') || '').toLowerCase();

      let targetDriverId: string | undefined = undefined;
      const groups = Array.isArray(data.deliverymen) ? data.deliverymen : [];

      if (driverParam) {
        const match = groups.find((g: any) => {
          const uname = (g?.user?.username || '').toLowerCase();
          const name = (g?.user?.name || '').toLowerCase();
          return uname === driverParam || name === driverParam;
        });
        if (match?.user?.id) targetDriverId = match.user.id;
      }

      // If no URL driver specified, use logged-in deliveryman's id when role=deliveryman
      if (!targetDriverId && user?.role === 'deliveryman' && deliverymanId) {
        targetDriverId = deliverymanId;
      }

      // If still undefined, fallback to keep previous selection or first group
      if (!targetDriverId) {
        // Default to "Semua Driver" (empty string) instead of first group
        targetDriverId = selectedDriverId || '';
      }

      setSelectedDriverId(targetDriverId || '');
      // If "Semua Driver" selected (empty), show all orders from all drivers
      let allOrders: any[] = [];
      if (targetDriverId === '') {
        // Aggregate all orders from all drivers
        groups.forEach((g: any) => {
          if (Array.isArray(g.orders)) {
            allOrders = allOrders.concat(g.orders);
          }
        });
      } else {
        // Show only selected driver's orders
        const myGroup = groups.find((g: any) => g?.user?.id === targetDriverId);
        allOrders = Array.isArray(myGroup?.orders) ? myGroup.orders : [];
      }
      const filtered = allOrders.filter((o: any) => {
        const area = String(o.shipping_area || '').toLowerCase();
        const method = String(o.pickup_method || '').toLowerCase();
        const tipe = String(o.tipe_pesanan || '').toLowerCase();
        const areaOk = area === 'dalam_kota' || area === 'dalam-kota' || area === 'dalam kota';
        const methodOk = method === 'deliveryman' || method === 'kurir toko' || method === 'kurir_toko';
        const tipeOk = tipe === 'pesan antar' || tipe === 'pesan-antar';
        return areaOk && methodOk && tipeOk;
      });
      setOrders(filtered);

      // Update stats from summary if available
      if (data.summary) {
        const total = data.summary.total_orders || 0;
        const pending = 0; // not provided per-status; keep 0 or compute from groups if needed later
        const inProgress = 0;
        const completed = 0;
        setStats({ total, pending, inProgress, completed });
      }
    } catch (err: unknown) {
      console.error('Error fetching delivery overview:', err);
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
  }, [toast, statusFilter, user?.role, selectedDriverId]);

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

  // Unassign current deliveryman from an order (remove from my list)
  const unassignOrder = async (orderId: string): Promise<void> => {
    try {
      const confirm = window.confirm(`Hapus order ${orderId} dari daftar Anda?`);
      if (!confirm) return;

      const resp = await adminApi.unassignDelivery(orderId);
      if (!resp.success) throw new Error(resp.error || 'Gagal melepas penugasan');

      // Remove from local list
      setOrders(prev => prev.filter((o: any) => o.id !== orderId));

      // Optional: refresh overview to keep grouped sections in sync
      fetchOverview();

      toast({
        title: 'Berhasil',
        description: `Order ${orderId} telah dihapus dari daftar Anda`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (err: unknown) {
      console.error('Error unassigning order:', err);
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat melepas penugasan.';
      toast({ title: 'Error', description: message, status: 'error', duration: 5000, isClosable: true });
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
    fetchOverview();
  }, [fetchOverview]);

  // When driver selection changes and we already have overview, update orders view
  useEffect(() => {
    if (!overview) return;
    const groups = Array.isArray(overview.deliverymen) ? overview.deliverymen : [];
    // If "Semua Driver" selected (empty), show all orders from all drivers
    let allOrders: any[] = [];
    if (selectedDriverId === '') {
      // Aggregate all orders from all drivers
      groups.forEach((g: any) => {
        if (Array.isArray(g.orders)) {
          allOrders = allOrders.concat(g.orders);
        }
      });
    } else {
      // Show only selected driver's orders
      const myGroup = groups.find((g: any) => g?.user?.id === selectedDriverId);
      allOrders = Array.isArray(myGroup?.orders) ? myGroup.orders : [];
    }
    const filtered = allOrders.filter((o: any) => {
      const area = String(o.shipping_area || '').toLowerCase();
      const method = String(o.pickup_method || '').toLowerCase();
      const tipe = String(o.tipe_pesanan || '').toLowerCase();
      const areaOk = area === 'dalam_kota' || area === 'dalam-kota' || area === 'dalam kota';
      const methodOk = method === 'deliveryman' || method === 'kurir toko' || method === 'kurir_toko';
      const tipeOk = tipe === 'pesan antar' || tipe === 'pesan-antar';
      return areaOk && methodOk && tipeOk;
    });
    setOrders(filtered);
  }, [selectedDriverId, overview]);

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
            <Button mt={4} onClick={fetchOverview} colorScheme="blue">
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
              <Badge colorScheme={syncStatus.connected ? 'green' : 'red'}>
                {syncStatus.connected ? 'Online' : 'Offline'}
              </Badge>
            )}
            {unreadCount > 0 && (
              <Badge colorScheme="red" variant="solid">
                {unreadCount} Notifikasi
              </Badge>
            )}
            {/* Driver selector (admin can switch between drivers) */}
            {Array.isArray(overview?.deliverymen) && overview!.deliverymen.length > 0 && (
              <Select
                size="sm"
                width="220px"
                value={selectedDriverId}
                onChange={(e) => {
                  const newDriverId = e.target.value;
                  setSelectedDriverId(newDriverId);
                  // Update URL without page reload
                  const url = new URL(window.location.href);
                  if (newDriverId) {
                    // Find driver name for URL param (optional, for readability)
                    const driver = overview!.deliverymen.find((g: any) => g.user.id === newDriverId);
                    const driverName = driver ? (driver.user.name || driver.user.username) : '';
                    url.searchParams.set('driver', driverName);
                  } else {
                    url.searchParams.delete('driver');
                  }
                  window.history.replaceState({}, '', url.toString());
                }}
              >
                <option value="">Semua Driver</option>
                {overview!.deliverymen.map((g: any) => (
                  <option key={`opt-${g.user.id}`} value={g.user.id}>
                    {(g.user.name || g.user.username)} ({g.count || 0})
                  </option>
                ))}
              </Select>
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
        <Box borderWidth="1px" borderRadius="lg" overflow="hidden" bg="white">
          <Flex p={4} justifyContent="space-between" alignItems="center" borderBottomWidth="1px">
          <Heading size="md">Pengiriman Yang Ditugaskan</Heading>
          <HStack>
            <Select
              placeholder="Filter Status (opsional)"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              size="sm"
              width="250px"
            >
              <option value="menunggu diproses">Menunggu Diproses</option>
              <option value="dikemas">Dikemas</option>
              <option value="siap kirim">Siap Kirim</option>
              <option value="dalam_pengiriman">Dalam Pengiriman</option>
              <option value="diterima">Diterima</option>
            </Select>
          </HStack>
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
                    <Th>Driver</Th>
                    <Th>Status Pesanan</Th>
                    <Th>Aksi</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {orders.map((order: any) => (
                    <Tr key={order.id}>
                      <Td fontWeight="medium">{order.id}</Td>
                      <Td>{order.customer_name}</Td>
                      <Td>{order.customer_address}</Td>
                      <Td>{order.lokasi_pengiriman || (order as any).shipping_location || order.outlet_id || 'Tidak tersedia'}</Td>
                      <Td>
                        {(() => {
                          // Find driver name from overview data
                          if (!order.assigned_deliveryman_id) return 'Belum di-assign';
                          const driverGroup = overview?.deliverymen?.find((g: any) => g.user.id === order.assigned_deliveryman_id);
                          return driverGroup ? (driverGroup.user.name || driverGroup.user.username) : order.assigned_deliveryman_id;
                        })()}
                      </Td>
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

                          {/* Remove from my list (unassign) */}
                          <Button
                            size="sm"
                            colorScheme="red"
                            variant="outline"
                            onClick={() => unassignOrder(order.id)}
                          >
                            Hapus dari daftar saya
                          </Button>
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

        {/* Overview Grouped Sections */}
        {overview && (
          <Box borderWidth="1px" borderRadius="lg" overflow="hidden" bg="white">
            <Flex p={4} justifyContent="space-between" alignItems="center" borderBottomWidth="1px">
              <Heading size="md">Overview Semua Pengiriman</Heading>
              <Text color="gray.500">Total: {overview?.summary?.total_orders || 0} | Unassigned: {overview?.summary?.unassigned_count || 0}</Text>
            </Flex>

            {/* Unassigned */}
            <Box p={4}>
              <Heading size="sm" mb={3}>Belum Di-assign</Heading>
              {(overview.unassigned?.orders || []).length > 0 ? (
                <Box overflowX="auto">
                  <Table size="sm" variant="simple">
                    <Thead>
                      <Tr>
                        <Th>ID Pesanan</Th>
                        <Th>Nama Pelanggan</Th>
                        <Th>Alamat</Th>
                        <Th>Lokasi Pengiriman</Th>
                        <Th>Status</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {overview.unassigned.orders.map((order: any) => (
                        <Tr key={`unassigned-${order.id}`}>
                          <Td>{order.id}</Td>
                          <Td>{order.customer_name}</Td>
                          <Td>{order.customer_address || '-'}</Td>
                          <Td>{order.lokasi_pengiriman || '-'}</Td>
                          <Td>{getShippingStatusBadge(order.shipping_status)}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              ) : (
                <Text color="gray.500">Tidak ada pesanan unassigned</Text>
              )}
            </Box>

            {/* Per deliveryman */}
            <Box p={4} pt={0}>
              {(overview.deliverymen || []).map((group: any) => (
                <Box key={`dm-${group?.user?.id}`} mb={6}>
                  <Heading size="sm" mb={3}>{group?.user?.name || group?.user?.username} ({group?.count || 0})</Heading>
                  {Array.isArray(group?.orders) && group.orders.length > 0 ? (
                    <Box overflowX="auto">
                      <Table size="sm" variant="simple">
                        <Thead>
                          <Tr>
                            <Th>ID Pesanan</Th>
                            <Th>Nama Pelanggan</Th>
                            <Th>Alamat</Th>
                            <Th>Lokasi Pengiriman</Th>
                            <Th>Status</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {group.orders.map((order: any) => (
                            <Tr key={`dm-${group.user.id}-${order.id}`}>
                              <Td>{order.id}</Td>
                              <Td>{order.customer_name}</Td>
                              <Td>{order.customer_address || '-'}</Td>
                              <Td>{order.lokasi_pengiriman || '-'}</Td>
                              <Td>{getShippingStatusBadge(order.shipping_status)}</Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </Box>
                  ) : (
                    <Text color="gray.500">Tidak ada pesanan</Text>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </VStack>
    </Container>
  );
};

export default DeliveryDashboard;
