import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
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
  StatGroup,
  Card,
  CardBody,
  useBreakpointValue,
  Stack,
} from '@chakra-ui/react';
import { orderService } from '../../api/orderService';
import { adminApi } from '../../api/adminApi';

// Stat card component for dashboard
function StatCard({ label, value, colorScheme = "teal" }) {
  return (
    <Stat p={4} shadow="md" border="1px" borderColor="gray.200" borderRadius="md" bg="white">
      <StatLabel color={`${colorScheme}.600`} fontWeight="medium">{label}</StatLabel>
      <StatNumber fontSize="2xl">{value}</StatNumber>
    </Stat>
  );
}

function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    paid: 0,
    shipping: 0,
  });
  const toast = useToast();
  const isMobile = useBreakpointValue({ base: true, md: false });

  // Get payment status badge
  const getPaymentStatusBadge = (status) => {
    const statusMap = {
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

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      console.log('[DEBUG] Fetching admin orders...');
      const response = await adminApi.getAdminOrders();
      console.log('[DEBUG] Admin API response:', response);
      
      if (response.error) {
        console.error('[DEBUG] API returned error:', response.error);
        throw new Error(response.error);
      }
      
      if (response.data?.success && response.data?.orders) {
        const orders = response.data.orders;
        console.log('[DEBUG] Successfully parsed orders:', orders.length, 'orders');
        setOrders(orders);
        
        // Calculate stats
        const stats = {
          total: orders.length,
          pending: orders.filter(o => o.payment_status === 'pending').length,
          paid: orders.filter(o => ['paid', 'settlement', 'capture'].includes(o.payment_status)).length,
          shipping: orders.filter(o => o.shipping_status && !['received'].includes(o.shipping_status)).length,
        };
        console.log('[DEBUG] Calculated stats:', stats);
        setStats(stats);
      } else {
        console.error('[DEBUG] Admin orders data structure unexpected:', response.data);
        console.error('[DEBUG] Expected: { success: true, orders: [...] }');
        setOrders([]);
      }
    } catch (error) {
      console.error('[DEBUG] Error fetching admin orders:', error);
      toast({
        title: "Error mengambil daftar pesanan",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter orders based on search term and status filter
  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      searchTerm === '' || 
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === '' || 
      order.payment_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
  
  console.log('[DEBUG] Filtered orders:', filteredOrders.length, 'out of', orders.length, 'total orders');

  return (
    <Container maxW="container.xl" p={0}>
      <Box mb={8}>
        <Heading size="lg" mb={6}>Manajemen Pesanan</Heading>
        
        {/* Dashboard Stats */}
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={8}>
          <StatCard label="Total Pesanan" value={stats.total} />
          <StatCard label="Menunggu Pembayaran" value={stats.pending} colorScheme="yellow" />
          <StatCard label="Sudah Dibayar" value={stats.paid} colorScheme="green" />
          <StatCard label="Dalam Pengiriman" value={stats.shipping} colorScheme="orange" />
        </SimpleGrid>
        
        {/* Filters */}
        <HStack mb={6} spacing={4} flexDir={{ base: "column", md: "row" }} alignItems={{ base: "stretch", md: "center" }}>
          <Input 
            placeholder="Cari pesanan, nama, atau email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            mb={{ base: 2, md: 0 }}
          />
          <Select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            mb={{ base: 2, md: 0 }}
          >
            <option value="">Semua Status</option>
            <option value="pending">Menunggu Pembayaran</option>
            <option value="settlement">Sudah Dibayar</option>
            <option value="dikemas">Dikemas</option>
            <option value="siap kirim">Siap Kirim</option>
            <option value="dikirim">Dikirim</option>
            <option value="received">Diterima</option>
          </Select>
          <Button 
            colorScheme="teal" 
            onClick={fetchOrders}
            flexShrink={0}
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
                  filteredOrders.map(order => (
                    <Card key={order.id}>
                      <CardBody>
                        <Stack spacing={3}>
                          <Flex justify="space-between">
                            <Text fontWeight="bold">#{order.id.substring(0, 8)}</Text>
                            <Text>{new Date(order.created_at).getDate().toString().padStart(2, '0')}-{(new Date(order.created_at).getMonth() + 1).toString().padStart(2, '0')}-{new Date(order.created_at).getFullYear()}</Text>
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
                      filteredOrders.map(order => (
                        <Tr key={order.id}>
                          <Td>#{order.id.substring(0, 8)}</Td>
                          <Td>{new Date(order.created_at).getDate().toString().padStart(2, '0')}-{(new Date(order.created_at).getMonth() + 1).toString().padStart(2, '0')}-{new Date(order.created_at).getFullYear()}</Td>
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
}

export default AdminOrdersPage;
