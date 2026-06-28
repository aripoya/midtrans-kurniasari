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
import { FiArrowLeft, FiDownload } from 'react-icons/fi';
import jsPDF from 'jspdf';
import { adminApi, Order } from '../../api/adminApi';
import { outletApi, OutletOrderRow } from '../../api/outletApi';

const OutletWeeklyOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { year, month } = useParams<{ year: string; month: string }>();
  const [searchParams] = useSearchParams();

  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [orders, setOrders] = useState<OutletOrderRow[]>([]);

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
        navigate(`/outlet/report/weekly/${year || ''}/${month || ''}`);
        return;
      }

      try {
        setLoading(true);
        const response = await outletApi.getOrders({
          offset: 0,
          limit: 500,
          date_from: from,
          date_to: to,
        });

        if (response.success && response.data) {
          setOrders(((response.data as any).orders || []) as OutletOrderRow[]);
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

  const formatRupiah = (amount: number) => {
    try {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(amount || 0);
    } catch {
      return `Rp ${Number(amount || 0).toLocaleString('id-ID')}`;
    }
  };

  const runWithConcurrency = async <T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<R>
  ): Promise<R[]> => {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;

    const runners = new Array(Math.min(concurrency, items.length)).fill(null).map(async () => {
      while (nextIndex < items.length) {
        const current = nextIndex;
        nextIndex += 1;
        results[current] = await worker(items[current], current);
      }
    });

    await Promise.all(runners);
    return results;
  };

  const handleExportPDF = async () => {
    if (orders.length === 0) return;

    try {
      setExporting(true);

      const infoToast = toast({
        title: 'Membuat PDF...',
        description: 'Sedang mengambil detail pesanan dan menyusun laporan',
        status: 'info',
        duration: null,
        isClosable: false,
      });

      const detailedOrders = await runWithConcurrency<OutletOrderRow, Order | null>(
        orders,
        5,
        async (o) => {
          const resp = await adminApi.getOrderDetails(o.id);
          return resp.success ? (resp.data as Order) : null;
        }
      );

      toast.close(infoToast);

      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      const pageH = 297;
      const marginX = 10;
      const marginY = 10;
      const colW = 58;
      const gap = 4;
      const colX = [marginX, marginX + colW + gap, marginX + (colW + gap) * 2];
      const yMax = pageH - marginY;
      const lineH = 3.2;

      let pageIndex = 0;
      let colIndex = 0;
      let x = colX[colIndex];
      let y = marginY;

      const startNewPage = () => {
        if (pageIndex > 0) doc.addPage();
        pageIndex += 1;
        colIndex = 0;
        x = colX[colIndex];
        y = marginY;

        doc.setLineWidth(0.1);
        doc.setDrawColor(200);
        doc.setLineDashPattern([1, 1], 0);
        for (let i = 0; i < 3; i += 1) {
          doc.rect(colX[i] - 1, marginY - 1, colW + 2, pageH - marginY * 2 + 2);
        }
        doc.setLineDashPattern([], 0);
      };

      const nextColumn = () => {
        colIndex += 1;
        if (colIndex >= 3) {
          startNewPage();
        } else {
          x = colX[colIndex];
          y = marginY;
        }
      };

      const ensureSpace = (heightNeeded: number) => {
        if (y + heightNeeded <= yMax) return;
        nextColumn();
      };

      const writeLines = (lines: string[], fontSize: number, fontStyle: 'normal' | 'bold' = 'normal') => {
        doc.setFont('courier', fontStyle);
        doc.setFontSize(fontSize);
        for (const ln of lines) {
          ensureSpace(lineH);
          doc.text(ln, x, y, { maxWidth: colW });
          y += lineH;
        }
      };

      const writeWrapped = (text: string, fontSize: number, fontStyle: 'normal' | 'bold' = 'normal') => {
        doc.setFont('courier', fontStyle);
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(text, colW);
        writeLines(lines, fontSize, fontStyle);
      };

      const hr = () => {
        writeLines(['--------------------------------'], 8, 'normal');
      };

      startNewPage();

      writeWrapped('Laporan Outlet - Mingguan', 11, 'bold');
      if (titleRange) writeWrapped(titleRange, 9, 'normal');
      hr();

      for (const ord of detailedOrders) {
        if (!ord) continue;

        const created = ord.created_at ? new Date(ord.created_at) : null;
        const createdText = created ? created.toLocaleString('id-ID') : (ord.created_at || '');

        writeWrapped(`Order: ${ord.id}`, 8, 'bold');
        writeWrapped(`Nama: ${ord.customer_name || ''}`, 8, 'normal');
        writeWrapped(`HP: ${ord.customer_phone || ''}`, 8, 'normal');
        writeWrapped(`Tanggal: ${createdText}`, 8, 'normal');
        writeWrapped(`Pembayaran: ${(ord.payment_status || '').toUpperCase()}`, 8, 'normal');
        writeWrapped(`Pengiriman: ${ord.shipping_status || ''}`, 8, 'normal');
        writeWrapped(`Total: ${formatRupiah(ord.total_amount || 0)}`, 8, 'normal');

        const items = Array.isArray((ord as any).items) ? ((ord as any).items as any[]) : [];
        if (items.length > 0) {
          writeWrapped('Items:', 8, 'bold');
          for (const it of items) {
            const name = it?.name || it?.product_name || '';
            const qty = it?.quantity || it?.qty || 0;
            const price = it?.price || it?.unit_price || 0;
            const subtotal = it?.subtotal || (qty && price ? qty * price : 0);
            writeWrapped(`- ${name}`, 8, 'normal');
            writeWrapped(`  ${qty} x ${formatRupiah(price)} = ${formatRupiah(subtotal)}`, 8, 'normal');
          }
        }

        hr();
      }

      doc.save(`laporan-outlet-mingguan-${year}-${month}-${from}-${to}.pdf`);

      toast({
        title: 'Berhasil',
        description: 'PDF berhasil dibuat',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Gagal membuat PDF',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setExporting(false);
    }
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
            onClick={() => navigate(`/outlet/report/weekly/${year}/${month}`)}
          >
            Kembali ke Laporan Mingguan
          </Button>
          <Heading size="lg" mb={1}>
            Pesanan Mingguan
          </Heading>
          <HStack justify="space-between" align="center" wrap="wrap" gap={3}>
            <Text color="gray.600">{titleRange}</Text>
            <Button
              leftIcon={<FiDownload />}
              colorScheme="green"
              onClick={handleExportPDF}
              isLoading={exporting}
              isDisabled={orders.length === 0}
            >
              Export PDF
            </Button>
          </HStack>
        </Box>

        <Box borderWidth="1px" borderRadius="lg" overflow="hidden" bg="white">
          {orders.length === 0 ? (
            <Box p={8} textAlign="center">
              <Text color="gray.500">Tidak ada pesanan pada minggu ini</Text>
            </Box>
          ) : (
            <Box overflowX="auto">
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>ID</Th>
                    <Th>Nama</Th>
                    <Th>Total</Th>
                    <Th>Pembayaran</Th>
                    <Th>Pengiriman</Th>
                    <Th>Tanggal</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {orders.map((order) => (
                    <Tr key={order.id}>
                      <Td fontWeight="medium">{order.id}</Td>
                      <Td>{order.customer_name}</Td>
                      <Td>{formatRupiah(order.total_amount || 0)}</Td>
                      <Td>
                        <Badge colorScheme={order.payment_status === 'settlement' ? 'green' : 'orange'}>
                          {(order.payment_status || '').toUpperCase()}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge colorScheme={order.shipping_status === 'diterima' ? 'green' : 'blue'}>
                          {order.shipping_status || ''}
                        </Badge>
                      </Td>
                      <Td>{order.created_at ? new Date(order.created_at).toLocaleDateString('id-ID') : ''}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </Box>
      </VStack>
    </Box>
  );
};

export default OutletWeeklyOrdersPage;
