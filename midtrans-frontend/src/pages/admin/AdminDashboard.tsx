import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Heading,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Card,
  CardHeader,
  CardBody,
  Button,
  HStack,
  VStack,
  Text,
  Divider,
  Badge,
  useToast,
  Spinner,
  Alert,
  AlertIcon,
  Icon,
  Flex,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import {
  FiShoppingCart,
  FiDollarSign,
  FiPackage,
  FiTrendingUp,
  FiUsers,
  FiActivity,
  FiTrash2,
  FiPlus,
  FiList,
} from 'react-icons/fi';
import { adminApi } from '../../api/adminApi';

interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  completedOrders: number;
  deletedOrders: number;
  todayOrders: number;
  monthRevenue: number;
  revenueGrowth: number;
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch orders data
      const ordersResponse = await adminApi.getAdminOrders(0, 1000);
      
      console.log('[AdminDashboard] Orders response:', ordersResponse);
      
      if (!ordersResponse.success) {
        throw new Error(ordersResponse.error || 'Failed to fetch orders');
      }

      // Handle different response structures
      const orders: any[] = ordersResponse.data?.orders || (ordersResponse as any).orders || [];
      
      console.log('[AdminDashboard] Orders count:', orders.length);
      
      // Fetch deleted orders count
      let deletedCount = 0;
      try {
        const deletedResponse = await fetch(
          `${import.meta.env.VITE_API_URL || 'https://order-management-app-production.wahwooh.workers.dev'}/api/orders/deleted/list?limit=1`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );
        const deletedData = await deletedResponse.json();
        deletedCount = deletedData.pagination?.total || 0;
      } catch (e) {
        console.log('Could not fetch deleted orders count');
      }

      // Helper function to check if payment is completed
      const isPaid = (paymentStatus: string) => {
        const status = paymentStatus?.toLowerCase() || '';
        return status === 'settlement' || 
               status === 'paid' || 
               status === 'capture' || 
               status === 'success' ||
               status === 'dibayar';
      };

      // Filter only paid orders for revenue calculation
      const paidOrders = orders.filter((order: any) => isPaid(order.payment_status));

      // Calculate statistics
      const totalOrders = orders.length;
      const totalRevenue = paidOrders.reduce((sum: number, order: any) => sum + (Number(order.total_amount) || 0), 0);
      const pendingOrders = orders.filter((order: any) => 
        order.payment_status?.toLowerCase() === 'pending' || 
        order.payment_status?.toLowerCase() === 'menunggu pembayaran'
      ).length;
      const completedOrders = orders.filter((order: any) => 
        order.shipping_status?.toLowerCase() === 'diterima' || 
        order.shipping_status?.toLowerCase() === 'received'
      ).length;

      // Today's orders
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayOrders = orders.filter((order: any) => {
        const orderDate = new Date(order.created_at);
        return orderDate >= today;
      }).length;

      // This month's revenue (only from paid orders)
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);
      const monthRevenue = paidOrders
        .filter((order: any) => new Date(order.created_at) >= thisMonth)
        .reduce((sum: number, order: any) => sum + (Number(order.total_amount) || 0), 0);

      // Calculate growth (mock data for now)
      const revenueGrowth = 12.5; // This could be calculated by comparing with last month

      setStats({
        totalOrders,
        totalRevenue,
        pendingOrders,
        completedOrders,
        deletedOrders: deletedCount,
        todayOrders,
        monthRevenue,
        revenueGrowth,
      });
    } catch (err: any) {
      console.error('Error fetching dashboard stats:', err);
      setError(err.message || 'Failed to load dashboard statistics');
      toast({
        title: 'Error',
        description: 'Gagal memuat statistik dashboard',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <Container maxW="container.xl" py={8}>
        <Flex justify="center" align="center" minH="400px">
          <VStack spacing={4}>
            <Spinner size="xl" color="blue.500" thickness="4px" />
            <Text>Memuat dashboard...</Text>
          </VStack>
        </Flex>
      </Container>
    );
  }

  if (error || !stats) {
    return (
      <Container maxW="container.xl" py={8}>
        <Alert status="error">
          <AlertIcon />
          {error || 'Gagal memuat data dashboard'}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxW="container.xl" py={8}>
      {/* Header */}
      <VStack align="stretch" spacing={6} mb={8}>
        <Box>
          <Heading size="lg" mb={2}>Dashboard Admin</Heading>
          <Text color="gray.600">Selamat datang di sistem manajemen pesanan Kurniasari</Text>
        </Box>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <Heading size="md">Aksi Cepat</Heading>
          </CardHeader>
          <CardBody>
            <HStack spacing={4} flexWrap="wrap">
              <Button
                as={RouterLink}
                to="/admin/orders/new"
                leftIcon={<Icon as={FiPlus} />}
                colorScheme="blue"
                size="lg"
              >
                Buat Pesanan Baru
              </Button>
              <Button
                as={RouterLink}
                to="/admin/orders"
                leftIcon={<Icon as={FiList} />}
                colorScheme="green"
                variant="outline"
                size="lg"
              >
                Lihat Semua Pesanan
              </Button>
              <Button
                as={RouterLink}
                to="/admin/activity"
                leftIcon={<Icon as={FiActivity} />}
                colorScheme="purple"
                variant="outline"
                size="lg"
              >
                Aktivitas Admin
              </Button>
              {stats.deletedOrders > 0 && (
                <Button
                  onClick={() => {
                    toast({
                      title: 'Recycle Bin',
                      description: `Ada ${stats.deletedOrders} pesanan yang terhapus. Fitur UI recycle bin akan segera hadir.`,
                      status: 'info',
                      duration: 5000,
                      isClosable: true,
                    });
                  }}
                  leftIcon={<Icon as={FiTrash2} />}
                  colorScheme="orange"
                  variant="outline"
                  size="lg"
                >
                  Recycle Bin ({stats.deletedOrders})
                </Button>
              )}
            </HStack>
          </CardBody>
        </Card>
      </VStack>

      {/* Statistics Grid */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={8}>
        {/* Total Orders */}
        <Card>
          <CardBody>
            <Stat>
              <HStack justify="space-between" mb={2}>
                <StatLabel>Total Pesanan</StatLabel>
                <Icon as={FiShoppingCart} boxSize={6} color="blue.500" />
              </HStack>
              <StatNumber fontSize="3xl">{stats.totalOrders}</StatNumber>
              <StatHelpText>
                <Badge colorScheme="green">{stats.todayOrders} hari ini</Badge>
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        {/* Total Revenue */}
        <Card>
          <CardBody>
            <Stat>
              <HStack justify="space-between" mb={2}>
                <StatLabel>Total Pendapatan</StatLabel>
                <Box 
                  fontSize="2xl" 
                  fontWeight="bold" 
                  color="green.500"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  w="8"
                  h="8"
                >
                  Rp
                </Box>
              </HStack>
              <StatNumber fontSize="2xl">{formatCurrency(stats.totalRevenue)}</StatNumber>
              <StatHelpText>
                <Badge colorScheme="green">Sudah dibayar</Badge>
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        {/* Pending Orders */}
        <Card>
          <CardBody>
            <Stat>
              <HStack justify="space-between" mb={2}>
                <StatLabel>Menunggu Pembayaran</StatLabel>
                <Icon as={FiPackage} boxSize={6} color="orange.500" />
              </HStack>
              <StatNumber fontSize="3xl">{stats.pendingOrders}</StatNumber>
              <StatHelpText>
                <Badge colorScheme="orange">Perlu diproses</Badge>
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>

        {/* Completed Orders */}
        <Card>
          <CardBody>
            <Stat>
              <HStack justify="space-between" mb={2}>
                <StatLabel>Pesanan Selesai</StatLabel>
                <Icon as={FiTrendingUp} boxSize={6} color="purple.500" />
              </HStack>
              <StatNumber fontSize="3xl">{stats.completedOrders}</StatNumber>
              <StatHelpText>
                <Badge colorScheme="purple">Diterima pelanggan</Badge>
              </StatHelpText>
            </Stat>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Revenue Overview */}
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
        {/* Monthly Revenue */}
        <Card>
          <CardHeader>
            <Heading size="md">Pendapatan Bulan Ini</Heading>
          </CardHeader>
          <CardBody>
            <VStack align="stretch" spacing={4}>
              <Box>
                <Text fontSize="3xl" fontWeight="bold" color="green.600">
                  {formatCurrency(stats.monthRevenue)}
                </Text>
                <Text color="gray.600" fontSize="sm">
                  Total pendapatan bulan {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                </Text>
              </Box>
              <Divider />
              <HStack justify="space-between">
                <Text fontSize="sm" color="gray.600">Rata-rata per hari</Text>
                <Text fontWeight="semibold">
                  {formatCurrency(stats.monthRevenue / new Date().getDate())}
                </Text>
              </HStack>
            </VStack>
          </CardBody>
        </Card>

        {/* System Status */}
        <Card>
          <CardHeader>
            <Heading size="md">Status Sistem</Heading>
          </CardHeader>
          <CardBody>
            <VStack align="stretch" spacing={3}>
              <HStack justify="space-between">
                <HStack>
                  <Icon as={FiShoppingCart} color="green.500" />
                  <Text>Sistem Pesanan</Text>
                </HStack>
                <Badge colorScheme="green">Aktif</Badge>
              </HStack>
              <Divider />
              <HStack justify="space-between">
                <HStack>
                  <Icon as={FiDollarSign} color="green.500" />
                  <Text>Payment Gateway</Text>
                </HStack>
                <Badge colorScheme="green">Midtrans</Badge>
              </HStack>
              <Divider />
              <HStack justify="space-between">
                <HStack>
                  <Icon as={FiTrash2} color="blue.500" />
                  <Text>Soft Delete</Text>
                </HStack>
                <Badge colorScheme="blue">Aktif</Badge>
              </HStack>
              <Divider />
              <HStack justify="space-between">
                <HStack>
                  <Icon as={FiUsers} color="purple.500" />
                  <Text>Total Users</Text>
                </HStack>
                <Badge colorScheme="purple">Multi-Role</Badge>
              </HStack>
            </VStack>
          </CardBody>
        </Card>
      </SimpleGrid>

      {/* Info Alert */}
      {stats.deletedOrders > 0 && (
        <Alert status="info" mt={6} borderRadius="md">
          <AlertIcon />
          <VStack align="start" spacing={1}>
            <Text fontWeight="semibold">
              Sistem Soft Delete Aktif
            </Text>
            <Text fontSize="sm">
              Ada {stats.deletedOrders} pesanan di recycle bin yang dapat di-restore kapan saja.
            </Text>
          </VStack>
        </Alert>
      )}
    </Container>
  );
};

export default AdminDashboard;
