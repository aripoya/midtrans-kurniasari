import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Heading,
  HStack,
  Icon,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  SimpleGrid,
  Spinner,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Text,
  VStack,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { FiArrowLeft, FiCalendar, FiPackage, FiShoppingCart } from 'react-icons/fi';
import { outletApi, OutletWeeklyRow } from '../../api/outletApi';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface OrderItem {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  price: number;
  total_price: number;
  order: {
    id: string;
    customer_name: string;
    created_at: string;
  };
}

interface OrderWithItems {
  id: string;
  customer_name: string;
  created_at: string;
  items: OrderItem[];
  total_amount: number;
}

const OutletWeeklyReportPage: React.FC = () => {
  const { year, month } = useParams<{ year: string; month: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [weeklyData, setWeeklyData] = useState<OutletWeeklyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderDetails, setOrderDetails] = useState<OrderWithItems[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<{start: string, end: string, label: string} | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    const run = async () => {
      if (!year || !month) {
        toast({
          title: 'Error',
          description: 'Parameter tahun dan bulan tidak valid',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        navigate('/outlet/dashboard');
        return;
      }

      try {
        setLoading(true);
        const resp = await outletApi.getWeeklyBreakdown(parseInt(year), parseInt(month));
        if (resp.success && resp.data) {
          setWeeklyData(resp.data);
        } else {
          toast({
            title: 'Error',
            description: resp.error || 'Gagal memuat data mingguan',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        }
      } catch (e) {
        toast({
          title: 'Error',
          description: 'Terjadi kesalahan saat memuat data',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [month, navigate, toast, year]);

  const formatWeekLabel = (weekStart: string, weekEnd: string) => {
    try {
      const start = new Date(weekStart);
      const end = new Date(weekEnd);
      return `${start.getDate()} - ${end.getDate()} ${end.toLocaleDateString('id-ID', { month: 'long' })}`;
    } catch {
      return `${weekStart} - ${weekEnd}`;
    }
  };

  const getMonthName = (monthNum: string) => {
    const months = [
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
    ];
    return months[parseInt(monthNum) - 1] || monthNum;
  };

  const totalOrders = weeklyData.reduce((sum, week) => sum + week.count, 0);
  const totalRevenue = weeklyData.reduce((sum, week) => sum + week.revenue, 0);

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleWeekClick = async (week: OutletWeeklyRow) => {
    setSelectedWeek({
      start: week.week_start,
      end: week.week_end,
      label: formatWeekLabel(week.week_start, week.week_end)
    });
    setLoadingDetails(true);
    
    try {
      const response = await outletApi.getOrderItems(week.week_start, week.week_end);
      if (response.success && response.data) {
        // Group items by order
        const ordersMap = new Map<string, OrderWithItems>();
        
        response.data.forEach(item => {
          if (!ordersMap.has(item.order_id)) {
            ordersMap.set(item.order_id, {
              id: item.order_id,
              customer_name: item.order?.customer_name || 'Pelanggan',
              created_at: item.order?.created_at || new Date().toISOString(),
              total_amount: 0, // Will be calculated from items
              items: []
            });
          }
          
          const order = ordersMap.get(item.order_id);
          if (order) {
            order.items.push(item);
            // Calculate total amount by summing up all item total_prices
            order.total_amount = order.items.reduce((sum, i) => sum + (i.total_price || 0), 0);
          }
        });

        const orders = Array.from(ordersMap.values());
        setOrderDetails(orders);
        onOpen();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Gagal memuat detail pesanan',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  const exportToPDF = () => {
    if (!selectedWeek || orderDetails.length === 0) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Add title
    doc.setFontSize(18);
    doc.text(`Laporan Mingguan - ${selectedWeek.label}`, pageWidth / 2, 15, { align: 'center' });
    
    // Add date range
    doc.setFontSize(12);
    doc.text(
      `Periode: ${new Date(selectedWeek.start).toLocaleDateString('id-ID')} - ${new Date(selectedWeek.end).toLocaleDateString('id-ID')}`, 
      pageWidth / 2, 
      25, 
      { align: 'center' }
    );

    // Add summary
    doc.setFontSize(14);
    doc.text('Ringkasan', 15, 40);
    doc.setFontSize(12);
    doc.text(`Total Pesanan: ${orderDetails.length}`, 15, 50);
    doc.text(
      `Total Pendapatan: ${formatRupiah(orderDetails.reduce((sum, order) => sum + order.total_amount, 0))}`, 
      15, 
      60
    );

    // Add order details
    doc.setFontSize(14);
    doc.text('Detail Pesanan', 15, 80);
    
    // Prepare data for the table
    const tableData: Array<any[]> = [];
    
    orderDetails.forEach(order => {
      // Add order header
      tableData.push([
        { 
          content: `Pesanan #${order.id.slice(-6).toUpperCase()}`,
          colSpan: 4,
          styles: { fontStyle: 'bold', fillColor: [220, 220, 220] }
        }
      ]);
      
      // Add customer info
      tableData.push([
        { 
          content: `Pelanggan: ${order.customer_name}`, 
          colSpan: 4,
          styles: { fontStyle: 'italic' }
        }
      ]);
      
      // Add order items
      order.items.forEach(item => {
        tableData.push([
          item.product_name,
          item.quantity,
          formatRupiah(item.price),
          formatRupiah(item.total_price)
        ]);
      });
      
      // Add order total
      tableData.push([
        { 
          content: 'Total Pesanan:', 
          colSpan: 3, 
          styles: { fontStyle: 'bold', halign: 'right' } 
        },
        { 
          content: formatRupiah(order.total_amount),
          styles: { fontStyle: 'bold' }
        }
      ]);
      
      // Add some space between orders
      tableData.push([{ content: '', colSpan: 4 }]);
    });
    
    // Create the table
    (doc as any).autoTable({
      head: [['Produk', 'Jumlah', 'Harga Satuan', 'Total']],
      body: tableData,
      startY: 90,
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 40, halign: 'right' },
        3: { cellWidth: 40, halign: 'right' }
      },
      didDrawPage: function (data: any) {
        // Add footer
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
        doc.text(
          'Dokumen ini dicetak pada: ' + new Date().toLocaleString('id-ID'),
          data.settings.margin.left,
          pageHeight - 10
        );
      }
    });
    
    // Save the PDF
    doc.save(`Laporan-Mingguan-${selectedWeek.start}-to-${selectedWeek.end}.pdf`);
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
        <Box>
          <Button
            leftIcon={<FiArrowLeft />}
            variant="ghost"
            mb={4}
            onClick={() => navigate('/outlet/dashboard')}
          >
            Kembali ke Dashboard
          </Button>
          <Heading size="lg" mb={2}>
            Laporan Mingguan - {getMonthName(month || '')} {year}
          </Heading>
          <Text color="gray.600">Breakdown pesanan outlet per minggu</Text>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <Card>
            <CardBody>
              <Stat>
                <StatLabel>
                  <HStack>
                    <Icon as={FiPackage} />
                    <Text>Total Pesanan Bulan Ini</Text>
                  </HStack>
                </StatLabel>
                <StatNumber>{totalOrders}</StatNumber>
                <StatHelpText>Dari {weeklyData.length} minggu</StatHelpText>
              </Stat>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Stat>
                <StatLabel>
                  <HStack>
                    <Text fontWeight="bold" fontSize="lg" color="purple.600">
                      Rp
                    </Text>
                    <Text>Total Pendapatan Bulan Ini</Text>
                  </HStack>
                </StatLabel>
                <StatNumber fontSize="2xl">{formatRupiah(totalRevenue)}</StatNumber>
                <StatHelpText>Akumulasi pendapatan</StatHelpText>
              </Stat>
            </CardBody>
          </Card>
        </SimpleGrid>

        <Card>
          <CardHeader>
            <Heading size="md">Breakdown Per Minggu</Heading>
          </CardHeader>
          <CardBody>
            {weeklyData.length === 0 ? (
              <Text textAlign="center" py={8} color="gray.500">
                Tidak ada data untuk bulan ini
              </Text>
            ) : (
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4}>
                {weeklyData.map((week, index) => (
                  <Box
                    key={week.week}
                    p={5}
                    borderWidth="2px"
                    borderRadius="lg"
                    bg="white"
                    cursor="pointer"
                    _hover={{
                      borderColor: 'blue.400',
                      boxShadow: 'lg',
                    }}
                    transition="all 0.2s"
                    onClick={() =>
                      navigate(
                        `/outlet/report/weekly/${year}/${month}/orders?from=${encodeURIComponent(
                          week.week_start
                        )}&to=${encodeURIComponent(week.week_end)}`
                      )
                    }
                  >
                    <VStack align="stretch" spacing={3}>
                      <HStack justify="space-between">
                        <Badge colorScheme="blue" fontSize="sm">
                          Minggu {index + 1}
                        </Badge>
                        <Icon as={FiCalendar} color="blue.500" />
                      </HStack>

                      <Text fontWeight="bold" fontSize="lg">
                        {formatWeekLabel(week.week_start, week.week_end)}
                      </Text>

                      <Box>
                        <Text fontSize="sm" color="gray.600" mb={1}>
                          Pesanan
                        </Text>
                        <Text fontSize="2xl" fontWeight="bold" color="blue.600">
                          {week.count}
                        </Text>
                      </Box>

                      <Box>
                        <Text fontSize="sm" color="gray.600" mb={1}>
                          Pendapatan
                        </Text>
                        <Text fontSize="lg" fontWeight="bold" color="purple.600">
                          {week.revenue_formatted}
                        </Text>
                      </Box>
                      
                      <Button 
                        size="sm" 
                        colorScheme="blue" 
                        variant="outline"
                        mt={2}
                        leftIcon={<FiShoppingCart />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWeekClick(week);
                        }}
                      >
                        Lihat Detail
                      </Button>
                    </VStack>
                  </Box>
                ))}
              </SimpleGrid>
            )}
          </CardBody>
        </Card>
      </VStack>

      {/* Order Details Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="6xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <HStack>
              <Icon as={FiShoppingCart} />
              <Text>Detail Pesanan - {selectedWeek?.label}</Text>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {loadingDetails ? (
              <Flex justify="center" p={8}>
                <Spinner size="xl" />
              </Flex>
            ) : orderDetails.length === 0 ? (
              <Text textAlign="center" py={8} color="gray.500">
                Tidak ada data pesanan untuk minggu ini
              </Text>
            ) : (
              <VStack spacing={6} align="stretch">
                <Box>
                  <Text fontSize="lg" fontWeight="bold" mb={2}>
                    Ringkasan
                  </Text>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={6}>
                    <Card>
                      <CardBody>
                        <Stat>
                          <StatLabel>Total Pesanan</StatLabel>
                          <StatNumber>{orderDetails.length}</StatNumber>
                        </Stat>
                      </CardBody>
                    </Card>
                    <Card>
                      <CardBody>
                        <Stat>
                          <StatLabel>Total Pendapatan</StatLabel>
                          <StatNumber>
                            {formatRupiah(
                              orderDetails.reduce((sum, order) => sum + order.total_amount, 0)
                            )}
                          </StatNumber>
                        </Stat>
                      </CardBody>
                    </Card>
                  </SimpleGrid>
                </Box>

                <Box>
                  <HStack justify="space-between" mb={4}>
                    <Text fontSize="lg" fontWeight="bold">
                      Daftar Pesanan
                    </Text>
                    <Button 
                      colorScheme="blue" 
                      size="sm" 
                      onClick={exportToPDF}
                      isDisabled={loadingDetails || orderDetails.length === 0}
                    >
                      Ekspor ke PDF
                    </Button>
                  </HStack>

                  {orderDetails.map((order) => (
                    <Box key={order.id} mb={6} borderWidth="1px" borderRadius="lg" p={4}>
                      <HStack justify="space-between" mb={3}>
                        <VStack align="flex-start" spacing={0}>
                          <Text fontWeight="bold">Pesanan #{order.id.slice(-6).toUpperCase()}</Text>
                          <Text fontSize="sm" color="gray.500">
                            {new Date(order.created_at).toLocaleString('id-ID')}
                          </Text>
                        </VStack>
                        <Text fontWeight="bold">{order.customer_name}</Text>
                      </HStack>

                      <Table size="sm" variant="simple">
                        <Thead>
                          <Tr>
                            <Th>Produk</Th>
                            <Th isNumeric>Jumlah</Th>
                            <Th isNumeric>Harga Satuan</Th>
                            <Th isNumeric>Total</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {order.items.map((item) => (
                            <Tr key={item.id}>
                              <Td>{item.product_name}</Td>
                              <Td isNumeric>{item.quantity}</Td>
                              <Td isNumeric>{formatRupiah(item.price)}</Td>
                              <Td isNumeric>{formatRupiah(item.total_price)}</Td>
                            </Tr>
                          ))}
                          <Tr>
                            <Td colSpan={3} textAlign="right" fontWeight="bold">
                              Total Pesanan:
                            </Td>
                            <Td isNumeric fontWeight="bold">
                              {formatRupiah(order.total_amount)}
                            </Td>
                          </Tr>
                        </Tbody>
                      </Table>
                    </Box>
                  ))}
                </Box>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default OutletWeeklyReportPage;
