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
  SimpleGrid,
  Spinner,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { FiArrowLeft, FiCalendar, FiPackage } from 'react-icons/fi';
import { outletApi, OutletWeeklyRow } from '../../api/outletApi';

const OutletWeeklyReportPage: React.FC = () => {
  const { year, month } = useParams<{ year: string; month: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [weeklyData, setWeeklyData] = useState<OutletWeeklyRow[]>([]);
  const [loading, setLoading] = useState(true);

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

export default OutletWeeklyReportPage;
