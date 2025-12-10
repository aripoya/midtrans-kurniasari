import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Card,
  CardHeader,
  CardBody,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Input,
  Select,
  Button,
  HStack,
  VStack,
  Text,
  Spinner,
  useToast,
  Flex,
  Icon,
  Divider,
} from '@chakra-ui/react';
import { FiPackage, FiDollarSign, FiTruck, FiCalendar, FiSearch, FiDownload } from 'react-icons/fi';
import { adminApi } from '../../api/adminApi';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Stats {
  total: {
    orders: number;
    revenue: number;
    revenue_formatted: string;
  };
  by_payment_status: Array<{
    status: string;
    count: number;
    revenue: number;
    revenue_formatted: string;
  }>;
  by_shipping_status: Array<{
    status: string;
    count: number;
  }>;
  by_courier: Array<{
    courier: string;
    count: number;
    revenue: number;
    revenue_formatted: string;
  }>;
  monthly_trend: Array<{
    month: string;
    count: number;
    revenue: number;
    revenue_formatted: string;
  }>;
}

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  total_amount: number;
  total_amount_formatted: string;
  payment_status: string;
  shipping_status: string;
  courier_service: string;
  tracking_number: string;
  created_at: string;
}

const LuarKotaReportPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [shippingStatusFilter, setShippingStatusFilter] = useState('');
  const [courierFilter, setCourierFilter] = useState('');

  // Pagination
  const [offset, setOffset] = useState(0);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Fetch statistics
  useEffect(() => {
    fetchStats();
  }, []);

  // Fetch orders
  useEffect(() => {
    fetchOrders();
  }, [offset, searchQuery, paymentStatusFilter, shippingStatusFilter, courierFilter]);

  const fetchStats = async () => {
    try {
      const response = await adminApi.getLuarKotaStats();
      if (response.success && response.data) {
        setStats(response.data);
      } else {
        toast({
          title: 'Error',
          description: response.error || 'Gagal memuat statistik',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast({
        title: 'Error',
        description: 'Terjadi kesalahan saat memuat statistik',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const response = await adminApi.getLuarKotaOrders({
        offset,
        limit,
        payment_status: paymentStatusFilter || undefined,
        shipping_status: shippingStatusFilter || undefined,
        courier_service: courierFilter || undefined,
        search: searchQuery || undefined,
      });

      if (response.success) {
        setOrders((response as any).orders || []);
        setTotal((response as any).total || 0);
        setHasMore((response as any).has_more || false);
      } else {
        toast({
          title: 'Error',
          description: response.error || 'Gagal memuat daftar pesanan',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: 'Error',
        description: 'Terjadi kesalahan saat memuat daftar pesanan',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleSearch = () => {
    setOffset(0);
    fetchOrders();
  };

  const handleReset = () => {
    setSearchQuery('');
    setPaymentStatusFilter('');
    setShippingStatusFilter('');
    setCourierFilter('');
    setOffset(0);
  };

  const handleExportPDF = async () => {
    try {
      // Show loading toast
      const loadingToast = toast({
        title: 'Mengunduh Data...',
        description: 'Sedang mengambil semua data pesanan luar kota',
        status: 'info',
        duration: null,
        isClosable: false,
      });

      // Fetch ALL orders with same filters but no pagination limit
      const response = await adminApi.getLuarKotaOrders({
        offset: 0,
        limit: 10000, // Large limit to get all data
        payment_status: paymentStatusFilter || undefined,
        shipping_status: shippingStatusFilter || undefined,
        courier_service: courierFilter || undefined,
        search: searchQuery || undefined,
      });

      // Close loading toast
      toast.close(loadingToast);

      if (!response.success) {
        toast({
          title: 'Error',
          description: response.error || 'Gagal mengambil data',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        return;
      }

      const allOrders = (response as any).orders || [];

      if (allOrders.length === 0) {
        toast({
          title: 'Tidak Ada Data',
          description: 'Tidak ada pesanan untuk di-export',
          status: 'warning',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      // Generate PDF
      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(18);
      doc.text('Laporan Pesanan Luar Kota', 14, 20);
      
      // Subtitle with date
      doc.setFontSize(10);
      const today = new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
      doc.text(`Tanggal Export: ${today}`, 14, 28);
      
      // Statistics Summary
      if (stats) {
        doc.setFontSize(12);
        doc.text('Ringkasan Statistik', 14, 38);
        doc.setFontSize(10);
        doc.text(`Total Pesanan: ${stats.total.orders}`, 14, 45);
        doc.text(`Total Pendapatan: ${stats.total.revenue_formatted}`, 14, 52);
        
        const settledOrders = stats.by_payment_status.find((s) => s.status === 'settlement');
        if (settledOrders) {
          doc.text(`Pesanan Lunas: ${settledOrders.count} (${settledOrders.revenue_formatted})`, 14, 59);
        }
      }
      
      // Active Filters
      const activeFilters: string[] = [];
      if (searchQuery) activeFilters.push(`Pencarian: ${searchQuery}`);
      if (paymentStatusFilter) activeFilters.push(`Status Pembayaran: ${paymentStatusFilter}`);
      if (shippingStatusFilter) activeFilters.push(`Status Pengiriman: ${shippingStatusFilter}`);
      if (courierFilter) activeFilters.push(`Kurir: ${courierFilter}`);
      
      if (activeFilters.length > 0) {
        doc.text('Filter Aktif:', 14, 68);
        activeFilters.forEach((filter, index) => {
          doc.text(`- ${filter}`, 14, 75 + (index * 7));
        });
      }
      
      // Add note about total exported orders
      const noteY = activeFilters.length > 0 ? 85 + (activeFilters.length * 7) : 68;
      doc.setFontSize(10);
      doc.setTextColor(0, 128, 0); // Green color
      doc.text(`Mengekspor ${allOrders.length} pesanan dari total ${stats?.total.orders || allOrders.length} pesanan`, 14, noteY);
      doc.setTextColor(0, 0, 0); // Reset to black
      
      // Table
      const tableStartY = noteY + 10;
      
      autoTable(doc, {
        startY: tableStartY,
        head: [['ID', 'Pelanggan', 'Telepon', 'Kurir', 'Resi', 'Total', 'Pembayaran', 'Pengiriman', 'Tanggal']],
        body: allOrders.map((order: Order) => [
          order.id.split('-').pop() || order.id,
          order.customer_name,
          order.customer_phone,
          order.courier_service || '-',
          order.tracking_number || '-',
          order.total_amount_formatted,
          order.payment_status === 'settlement' ? 'Lunas' : 
            order.payment_status === 'pending' ? 'Pending' : order.payment_status,
          order.shipping_status,
          formatDate(order.created_at),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 153, 225] },
        margin: { top: 10 },
      });
      
      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Halaman ${i} dari ${pageCount}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
        doc.text(
          '© 2025 Kurniasari Order Management',
          14,
          doc.internal.pageSize.height - 10
        );
      }
      
      // Save PDF
      const filename = `Laporan-Luar-Kota-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      
      toast({
        title: 'Export Berhasil',
        description: `${allOrders.length} pesanan berhasil di-export ke ${filename}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: 'Error',
        description: 'Terjadi kesalahan saat mengekspor PDF',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      settlement: { color: 'green', label: 'Lunas' },
      pending: { color: 'yellow', label: 'Pending' },
      expire: { color: 'red', label: 'Kadaluarsa' },
      cancel: { color: 'red', label: 'Batal' },
    };
    const config = statusMap[status] || { color: 'gray', label: status };
    return <Badge colorScheme={config.color}>{config.label}</Badge>;
  };

  const getShippingStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      'pending': { color: 'gray', label: 'Pending' },
      'menunggu diproses': { color: 'gray', label: 'Menunggu' },
      'dikemas': { color: 'blue', label: 'Dikemas' },
      'siap diambil': { color: 'cyan', label: 'Siap Diambil' },
      'sudah diambil': { color: 'purple', label: 'Diambil' },
      'dalam pengiriman': { color: 'orange', label: 'Dalam Pengiriman' },
      'dikirim': { color: 'orange', label: 'Dikirim' },
      'diterima': { color: 'green', label: 'Diterima' },
      'terkirim': { color: 'green', label: 'Terkirim' },
    };
    const config = statusMap[status] || { color: 'gray', label: status };
    return <Badge colorScheme={config.color}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <Box maxW="7xl" mx="auto" p={6}>
        <Flex justify="center" align="center" h="400px">
          <Spinner size="xl" />
        </Flex>
      </Box>
    );
  }

  return (
    <Box maxW="7xl" mx="auto" p={6}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Box>
          <Heading size="lg" mb={2}>
            Laporan Pesanan Luar Kota
          </Heading>
          <Text color="gray.600">
            Statistik dan daftar lengkap pesanan pengiriman luar kota
          </Text>
        </Box>

        {/* Statistics Cards */}
        {stats && (
          <>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
              {/* Total Orders */}
              <Card>
                <CardBody>
                  <Stat>
                    <StatLabel>
                      <HStack>
                        <Icon as={FiPackage} />
                        <Text>Total Pesanan</Text>
                      </HStack>
                    </StatLabel>
                    <StatNumber>{stats.total.orders}</StatNumber>
                    <StatHelpText>Pesanan luar kota</StatHelpText>
                  </Stat>
                </CardBody>
              </Card>

              {/* Total Revenue */}
              <Card>
                <CardBody>
                  <Stat>
                    <StatLabel>
                      <HStack>
                        <Text fontWeight="bold" fontSize="lg" color="purple.600">
                          Rp
                        </Text>
                        <Text>Total Pendapatan</Text>
                      </HStack>
                    </StatLabel>
                    <StatNumber fontSize="2xl">
                      {stats.total.revenue_formatted}
                    </StatNumber>
                    <StatHelpText>Dari semua pesanan</StatHelpText>
                  </Stat>
                </CardBody>
              </Card>

              {/* Settlement Orders */}
              <Card>
                <CardBody>
                  <Stat>
                    <StatLabel>
                      <HStack>
                        <Icon as={FiDollarSign} color="green.500" />
                        <Text>Pesanan Lunas</Text>
                      </HStack>
                    </StatLabel>
                    <StatNumber>
                      {stats.by_payment_status.find((s) => s.status === 'settlement')
                        ?.count || 0}
                    </StatNumber>
                    <StatHelpText>
                      {stats.by_payment_status.find((s) => s.status === 'settlement')
                        ?.revenue_formatted || 'Rp 0'}
                    </StatHelpText>
                  </Stat>
                </CardBody>
              </Card>

              {/* Delivered Orders */}
              <Card>
                <CardBody>
                  <Stat>
                    <StatLabel>
                      <HStack>
                        <Icon as={FiTruck} color="green.500" />
                        <Text>Pesanan Terkirim</Text>
                      </HStack>
                    </StatLabel>
                    <StatNumber>
                      {stats.by_shipping_status.find((s) => s.status === 'diterima')
                        ?.count || 0}
                    </StatNumber>
                    <StatHelpText>Sudah diterima pelanggan</StatHelpText>
                  </Stat>
                </CardBody>
              </Card>
            </SimpleGrid>

            {/* Courier Services Breakdown */}
            {stats.by_courier.length > 0 && (
              <Card>
                <CardHeader>
                  <Heading size="md">Breakdown per Jasa Kurir</Heading>
                </CardHeader>
                <CardBody>
                  <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                    {stats.by_courier.map((courier) => (
                      <Box key={courier.courier} p={4} borderWidth="1px" borderRadius="md">
                        <Text fontWeight="bold" mb={2}>
                          {courier.courier}
                        </Text>
                        <Text fontSize="sm" color="gray.600">
                          {courier.count} pesanan
                        </Text>
                        <Text fontSize="lg" fontWeight="bold" color="purple.600">
                          {courier.revenue_formatted}
                        </Text>
                      </Box>
                    ))}
                  </SimpleGrid>
                </CardBody>
              </Card>
            )}

            {/* Monthly Trend */}
            {stats.monthly_trend.length > 0 && (
              <Card>
                <CardHeader>
                  <Heading size="md">Tren 6 Bulan Terakhir</Heading>
                </CardHeader>
                <CardBody>
                  <SimpleGrid columns={{ base: 2, md: 3, lg: 6 }} spacing={4}>
                    {stats.monthly_trend.map((month) => (
                      <Box key={month.month} p={4} borderWidth="1px" borderRadius="md">
                        <HStack mb={2}>
                          <Icon as={FiCalendar} />
                          <Text fontWeight="bold" fontSize="sm">
                            {month.month}
                          </Text>
                        </HStack>
                        <Text fontSize="sm" color="gray.600">
                          {month.count} pesanan
                        </Text>
                        <Text fontSize="md" fontWeight="bold" color="purple.600">
                          {month.revenue_formatted}
                        </Text>
                      </Box>
                    ))}
                  </SimpleGrid>
                </CardBody>
              </Card>
            )}
          </>
        )}

        <Divider />

        {/* Orders List */}
        <Card>
          <CardHeader>
            <Flex justify="space-between" align="center" mb={4}>
              <Heading size="md">
                Daftar Pesanan Luar Kota
              </Heading>
              <Button
                leftIcon={<FiDownload />}
                colorScheme="green"
                onClick={handleExportPDF}
                isDisabled={orders.length === 0}
              >
                Export PDF
              </Button>
            </Flex>

            {/* Filters */}
            <VStack spacing={4} align="stretch">
              <HStack spacing={4}>
                <Input
                  placeholder="Cari nama, telepon, atau ID pesanan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button
                  leftIcon={<FiSearch />}
                  colorScheme="blue"
                  onClick={handleSearch}
                  isLoading={ordersLoading}
                >
                  Cari
                </Button>
              </HStack>

              <HStack spacing={4}>
                <Select
                  placeholder="Status Pembayaran"
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
                >
                  <option value="settlement">Lunas</option>
                  <option value="pending">Pending</option>
                  <option value="expire">Kadaluarsa</option>
                  <option value="cancel">Batal</option>
                </Select>

                <Select
                  placeholder="Status Pengiriman"
                  value={shippingStatusFilter}
                  onChange={(e) => setShippingStatusFilter(e.target.value)}
                >
                  <option value="pending">Pending</option>
                  <option value="menunggu diproses">Menunggu</option>
                  <option value="dikemas">Dikemas</option>
                  <option value="siap diambil">Siap Diambil</option>
                  <option value="sudah diambil">Diambil</option>
                  <option value="dalam pengiriman">Dalam Pengiriman</option>
                  <option value="diterima">Diterima</option>
                </Select>

                <Button onClick={handleReset} variant="outline">
                  Reset
                </Button>
              </HStack>

              <Text fontSize="sm" color="gray.600">
                Menampilkan {orders.length} dari {total} pesanan
              </Text>
            </VStack>
          </CardHeader>

          <CardBody>
            {ordersLoading ? (
              <Flex justify="center" py={8}>
                <Spinner />
              </Flex>
            ) : orders.length === 0 ? (
              <Text textAlign="center" py={8} color="gray.500">
                Tidak ada pesanan ditemukan
              </Text>
            ) : (
              <>
                <Box overflowX="auto">
                  <Table variant="simple" size="sm">
                    <Thead>
                      <Tr>
                        <Th>ID Pesanan</Th>
                        <Th>Pelanggan</Th>
                        <Th>Telepon</Th>
                        <Th>Kurir</Th>
                        <Th>Resi</Th>
                        <Th>Total</Th>
                        <Th>Pembayaran</Th>
                        <Th>Pengiriman</Th>
                        <Th>Tanggal</Th>
                        <Th>Aksi</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {orders.map((order) => (
                        <Tr key={order.id}>
                          <Td>
                            <Text fontSize="xs" fontFamily="mono">
                              {order.id.split('-').pop()}
                            </Text>
                          </Td>
                          <Td>
                            <Text fontWeight="medium">{order.customer_name}</Text>
                          </Td>
                          <Td>{order.customer_phone}</Td>
                          <Td>{order.courier_service || '-'}</Td>
                          <Td>
                            <Text fontSize="xs">{order.tracking_number || '-'}</Text>
                          </Td>
                          <Td>
                            <Text fontWeight="bold">
                              {order.total_amount_formatted}
                            </Text>
                          </Td>
                          <Td>{getPaymentStatusBadge(order.payment_status)}</Td>
                          <Td>{getShippingStatusBadge(order.shipping_status)}</Td>
                          <Td>{formatDate(order.created_at)}</Td>
                          <Td>
                            <Button
                              size="sm"
                              colorScheme="blue"
                              variant="outline"
                              onClick={() => navigate(`/orders/${order.id}`)}
                            >
                              Detail
                            </Button>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>

                {/* Pagination */}
                <HStack justify="space-between" mt={4}>
                  <Button
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                    isDisabled={offset === 0}
                  >
                    Sebelumnya
                  </Button>
                  <Text fontSize="sm" color="gray.600">
                    Halaman {Math.floor(offset / limit) + 1} dari{' '}
                    {Math.ceil(total / limit)}
                  </Text>
                  <Button
                    onClick={() => setOffset(offset + limit)}
                    isDisabled={!hasMore}
                  >
                    Selanjutnya
                  </Button>
                </HStack>
              </>
            )}
          </CardBody>
        </Card>
      </VStack>
    </Box>
  );
};

export default LuarKotaReportPage;
