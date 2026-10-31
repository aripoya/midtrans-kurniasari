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
  Link,
  Textarea,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
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
import { adminApi, type AiChatHistoryItem } from '../../api/adminApi';
import { API_URL } from '../../api/config';
import RevenueChart from '../../components/RevenueChart';

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

interface RevenueData {
  period: string;
  revenue: number;
  orders: number;
}

type ChatItem = AiChatHistoryItem;

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState<RevenueData[]>([]);
  const [weeklyRevenue, setWeeklyRevenue] = useState<RevenueData[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const [aiInput, setAiInput] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [chatHistory, setChatHistory] = useState<ChatItem[]>([]);

  useEffect(() => {
    fetchDashboardStats();
    fetchRevenueChartData();
  }, []);

  const fetchRevenueChartData = async () => {
    try {
      setChartLoading(true);
      
      // Fetch monthly and weekly revenue data
      const [monthlyRes, weeklyRes] = await Promise.all([
        adminApi.getRevenueStats('monthly'),
        adminApi.getRevenueStats('weekly')
      ]);
      
      if (monthlyRes.success && monthlyRes.data) {
        setMonthlyRevenue(monthlyRes.data);
      }
      
      if (weeklyRes.success && weeklyRes.data) {
        setWeeklyRevenue(weeklyRes.data);
      }
    } catch (err) {
      console.error('Error fetching revenue chart data:', err);
    } finally {
      setChartLoading(false);
    }
  };

  const handleSendAi = async () => {
    const message = aiInput.trim();
    if (!message) return;

    setAiError(null);
    setAiLoading(true);
    const outgoingHistory: ChatItem[] = [...chatHistory, { role: 'user', content: message }];
    setChatHistory(outgoingHistory);
    setAiInput('');

    try {
      const res = await adminApi.aiChat(message, outgoingHistory);
      if (!res.success || !res.data) {
        const errMsg = res.error || 'Gagal memanggil AI';
        setAiError(errMsg);
        setChatHistory((prev) => [...prev, { role: 'assistant', content: errMsg }]);
        return;
      }

      setAiResponse(res.data);
      const assistantText = res.data.message || 'OK';
      setChatHistory((prev) => [...prev, { role: 'assistant', content: assistantText }]);
    } catch (e: any) {
      const errMsg = e?.message || 'Gagal memanggil AI';
      setAiError(errMsg);
      setChatHistory((prev) => [...prev, { role: 'assistant', content: errMsg }]);
    } finally {
      setAiLoading(false);
    }
  };

  const renderAiResult = () => {
    if (!aiResponse) return null;

    const renderTable = (rows: any[]) => {
      const keys = rows.length > 0 ? Object.keys(rows[0] || {}) : [];

      if (rows.length === 0) {
        return (
          <Box>
            <Text fontSize="sm" color="gray.600">Tidak ada data untuk ditampilkan</Text>
          </Box>
        );
      }

      return (
        <Box overflowX="auto" borderWidth={1} borderRadius="md">
          <Table size="sm">
            <Thead>
              <Tr>
                {keys.slice(0, 8).map((k) => (
                  <Th key={k}>{k}</Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {rows.slice(0, 20).map((r, idx) => (
                <Tr key={idx}>
                  {keys.slice(0, 8).map((k) => (
                    <Td key={k} maxW="240px" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                      {(() => {
                        const val = r?.[k];

                        const key = String(k || '').toLowerCase();
                        const isOrderIdKey = key === 'id' || key === 'order_id' || key === 'orderid' || key === 'order_ids';

                        const renderOrderLink = (orderId: string, index: number) => (
                          <Link
                            key={`${orderId}-${index}`}
                            as={RouterLink}
                            to={`/admin/orders/${orderId}`}
                            color="teal.600"
                            fontWeight="semibold"
                            isExternal={false}
                          >
                            {orderId}
                          </Link>
                        );

                        if (isOrderIdKey) {
                          const s = String(val ?? '');
                          if (/^ORDER-[A-Za-z0-9-]+$/.test(s)) {
                            return renderOrderLink(s, 0);
                          }

                          if (s.includes('ORDER-')) {
                            const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
                            const orderParts = parts.filter((p) => /^ORDER-[A-Za-z0-9-]+$/.test(p));
                            if (orderParts.length > 0) {
                              return (
                                <>
                                  {orderParts.map((oid, i) => (
                                    <React.Fragment key={oid}>
                                      {i > 0 ? <Text as="span">, </Text> : null}
                                      {renderOrderLink(oid, i)}
                                    </React.Fragment>
                                  ))}
                                </>
                              );
                            }
                          }
                        }

                        return val === null || val === undefined ? '' : String(val);
                      })()}
                    </Td>
                  ))}
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      );
    };


    if (aiResponse.intent === 'analysis') {
      const sections: any[] = Array.isArray(aiResponse.data?.sections) ? aiResponse.data.sections : [];
      return (
        <VStack align="stretch" spacing={4}>
          {sections.length === 0 ? (
            <Text fontSize="sm" color="gray.600">Tidak ada data analisis untuk ditampilkan</Text>
          ) : (
            sections.map((s, idx) => (
              <Box key={s?.key || idx}>
                <Text fontSize="sm" fontWeight="semibold" mb={2}>{s?.title || `Section ${idx + 1}`}</Text>
                {renderTable(Array.isArray(s?.rows) ? s.rows : [])}
              </Box>
            ))
          )}
        </VStack>
      );
    }

    const rows: any[] = Array.isArray(aiResponse.data) ? aiResponse.data : [];
    return (
      <VStack align="stretch" spacing={3}>
        {renderTable(rows)}
      </VStack>
    );
  };

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch orders data - use large limit to get all orders for dashboard stats
      const ordersResponse = await adminApi.getAdminOrders(0, 10000);
      
      console.log('[AdminDashboard] Orders response:', ordersResponse);
      
      if (!ordersResponse.success) {
        throw new Error(ordersResponse.error || 'Failed to fetch orders');
      }

      // Handle different response structures
      const orders: any[] = ordersResponse.data?.orders || (ordersResponse as any).orders || [];
      
      console.log('[AdminDashboard] Orders count:', orders.length);
      
      // Fetch deleted orders count using API_URL from config (not hardcoded)
      let deletedCount = 0;
      try {
        const deletedResponse = await fetch(
          `${API_URL}/api/orders/deleted/list?limit=1`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json',
            },
          }
        );
        const deletedData = await deletedResponse.json();
        deletedCount = deletedData.pagination?.total || 0;
      } catch (e) {
        console.log('Could not fetch deleted orders count:', e);
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
      
      // Check if error is authentication related (401 Unauthorized)
      if (err.response?.status === 401 || err.message?.includes('token') || err.message?.includes('Invalid token')) {
        console.error('Authentication error detected - clearing token and redirecting to login');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        toast({
          title: 'Session Expired',
          description: 'Sesi Anda telah berakhir. Silakan login kembali.',
          status: 'warning',
          duration: 3000,
          isClosable: true,
        });
        // Redirect to login after short delay
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
        return;
      }
      
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

      {/* Revenue Charts Section */}
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} mt={6}>
        {/* Monthly Revenue Chart */}
        <Card>
          <CardHeader>
            <Heading size="md">
              <Icon as={FiTrendingUp} mr={2} />
              Grafik Pendapatan Bulanan
            </Heading>
          </CardHeader>
          <CardBody>
            {chartLoading ? (
              <Flex justify="center" align="center" h="300px">
                <Spinner size="xl" color="green.500" />
              </Flex>
            ) : monthlyRevenue.length > 0 ? (
              <RevenueChart 
                data={monthlyRevenue}
                title="12 Bulan Terakhir"
              />
            ) : (
              <Flex justify="center" align="center" h="300px">
                <Text color="gray.500">Tidak ada data pendapatan bulanan</Text>
              </Flex>
            )}
          </CardBody>
        </Card>

        {/* Weekly Revenue Chart */}
        <Card>
          <CardHeader>
            <Heading size="md">
              <Icon as={FiActivity} mr={2} />
              Grafik Pendapatan Mingguan
            </Heading>
          </CardHeader>
          <CardBody>
            {chartLoading ? (
              <Flex justify="center" align="center" h="300px">
                <Spinner size="xl" color="green.500" />
              </Flex>
            ) : weeklyRevenue.length > 0 ? (
              <RevenueChart 
                data={weeklyRevenue}
                title="8 Minggu Terakhir"
              />
            ) : (
              <Flex justify="center" align="center" h="300px">
                <Text color="gray.500">Tidak ada data pendapatan mingguan</Text>
              </Flex>
            )}
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

      <Card mt={6}>
        <CardHeader>
          <Heading size="md">AI Assistant</Heading>
        </CardHeader>
        <CardBody>
          <VStack align="stretch" spacing={4}>
            {aiError && (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                {aiError}
              </Alert>
            )}

            <Box maxH="220px" overflowY="auto" borderWidth={1} borderRadius="md" p={3}>
              <VStack align="stretch" spacing={2}>
                {chatHistory.length === 0 ? (
                  <Text color="gray.500" fontSize="sm">
                    Tanyakan misalnya: "tampilkan 5 pesanan terbaru", "cari pesanan Budi", "pesanan hari ini"
                  </Text>
                ) : (
                  chatHistory.map((item, idx) => (
                    <Box key={idx}>
                      <Text fontSize="xs" color="gray.500" mb={1}>
                        {item.role === 'user' ? 'Kamu' : 'AI'}
                      </Text>
                      <Text whiteSpace="pre-wrap">{item.content}</Text>
                    </Box>
                  ))
                )}
              </VStack>
            </Box>

            <HStack align="start" spacing={3}>
              <Textarea
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Tulis pertanyaan untuk AI..."
                rows={3}
              />
              <Button
                colorScheme="teal"
                onClick={handleSendAi}
                isLoading={aiLoading}
                loadingText="Memproses"
              >
                Kirim
              </Button>
            </HStack>

            {aiResponse && (
              <Box>
                <Divider mb={4} />
                <Heading size="sm" mb={2}>Hasil</Heading>
                {renderAiResult()}
              </Box>
            )}
          </VStack>
        </CardBody>
      </Card>
    </Container>
  );
};

export default AdminDashboard;
