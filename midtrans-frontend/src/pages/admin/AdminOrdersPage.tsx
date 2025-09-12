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
  useBreakpointValue,
   Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
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
      const response = await adminApi.getAdminOrders() as any;
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
      
      if (response.success && (response.data?.orders || response.orders)) {
        const orders = response.data?.orders || response.orders || [];
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
    const q = (searchTerm || '').toLowerCase().trim();
    const matchesSearch = !q ||
      (order.id || '').toLowerCase().includes(q) ||
      (order.customer_name || '').toLowerCase().includes(q) ||
      (order.customer_email || '').toLowerCase().includes(q);

    // Normalize status values
    const sf = (statusFilter || '').toLowerCase().trim();
    const pay = (order.payment_status || '').toLowerCase().trim();
    const shipRaw = (order.shipping_status || '').toLowerCase().trim();

    // Map shipping synonyms: treat "sedang dikirim" as "dikirim"
    const ship = shipRaw === 'sedang dikirim' ? 'dikirim' : shipRaw;

    // Payment equivalence: settlement/capture ~ paid
    const paymentMatches = (
      !sf ||
      pay === sf ||
      (sf === 'paid' && (pay === 'settlement' || pay === 'capture')) ||
      ((sf === 'settlement' || sf === 'capture') && pay === 'paid')
    );

    const shippingMatches = (!sf || ship === sf);

    const matchesStatus = !sf || paymentMatches || shippingMatches;

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
        <Flex
        direction={{ base: 'column', md: 'row' }}
        justify="space-between"
        align={{ base: 'flex-start', md: 'center' }}
        mb={6}
        gap={4}
        >
        {/* Kiri: Heading */}
          <Heading size="lg">Kelola Pesanan</Heading>

        {/* Kanan: Status badge, notif, buttons */}
          <HStack spacing={4} flexWrap="wrap" justify="flex-end">
            <Badge 
              colorScheme={
                !syncStatus.connected ? 'red' :
                syncStatus.error ? 'red' :
                'green'
              }
              variant="subtle"
            >
              {
                !syncStatus.connected
                  ? '❌ Disconnected'
                  : syncStatus.error
                  ? '❌ Sync Error'
                  : '✅ Live'
              }
            </Badge>

            {syncStatus.lastSync && (
              <Text fontSize="xs" color="gray.500">
                Last: {new Date(syncStatus.lastSync).toLocaleTimeString()}
              </Text>
            )}

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
        </HStack>
        
        {loading ? (
          <Flex justify="center" align="center" height="200px">
            <Spinner size="xl" />
          </Flex>
        ) : (
          <>
            {isMobile ? (
              // Mobile view - cards
             <Accordion allowMultiple>
              {filteredOrders.map(order => (
                <AccordionItem key={order.id} borderWidth="1px" borderRadius="md" mb={4}>
                  <AccordionButton _hover={{ bg: 'transparent' }} _focus={{ boxShadow: 'none' }} px={4} py={3}>
                    <Flex flex="1" textAlign="left" justify="space-between">
                      <Box fontWeight="bold">#{order.id} - {order.customer_name}</Box>
                      <AccordionIcon />
                    </Flex>
                  </AccordionButton>
                  <AccordionPanel px={4} pb={4}>
                    <Text><strong>Tanggal:</strong> {formatDate(order.created_at)}</Text>
                    <Text><strong>Email:</strong> {order.customer_email}</Text>
                    <Text><strong>Total:</strong> Rp {order.total_amount?.toLocaleString('id-ID')}</Text>
                    <Text><strong>Dibuat Oleh:</strong> {order.created_by_admin_name ? (
                      <Badge colorScheme="blue" variant="subtle" ml={2}>
                        {order.created_by_admin_name}
                      </Badge>
                    ) : '-'}</Text>
                    <Text><strong>Status Pembayaran:</strong> {getPaymentStatusBadge(order.payment_status)}</Text>
                    <Text><strong>Status Pesanan:</strong> {getShippingStatusBadge(order.shipping_status)}</Text>
                    <Button
                      as={RouterLink}
                      to={`/admin/orders/${order.id}`}
                      size="sm"
                      mt={3}
                      colorScheme="blue"
                    >
                      Lihat Detail
                    </Button>
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </Accordion>
            ) : (
              // Desktop view - table
              <Box overflowX="auto" minW="100%" border="1px solid" borderColor="gray.200" borderRadius="md">
                <Table variant="simple" size="sm" minW="1200px">
                  <Thead>
                    <Tr>
                      <Th minW="140px">ID Pesanan</Th>
                      <Th minW="100px">Tanggal</Th>
                      <Th minW="120px">Pelanggan</Th>
                      <Th minW="90px">Total</Th>
                      <Th minW="100px">Area Pengiriman</Th>
                      <Th minW="100px">Dibuat Oleh</Th>
                      <Th minW="140px">Status Pembayaran</Th>
                      <Th minW="120px">Status Pesanan</Th>
                      <Th minW="80px" position="sticky" right="0" bg="white" borderLeft="1px solid" borderColor="gray.200">Aksi</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {filteredOrders.length > 0 ? (
                      filteredOrders.map((order: any) => (
                        <Tr key={order.id}>
                          <Td>#{order.id}</Td>
                          <Td>{formatDate(order.created_at)}</Td>
                          <Td>{order.customer_name}</Td>
                          <Td>Rp {order.total_amount?.toLocaleString('id-ID')}</Td>
                          <Td>{order.lokasi_pengiriman || order.shipping_area || '-'}</Td>
                          <Td>
                            {order.created_by_admin_name ? (
                              <Badge colorScheme="blue" variant="subtle">
                                {order.created_by_admin_name}
                              </Badge>
                            ) : (
                              <Text fontSize="sm" color="gray.500">-</Text>
                            )}
                          </Td>
                          <Td>{getPaymentStatusBadge(order.payment_status)}</Td>
                          <Td>{getShippingStatusBadge(order.shipping_status)}</Td>
                          <Td position="sticky" right="0" bg="white" borderLeft="1px solid" borderColor="gray.200">
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
                        <Td colSpan={9} textAlign="center">Tidak ada pesanan ditemukan</Td>
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
