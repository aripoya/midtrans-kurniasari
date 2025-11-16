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
import { adminApi, AdminStats } from '../../api/adminApi';
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
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);
  const [totalOrders, setTotalOrders] = useState<number>(0);
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

  // Get delivery method label
  const getDeliveryMethodLabel = (order: any): string => {
    if (order.tipe_pesanan === 'Pesan Ambil') {
      if (order.pickup_method === 'self-pickup') return 'Di Ambil Sendiri';
      if (order.pickup_method === 'ojek-online') return 'Ojek Online';
      return order.pickup_method || '-';
    } else {
      // For Pesan Antar
      if (order.shipping_area === 'luar-kota') return 'Paket Expedisi (Paket)';
      if (order.pickup_method === 'deliveryman') return 'Kurir Toko';
      if (order.pickup_method === 'ojek-online') return 'Ojek Online';
      return order.pickup_method || '-';
    }
  };

  const fetchOrders = useCallback(async (): Promise<void> => {
    console.log('[DEBUG] 🚀 fetchOrders called - starting fetch process...');
    setLoading(true);
    try {
      const offset = (currentPage - 1) * itemsPerPage;
      console.log('[DEBUG] 📡 Calling adminApi.getAdminOrders with offset:', offset, 'limit:', itemsPerPage);
      const response = await adminApi.getAdminOrders(offset, itemsPerPage) as any;
      console.log('[DEBUG] 📦 Admin API response received:', response);
      console.log('[DEBUG] 🔍 Response structure check:');
      console.log('[DEBUG]   - response.success:', response.success);
      console.log('[DEBUG]   - response.error:', response.error);
      console.log('[DEBUG]   - response.data:', response.data);
      console.log('[DEBUG]   - response.data?.orders:', response.data?.orders);
      console.log('[DEBUG]   - response.data?.total:', response.data?.total);
      
      if (response.error) {
        console.error('[DEBUG] ❌ API returned error:', response.error);
        throw new Error(response.error);
      }
      
      if (response.success && (response.data?.orders || response.orders)) {
        const orders = response.data?.orders || response.orders || [];
        const total = response.data?.total || response.total || orders.length;
        console.log('[DEBUG] ✅ Successfully parsed orders:', orders.length, 'orders, total:', total);
        console.log('[DEBUG] 📋 Orders data:', orders);
        
        console.log('[DEBUG] 🎯 Setting orders state with:', orders.length, 'orders');
        setOrders(orders);
        setTotalOrders(total);
        
        // Calculate stats from total, not just current page
        const stats = {
          total: total,
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
        setTotalOrders(0);
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
      setTotalOrders(0);
    } finally {
      console.log('[DEBUG] 🏁 fetchOrders finally block - setting loading to false');
      setLoading(false);
    }
  }, [toast, currentPage, itemsPerPage]); // Add pagination dependencies

  useEffect(() => {
    console.log('[DEBUG] 🚀 useEffect called - starting fetch process...');
    fetchOrders();
    // Fetch admin dashboard stats (activities/sessions)
    (async () => {
      try {
        const resp = await adminApi.getAdminStats();
        if (resp.success && resp.data) {
          setAdminStats(resp.data);
        } else {
          console.warn('[AdminOrdersPage] Failed to fetch admin stats:', resp.error);
        }
      } catch (e) {
        console.warn('[AdminOrdersPage] Error fetching admin stats:', e);
      }
    })();
  }, [fetchOrders]);

  // Filter orders based on search term and status
  const filteredOrders = orders.filter((order: any) => {
    const q = (searchTerm || '').toLowerCase().trim();
    const matchesSearch = !q ||
      (order.id || '').toLowerCase().includes(q) ||
      (order.customer_name || '').toLowerCase().includes(q) ||
      (order.customer_email || '').toLowerCase().includes(q);

    // Normalize values
    const sfRaw = (statusFilter || '').toLowerCase().trim();
    // Map common UI labels to internal values defensively
    const sfMap: Record<string, string> = {
      'menunggu pembayaran': 'pending',
      'sudah dibayar': 'paid',
      'dibayar': 'paid',
      'sedang dikirim': 'dikirim',
      'dikirim': 'dikirim',
      'siap kirim': 'siap kirim',
      'diterima': 'received',
    };
    const sf = sfMap[sfRaw] || sfRaw;
    const pay = (order.payment_status || '').toLowerCase().trim();
    const shipRaw = (order.shipping_status || '').toLowerCase().trim();
    const ship = shipRaw === 'sedang dikirim' ? 'dikirim' : shipRaw; // synonym mapping

    // Define filter domains
    const paymentSet = new Set(['pending', 'paid', 'settlement', 'capture', 'cancel', 'expire', 'failure']);
    const shippingSet = new Set(['dikemas', 'siap kirim', 'dikirim', 'received']);

    // Payment equivalence: settlement/capture ~ paid
    const paymentMatches = (
      pay === sf ||
      (sf === 'paid' && (pay === 'settlement' || pay === 'capture')) ||
      ((sf === 'settlement' || sf === 'capture') && pay === 'paid')
    );
    const shippingMatches = (ship === sf);

    let matchesStatus = true;
    if (sf) {
      if (paymentSet.has(sf)) {
        // Filter ONLY by payment when selecting a payment status
        matchesStatus = paymentMatches;
      } else if (shippingSet.has(sf)) {
        // Filter ONLY by shipping when selecting a shipping status
        matchesStatus = shippingMatches;
      } else {
        // Unknown filter -> do not match anything unexpected
        matchesStatus = false;
      }
    }

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


        {/* Admin Activity/Session Stats */}
        {adminStats && (
          <SimpleGrid columns={{ base: 2, md: 5 }} spacing={6} mb={6}>
            <StatCard label="Aktivitas Hari Ini" value={adminStats.today?.total_activities ?? 0} colorScheme="teal" />
            <StatCard label="Login Hari Ini" value={adminStats.today?.logins ?? 0} colorScheme="cyan" />
            <StatCard label="Order Dibuat" value={adminStats.today?.orders_created ?? 0} colorScheme="green" />
            <StatCard label="Order Diupdate" value={adminStats.today?.orders_updated ?? 0} colorScheme="purple" />
            <StatCard label="Sesi Aktif" value={adminStats.active_sessions ?? 0} colorScheme="orange" />
          </SimpleGrid>
        )}

        {/* Order Stats Cards */}
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

        {/* Pagination Controls */}
        <Flex justify="space-between" align="center" mb={4} wrap="wrap" gap={4}>
          <HStack spacing={2}>
            <Text fontSize="sm" color="gray.600">
              Tampilkan:
            </Text>
            <Select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1); // Reset to first page
              }}
              size="sm"
              maxW="100px"
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
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              isDisabled={currentPage === 1}
            >
              Prev
            </Button>
            <Text fontSize="sm">
              Halaman {currentPage} dari {Math.ceil(totalOrders / itemsPerPage) || 1}
            </Text>
            <Button
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              isDisabled={currentPage >= Math.ceil(totalOrders / itemsPerPage)}
            >
              Next
            </Button>
          </HStack>

          <Text fontSize="sm" color="gray.600">
            Total: {totalOrders} pesanan
          </Text>
        </Flex>
        
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
                    <Text><strong>Metode Pengiriman:</strong> {getDeliveryMethodLabel(order)}</Text>
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
                      <Th minW="140px">Metode Pengiriman</Th>
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
                          <Td>{getDeliveryMethodLabel(order)}</Td>
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
                        <Td colSpan={10} textAlign="center">Tidak ada pesanan ditemukan</Td>
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
