import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { FiArrowLeft } from 'react-icons/fi';
import { adminApi } from '../../api/adminApi';

interface OrderRow {
  id: string;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  total_amount_formatted?: string;
  payment_status: string;
  shipping_status: string;
  pickup_method: string;
  courier_service: string;
  created_at: string;
}

const DalamKotaWeeklyOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { year, month } = useParams<{ year: string; month: string }>();
  const [searchParams] = useSearchParams();

  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const titleRange = useMemo(() => {
    if (!from || !to) return '';
    try {
      const start = new Date(from);
      const end = new Date(to);
      const monthName = end.toLocaleDateString('id-ID', { month: 'long' });
      return `${start.getDate()} - ${end.getDate()} ${monthName}`;
    } catch {
      return `${from} - ${to}`;
    }
  }, [from, to]);

  useEffect(() => {
    const run = async () => {
      if (!year || !month || !from || !to) {
        toast({
          title: 'Error',
          description: 'Parameter minggu tidak valid',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        navigate(`/admin/dalam-kota-report/weekly/${year || ''}/${month || ''}`);
        return;
      }

      try {
        setLoading(true);
        const response = await adminApi.getDalamKotaOrders({
          offset: 0,
          limit: 500,
          date_from: from,
          date_to: to,
        });

        if (response.success) {
          setOrders(((response as any).orders || []) as OrderRow[]);
        } else {
          toast({
            title: 'Error',
            description: response.error || 'Gagal memuat detail pesanan minggu ini',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        }
      } catch (error) {
        console.error('Error fetching weekly orders:', error);
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
  }, [from, month, navigate, toast, to, year]);

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
            onClick={() => navigate(`/admin/dalam-kota-report/weekly/${year}/${month}`)}
          >
            Kembali ke Laporan Mingguan
          </Button>
          <Heading size="lg" mb={2}>
            Detail Pesanan Minggu Ini
          </Heading>
          <Text color="gray.600">
            {titleRange ? `Periode: ${titleRange}` : 'Periode tidak diketahui'}
          </Text>
        </Box>

        {orders.length === 0 ? (
          <Text textAlign="center" py={10} color="gray.500">
            Tidak ada pesanan pada minggu ini
          </Text>
        ) : (
          <Box overflowX="auto">
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th>ID Pesanan</Th>
                  <Th>Pelanggan</Th>
                  <Th>Telepon</Th>
                  <Th>Total</Th>
                  <Th>Pembayaran</Th>
                  <Th>Pengiriman</Th>
                  <Th>Metode</Th>
                  <Th>Kurir</Th>
                  <Th>Tanggal</Th>
                </Tr>
              </Thead>
              <Tbody>
                {orders.map((o) => (
                  <Tr
                    key={o.id}
                    cursor="pointer"
                    _hover={{ bg: 'gray.50' }}
                    onClick={() => navigate(`/admin/orders/${o.id}`)}
                  >
                    <Td fontFamily="mono" fontSize="xs">
                      {o.id}
                    </Td>
                    <Td>{o.customer_name}</Td>
                    <Td>{o.customer_phone}</Td>
                    <Td>{o.total_amount_formatted || String(o.total_amount)}</Td>
                    <Td>
                      <Badge colorScheme={o.payment_status === 'settlement' ? 'green' : 'orange'}>
                        {o.payment_status}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge colorScheme={o.shipping_status === 'delivered' ? 'green' : 'blue'}>
                        {o.shipping_status}
                      </Badge>
                    </Td>
                    <Td>{o.pickup_method}</Td>
                    <Td>{o.courier_service}</Td>
                    <Td>{new Date(o.created_at).toLocaleString('id-ID')}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}

        {orders.length > 0 && (
          <HStack justify="space-between">
            <Text fontSize="sm" color="gray.600">
              Total: {orders.length} pesanan
            </Text>
            <Button variant="outline" onClick={() => navigate('/admin/dalam-kota-report')}>
              Ke Laporan Bulanan
            </Button>
          </HStack>
        )}
      </VStack>
    </Box>
  );
};

export default DalamKotaWeeklyOrdersPage;
