import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Button,
  HStack,
  VStack,
  Text,
  Spinner,
  useToast,
  Flex,
  Icon,
  Badge,
} from '@chakra-ui/react';
import { FiArrowLeft, FiCalendar, FiPackage } from 'react-icons/fi';
import { adminApi } from '../../api/adminApi';

interface WeeklyData {
  week: string;
  week_start: string;
  week_end: string;
  count: number;
  revenue: number;
  revenue_formatted: string;
}

const DalamKotaWeeklyReportPage: React.FC = () => {
  const { year, month } = useParams<{ year: string; month: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWeeklyData();
  }, [year, month]);

  const fetchWeeklyData = async () => {
    if (!year || !month) {
      toast({
        title: 'Error',
        description: 'Parameter tahun dan bulan tidak valid',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      navigate('/admin/dalam-kota-report');
      return;
    }

    try {
      setLoading(true);
      const response = await adminApi.getDalamKotaWeeklyBreakdown(
        parseInt(year),
        parseInt(month)
      );

      if (response.success && response.data) {
        setWeeklyData(response.data);
      } else {
        toast({
          title: 'Error',
          description: response.error || 'Gagal memuat data mingguan',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error fetching weekly data:', error);
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
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
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
          <Button
            leftIcon={<FiArrowLeft />}
            variant="ghost"
            mb={4}
            onClick={() => navigate('/admin/dalam-kota-report')}
          >
            Kembali ke Laporan Bulanan
          </Button>
          <Heading size="lg" mb={2}>
            Laporan Mingguan - {getMonthName(month || '')} {year}
          </Heading>
          <Text color="gray.600">
            Breakdown pesanan dalam kota per minggu
          </Text>
        </Box>

        {/* Summary Cards */}
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

        {/* Weekly Breakdown */}
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
                        `/admin/dalam-kota-report/weekly/${year}/${month}/orders?from=${encodeURIComponent(
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
                    </VStack>
                  </Box>
                ))}
              </SimpleGrid>
            )}
          </CardBody>
        </Card>
      </VStack>
    </Box>
  );
};

export default DalamKotaWeeklyReportPage;
