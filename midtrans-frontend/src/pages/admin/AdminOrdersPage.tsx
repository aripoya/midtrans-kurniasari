import React, { useState, useEffect, useCallback } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import {
  Box, 
  Button, 
  Container, 
  Flex, 
  Heading, 
  Table, 
  Thead, 
  Tbody, 
  Tr, 
  Th, 
  Td, 
  Badge, 
  HStack,
  Input,
  Select,
  Spinner,
  Text,
  useToast,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Card,
  CardBody,
  useBreakpointValue,
  Stack,
} from '@chakra-ui/react';
import { adminApi } from '../../api/adminApi';
import { formatDate } from '../../utils/date';
import { useRealTimeSync, useNotificationSync } from '../../hooks/useRealTimeSync';

// Interface for StatCard props
interface StatCardProps {
  label: string;
  value: number;
  colorScheme?: string;
}

// Interface for AdminOrdersPage state
interface AdminOrdersStats {
  total: number;
  pending: number;
  paid: number;
  shipping: number;
}

// Stat card component for dashboard
const StatCard: React.FC<StatCardProps> = ({ label, value, colorScheme = "teal" }) => {
  return (
    <Stat p={4} shadow="md" border="1px" borderColor="gray.200" borderRadius="md" bg="white">
      <StatLabel color={`${colorScheme}.600`} fontWeight="medium">{label}</StatLabel>
      <StatNumber fontSize="2xl">{value}</StatNumber>
    </Stat>
  );
};

const AdminOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [stats, setStats] = useState<AdminOrdersStats>({
    total: 0,
    pending: 0,
    paid: 0,
    shipping: 0,
  });
  const toast = useToast();
  const isMobile = useBreakpointValue({ base: true, md: false });
  const { logout } = useAuth();
  const navigate = useNavigate();

  // Logout function
  const handleLogout = () => {
    logout();
    navigate('/admin/login');
    toast({
      title: 'Logout Berhasil',
      description: 'Anda telah berhasil logout dari sistem.',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  // Real-time sync hooks for admin orders
  const { syncStatus } = useRealTimeSync({
    role: 'admin',
    onUpdate: (updateInfo: any) => {
      console.log('ADMIN SYNC: New updates detected:', updateInfo);
      // Refresh orders when updates are detected
      fetchOrders();
    },
    pollingInterval: 60000, // Poll every 60 seconds (1 minute) - optimized for cost efficiency
    enabled: true
  });

  const { unreadCount } = useNotificationSync({
    userId: 'admin', // Admin user for notifications
    pollingInterval: 60000 // Poll every 60 seconds (1 minute) - optimized for cost efficiency
  });

  // Get payment status badge
  const getPaymentStatusBadge = (status: string): React.ReactElement => {
    const statusMap: Record<string, { color: string; text: string }> = {
      pending: { color: "yellow", text: "Menunggu Pembayaran" },
      settlement: { color: "green", text: "Dibayar" },
      capture: { color: "green", text: "Dibayar" },
      paid: { color: "green", text: "Dibayar" },
      deny: { color: "red", text: "Ditolak" },
      cancel: { color: "red", text: "Dibatalkan" },
      expire: { color: "red", text: "Kadaluarsa" },
      failure: { color: "red", text: "Gagal" },
    };

    const statusInfo = statusMap[status] || { color: "gray", text: status || "Tidak Diketahui" };
    
    return <Badge colorScheme={statusInfo.color}>{statusInfo.text}</Badge>;
  };
  
  // Get shipping status badge
  const getShippingStatusBadge = (status: string): React.ReactElement => {
    const statusMap: Record<string, { color: string; text: string }> = {
      "dikemas": { color: "blue", text: "Dikemas" },
      "siap kirim": { color: "purple", text: "Siap Kirim" },
      "dikirim": { color: "orange", text: "Dikirim" },
      "sedang dikirim": { color: "orange", text: "Sedang Dikirim" },
      "received": { color: "green", text: "Diterima" },
    };

    const statusInfo = statusMap[status?.toLowerCase()] || { color: "gray", text: status || "Menunggu Diproses" };
    
    return <Badge colorScheme={statusInfo.color}>{statusInfo.text}</Badge>;
  };

  const fetchOrders = useCallback(async (): Promise<void> => {
    console.log('[DEBUG] 🚀 fetchOrders called - starting fetch process...');
    setLoading(true);
    try {
      console.log('[DEBUG] 📡 Calling adminApi.getAdminOrders()...');
      const response = await adminApi.getAdminOrders();
      console.log('[DEBUG] 📦 Admin API response received:', response);
      console.log('[DEBUG] 🔍 Response structure check:');
      console.log('[DEBUG]   - response.success:', response.success);
      console.log('[DEBUG]   - response.error:', response.error);
      console.log('[DEBUG]   - response.data:', response.data);
      console.log('[DEBUG]   - response.data?.orders:', response.data?.orders);
      
      if (response.error) {
        console.error('[DEBUG] ❌ API returned error:', response.error);
        throw new Error(response.error);
      }
      
      if (response.success && response.data?.orders) {
        const orders = response.data.orders;
        console.log('[DEBUG] ✅ Successfully parsed orders:', orders.length, 'orders');
        console.log('[DEBUG] 📋 Orders data:', orders);
        
        console.log('[DEBUG] 🎯 Setting orders state with:', orders.length, 'orders');
        setOrders(orders);
        
        // Calculate stats
        const stats = {
          total: orders.length,
          pending: orders.filter((o: any) => o.payment_status === 'pending').length,
          paid: orders.filter((o: any) => ['paid', 'settlement', 'capture'].includes(o.payment_status)).length,
          shipping: orders.filter((o: any) => o.shipping_status && !['received'].includes(o.shipping_status)).length,
        };
        console.log('[DEBUG] 📊 Calculated stats:', stats);
        console.log('[DEBUG] 🎯 Setting stats state with:', stats);
        setStats(stats);
        
        console.log('[DEBUG] ✅ fetchOrders completed successfully!');
      } else {
        console.error('[DEBUG] ❌ Admin orders data structure unexpected:', response);
        console.error('[DEBUG] Expected adminApi format: { success: true, data: { orders: [...] } }');
        console.log('[DEBUG] 🚫 Setting empty orders array');
        setOrders([]);
      }
    } catch (error: unknown) {
      console.error('[DEBUG] ❌ Error in fetchOrders:', error);
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat memuat pesanan';
      
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      console.log('[DEBUG] 🚫 Setting empty orders array due to error');
      setOrders([]);
    } finally {
      console.log('[DEBUG] 🏁 fetchOrders finally block - setting loading to false');
      setLoading(false);
    }
  }, [toast]); // Only depend on toast which is stable from useToast

  useEffect(() => {
    console.log('[DEBUG] 🚀 useEffect called - starting fetch process...');
    fetchOrders();
  }, [fetchOrders]);

  // Filter orders based on search term and status
  const filteredOrders = orders.filter((order: any) => {
    const matchesSearch = !searchTerm || 
      order.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !statusFilter || 
      order.payment_status === statusFilter ||
      order.shipping_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Add render debugging
  console.log('[RENDER-DEBUG] 🎨 AdminOrdersPage rendering...');
  console.log('[RENDER-DEBUG] Current state:');
  console.log('[RENDER-DEBUG]   - loading:', loading);
  console.log('[RENDER-DEBUG]   - orders.length:', orders.length);
  console.log('[RENDER-DEBUG]   - orders:', orders);
  console.log('[RENDER-DEBUG]   - stats:', stats);
  console.log('[RENDER-DEBUG]   - filteredOrders.length:', filteredOrders.length);
  console.log('[RENDER-DEBUG]   - searchTerm:', searchTerm);
  console.log('[RENDER-DEBUG]   - statusFilter:', statusFilter);
  
  return (
    <Container maxW="7xl" py={8}>
      <Box>
        {/* Header */}
        <Flex justify="space-between" align="center" mb={6}>
          <Heading size="lg">Kelola Pesanan</Heading>
          <HStack spacing={4}>
            {/* Real-time sync status indicator */}
            <Box>
              <Badge 
                colorScheme={!syncStatus.connected ? 'red' : syncStatus.error ? 'red' : 'green'}
                variant="subtle"
              >
                {!syncStatus.connected ? '❌ Disconnected' : syncStatus.error ? '❌ Sync Error' : '✅ Live'}
              </Badge>
              {syncStatus.lastSync && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Last: {new Date(syncStatus.lastSync).toLocaleTimeString()}
                </Text>
              )}
            </Box>
            {/* Notification count indicator */}
            {unreadCount > 0 && (
              <Badge colorScheme="red" variant="solid" borderRadius="full">
                {unreadCount} new
              </Badge>
            )}
            <Button 
              onClick={fetchOrders}
              colorScheme="blue"
              isLoading={loading}
              loadingText="Memuat..."
            >
              Refresh
            </Button>
            <Button 
              onClick={handleLogout}
              colorScheme="red"
              variant="outline"
            >
              Logout
            </Button>
          </HStack>
        </Flex>

        {/* Stats Cards */}
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={6} mb={8}>
          <StatCard label="Total Pesanan" value={stats.total} colorScheme="blue" />
          <StatCard label="Menunggu Bayar" value={stats.pending} colorScheme="yellow" />
          <StatCard label="Sudah Dibayar" value={stats.paid} colorScheme="green" />
          <StatCard label="Sedang Dikirim" value={stats.shipping} colorScheme="purple" />
        </SimpleGrid>

        {/* Filters */}
        <HStack spacing={4} mb={6}>
          <Input
            placeholder="Cari pesanan..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            maxW="300px"
          />
          <Select
            placeholder="Filter status"
            value={statusFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
            maxW="200px"
          >
            <option value="pending">Menunggu Pembayaran</option>
            <option value="paid">Dibayar</option>
            <option value="settlement">Settlement</option>
            <option value="dikemas">Dikemas</option>
            <option value="dikirim">Dikirim</option>
            <option value="received">Diterima</option>
          </Select>
          <Button 
            onClick={fetchOrders}
            isLoading={loading}
            loadingText="Memuat..."
          >
            Refresh
          </Button>
        </HStack>
        
        {loading ? (
          <Flex justify="center" align="center" height="200px">
            <Spinner size="xl" />
          </Flex>
        ) : (
          <>
            {isMobile ? (
              // Mobile view - cards
              <Stack spacing={4}>
                {filteredOrders.length > 0 ? (
                  filteredOrders.map((order: any) => (
                    <Card key={order.id}>
                      <CardBody>
                        <Stack spacing={3}>
                          <Flex justify="space-between">
                            <Text fontWeight="bold">#{order.id.substring(0, 8)}</Text>
                            <Text>{formatDate(order.created_at)}</Text>
                          </Flex>
                          <Text><strong>Pelanggan:</strong> {order.customer_name}</Text>
                          <Text><strong>Total:</strong> Rp {order.total_amount?.toLocaleString('id-ID')}</Text>
                          <Flex justify="space-between">
                            <Box>
                              <Text fontSize="sm">Status Pembayaran:</Text>
                              {getPaymentStatusBadge(order.payment_status)}
                            </Box>
                            <Box>
                              <Text fontSize="sm">Status Pesanan:</Text>
                              {getShippingStatusBadge(order.shipping_status)}
                            </Box>
                          </Flex>
                          <Button 
                            as={RouterLink} 
                            to={`/admin/orders/${order.id}`}
                            size="sm"
                            colorScheme="blue"
                          >
                            Lihat Detail
                          </Button>
                        </Stack>
                      </CardBody>
                    </Card>
                  ))
                ) : (
                  <Text>Tidak ada pesanan ditemukan</Text>
                )}
              </Stack>
            ) : (
              // Desktop view - table
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>ID Pesanan</Th>
                      <Th>Tanggal</Th>
                      <Th>Pelanggan</Th>
                      <Th>Total</Th>
                      <Th>Status Pembayaran</Th>
                      <Th>Status Pesanan</Th>
                      <Th>Aksi</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {filteredOrders.length > 0 ? (
                      filteredOrders.map((order: any) => (
                        <Tr key={order.id}>
                          <Td>#{order.id.substring(0, 8)}</Td>
                          <Td>{formatDate(order.created_at)}</Td>
                          <Td>{order.customer_name}</Td>
                          <Td>Rp {order.total_amount?.toLocaleString('id-ID')}</Td>
                          <Td>{getPaymentStatusBadge(order.payment_status)}</Td>
                          <Td>{getShippingStatusBadge(order.shipping_status)}</Td>
                          <Td>
                            <Button
                              as={RouterLink}
                              to={`/admin/orders/${order.id}`}
                              size="sm"
                              colorScheme="blue"
                            >
                              Detail
                            </Button>
                          </Td>
                        </Tr>
                      ))
                    ) : (
                      <Tr>
                        <Td colSpan={7} textAlign="center">Tidak ada pesanan ditemukan</Td>
                      </Tr>
                    )}
                  </Tbody>
                </Table>
              </Box>
            )}
          </>
        )}
      </Box>
    </Container>
  );
};

export default AdminOrdersPage;
