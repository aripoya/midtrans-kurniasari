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
import { Order, adminApi } from '../../api/adminApi';

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
  const [exporting, setExporting] = useState(false);
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

      const detailedOrders = await runWithConcurrency<OrderRow, Order | null>(
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

      const header = `Laporan Mingguan Dalam Kota\n${from} s/d ${to}`;
      writeWrapped(header, 9, 'bold');
      writeLines([''], 8, 'normal');

      for (let idx = 0; idx < detailedOrders.length; idx += 1) {
        const o = detailedOrders[idx];
        if (!o) continue;

        const shortId = String(o.id || '').split('-').pop() || String(o.id || '');
        const created = o.created_at ? new Date(o.created_at) : null;
        const createdLabel = created && !Number.isNaN(created.getTime())
          ? created.toLocaleString('id-ID')
          : String(o.created_at || '');

        hr();
        writeWrapped(`Transaksi: ${shortId}`, 9, 'bold');
        writeWrapped(`Tanggal  : ${createdLabel}`, 8, 'normal');
        writeWrapped(`Pelanggan: ${o.customer_name || '-'}`, 8, 'normal');
        writeWrapped(`Telepon  : ${o.customer_phone || '-'}`, 8, 'normal');
        writeWrapped(`Bayar    : ${o.payment_status || '-'}`, 8, 'normal');
        writeWrapped(`Kirim    : ${o.shipping_status || '-'}`, 8, 'normal');
        writeLines([''], 8, 'normal');

        writeWrapped('Item:', 8, 'bold');

        const items: any[] = Array.isArray((o as any).items) ? (o as any).items : [];
        if (items.length === 0) {
          writeWrapped('-', 8, 'normal');
        } else {
          for (const it of items) {
            const name = String(it.product_name || it.name || '-');
            const qty = Number(it.quantity || 1);
            const subtotal = Number(it.subtotal || (Number(it.price || it.product_price || 0) * qty));
            writeWrapped(`- ${name} x${qty}`, 8, 'normal');
            writeWrapped(`  ${formatRupiah(subtotal)}`, 8, 'normal');
          }
        }

        writeLines([''], 8, 'normal');
        writeWrapped(`Total: ${formatRupiah(Number(o.total_amount || 0))}`, 9, 'bold');
        writeLines([''], 8, 'normal');
      }

      const filename = `Laporan-Mingguan-Dalam-Kota_${from}_${to}.pdf`;
      doc.save(filename);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: 'Error',
        description: 'Gagal membuat PDF',
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
          <Flex justify="space-between" align="flex-start" gap={4} wrap="wrap">
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
            <Button
              leftIcon={<FiDownload />}
              colorScheme="green"
              onClick={handleExportPDF}
              isDisabled={orders.length === 0}
              isLoading={exporting}
              loadingText="Membuat PDF"
            >
              Export PDF
            </Button>
          </Flex>
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
