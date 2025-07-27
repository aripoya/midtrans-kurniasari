import React, { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
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
  IconButton,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  useColorModeValue,
} from '@chakra-ui/react';
import { ArrowBackIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { useAuth } from '../../auth/AuthContext';
import { formatDate } from '../../utils/date';

// TypeScript interfaces
interface Order {
  id: string;
  created_at: string;
  customer_name: string;
  total_amount: number;
  payment_status: 'pending' | 'settlement' | 'capture' | 'paid' | 'deny' | 'cancel' | 'expire' | 'failure';
  shipping_status: string;
  customer_address?: string;
  outlet_id?: string;
  [key: string]: any;
}

interface OrderStats {
  total: number;
  pending: number;
  paid: number;
  shipping: number;
}

interface PaymentStatusInfo {
  color: string;
  text: string;
}

interface ShippingStatusInfo {
  color: string;
  text: string;
}

const OutletAdminView: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    paid: 0,
    shipping: 0,
  });
  const toast = useToast();
  const isMobile = useBreakpointValue({ base: true, md: false });
  const cardBgColor = useColorModeValue('white', 'gray.700');

  // Get payment status badge
  const getPaymentStatusBadge = (status: string): JSX.Element => {
    const statusMap: Record<string, PaymentStatusInfo> = {
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
  const getShippingStatusBadge = (status: string): JSX.Element => {
    const statusMap: Record<string, ShippingStatusInfo> = {
      "dikemas": { color: "blue", text: "Dikemas" },
      "siap kirim": { color: "purple", text: "Siap Kirim" },
      "dikirim": { color: "orange", text: "Dikirim" },
      "sedang dikirim": { color: "orange", text: "Sedang Dikirim" },
      "delivered": { color: "green", text: "Diterima" },
      "received": { color: "green", text: "Diterima" },
    };

    const statusInfo = statusMap[status?.toLowerCase()] || { color: "gray", text: status || "Menunggu Diproses" };
    return <Badge colorScheme={statusInfo.color}>{statusInfo.text}</Badge>;
  };

  // Fetch outlet orders using the same endpoint as outlet dashboard
  const fetchOrders = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'https://order-management-app-production.wahwooh.workers.dev'}/api/orders/outlet`,
        {
          headers: {
            'Authorization': `Bearer ${sessionStorage.getItem('token')}`
          }
        }
      );
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        const orderList: Order[] = data.data || [];
        setOrders(orderList);
        
        // Calculate stats
        const stats: OrderStats = {
          total: orderList.length,
          pending: orderList.filter(o => 
            o.payment_status !== 'settlement' && o.payment_status !== 'capture').length,
          paid: orderList.filter(o => 
            ['paid', 'settlement', 'capture'].includes(o.payment_status)).length,
          shipping: orderList.filter(o => 
            (o.payment_status === 'settlement' || o.payment_status === 'capture') && 
            o.shipping_status !== 'delivered').length,
        };
        setStats(stats);
      } else {
        throw new Error(data.message || 'Failed to fetch orders');
      }
    } catch (error: any) {
      console.error('Error fetching outlet orders:', error);
      toast({
        title: 'Error',
        description: 'Gagal memuat daftar pesanan.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Update shipping status function
  const updateShippingStatus = async (orderId: string, newStatus: string): Promise<void> => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'https://order-management-app-production.wahwooh.workers.dev'}/api/orders/${orderId}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('token')}`
          },
          body: JSON.stringify({
            shipping_status: newStatus
          })
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        // Update local state
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order.id === orderId 
              ? { ...order, shipping_status: newStatus }
              : order
          )
        );

        toast({
          title: 'Berhasil',
          description: `Status pengiriman berhasil diubah menjadi ${newStatus}`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });

        // Refresh orders to get updated stats
        await fetchOrders();
      } else {
        throw new Error(data.message || 'Failed to update shipping status');
      }
    } catch (error: any) {
      console.error('Error updating shipping status:', error);
      toast({
        title: 'Error',
        description: 'Gagal mengubah status pengiriman.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Filter orders based on search term and status
  const filteredOrders = useMemo((): Order[] => {
    return orders.filter(order => {
      const matchesSearch = !searchTerm || 
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = !statusFilter || 
        order.payment_status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  return (
    <Container maxW="container.xl" py={8}>
      <Box mb={6}>
        {/* Breadcrumb */}
        <Breadcrumb spacing="8px" separator={<ChevronRightIcon color="gray.500" />} mb={4}>
          <BreadcrumbItem>
            <BreadcrumbLink as={RouterLink} to="/outlet">
              Dashboard Outlet
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbItem isCurrentPage>
            <BreadcrumbLink href="#">Admin View</BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>

        {/* Header */}
        <Flex justifyContent="space-between" alignItems="center" mb={6}>
          <Heading size="lg">Admin View - Outlet Orders</Heading>
          <Button
            leftIcon={<ArrowBackIcon />}
            variant="outline"
            onClick={() => navigate('/outlet')}
          >
            Kembali ke Dashboard
          </Button>
        </Flex>

        {/* Stats Cards */}
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={6} mb={8}>
          <Card bg={cardBgColor}>
            <CardBody>
              <Stat>
                <StatLabel color="blue.600" fontWeight="medium">Total Pesanan</StatLabel>
                <StatNumber fontSize="2xl">{stats.total}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card bg={cardBgColor}>
            <CardBody>
              <Stat>
                <StatLabel color="yellow.600" fontWeight="medium">Menunggu Bayar</StatLabel>
                <StatNumber fontSize="2xl">{stats.pending}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card bg={cardBgColor}>
            <CardBody>
              <Stat>
                <StatLabel color="green.600" fontWeight="medium">Dibayar</StatLabel>
                <StatNumber fontSize="2xl">{stats.paid}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card bg={cardBgColor}>
            <CardBody>
              <Stat>
                <StatLabel color="purple.600" fontWeight="medium">Dalam Pengiriman</StatLabel>
                <StatNumber fontSize="2xl">{stats.shipping}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Search and Filter */}
        <HStack spacing={4} mb={6}>
          <Input
            placeholder="Cari berdasarkan ID pesanan atau nama pelanggan..."
            value={searchTerm}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            maxW="400px"
          />
          <Select
            placeholder="Semua Status"
            value={statusFilter}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
            maxW="200px"
          >
            <option value="pending">Menunggu Pembayaran</option>
            <option value="settlement">Dibayar</option>
            <option value="capture">Dibayar</option>
          </Select>
          <Button 
            colorScheme="teal" 
            onClick={fetchOrders}
            isLoading={loading}
          >
            Refresh
          </Button>
        </HStack>
        
        {loading ? (
          <Flex justify="center" align="center" height="200px">
            <Spinner size="xl" />
          </Flex>
        ) : (
          <Box overflowX="auto">
            <Table variant="simple" bg={cardBgColor}>
              <Thead>
                <Tr>
                  <Th>ID Pesanan</Th>
                  <Th>Tanggal</Th>
                  <Th>Pelanggan</Th>
                  <Th>Total</Th>
                  <Th>Status Pembayaran</Th>
                  <Th>Status Pengiriman</Th>
                  <Th>Aksi</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredOrders.length > 0 ? (
                  filteredOrders.map(order => (
                    <Tr key={order.id}>
                      <Td fontWeight="medium">{order.id}</Td>
                      <Td>{formatDate(order.created_at)}</Td>
                      <Td>{order.customer_name}</Td>
                      <Td>Rp {order.total_amount?.toLocaleString('id-ID')}</Td>
                      <Td>{getPaymentStatusBadge(order.payment_status)}</Td>
                      <Td>{getShippingStatusBadge(order.shipping_status)}</Td>
                      <Td>
                        <HStack spacing={2}>
                          <Button
                            size="sm"
                            colorScheme="blue"
                            onClick={() => navigate(`/outlet/orders/${order.id}`)}
                          >
                            Detail
                          </Button>
                          
                          {(order.payment_status === 'settlement' || order.payment_status === 'capture') && (
                            <Select 
                              size="sm" 
                              width="150px"
                              value={order.shipping_status}
                              onChange={(e: ChangeEvent<HTMLSelectElement>) => updateShippingStatus(order.id, e.target.value)}
                            >
                              <option value="dikemas">Dikemas</option>
                              <option value="siap kirim">Siap Kirim</option>
                              <option value="dikirim">Dikirim</option>
                              <option value="delivered">Diterima</option>
                            </Select>
                          )}
                        </HStack>
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
      </Box>
    </Container>
  );
};

export default OutletAdminView;
