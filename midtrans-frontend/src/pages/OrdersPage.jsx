import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { 
  Box, Heading, Text, Table, Thead, Tbody, Tr, Th, Td, 
  Badge, Button, Flex, Spinner, useToast 
} from '@chakra-ui/react';
import { orderService } from '../api/orderService';

function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ limit: 50, offset: 0, total: 0 });
  const toast = useToast();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async (offset = 0) => {
    try {
      setLoading(true);
      const result = await orderService.getOrders(offset);
      setOrders(result.orders || []);
      setPagination(result.pagination || { limit: 50, offset: 0, total: 0 });
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: 'Error mengambil daftar order',
        description: 'Gagal memuat daftar order dari server',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNextPage = () => {
    const newOffset = pagination.offset + pagination.limit;
    fetchOrders(newOffset);
  };

  const handlePrevPage = () => {
    const newOffset = Math.max(0, pagination.offset - pagination.limit);
    fetchOrders(newOffset);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge colorScheme="yellow">Menunggu Pembayaran</Badge>;
      case 'settlement':
      case 'capture':
        return <Badge colorScheme="green">Dibayar</Badge>;
      case 'cancel':
      case 'deny':
      case 'expire':
        return <Badge colorScheme="red">Gagal/Dibatalkan</Badge>;
      case 'refund':
      case 'partial_refund':
        return <Badge colorScheme="purple">Dikembalikan</Badge>;
      default:
        return <Badge>Tidak Diketahui</Badge>;
    }
  };

  return (
    <Box>
      <Flex justifyContent="space-between" alignItems="center" mb={6}>
        <Heading size="lg">Daftar Pesanan</Heading>
        <Button as={RouterLink} to="/orders/new" colorScheme="teal">
          Buat Pesanan Baru
        </Button>
      </Flex>

      {loading ? (
        <Flex justifyContent="center" py={10}>
          <Spinner size="xl" />
        </Flex>
      ) : orders.length === 0 ? (
        <Box textAlign="center" py={10}>
          <Text fontSize="lg">Belum ada pesanan yang dibuat</Text>
          <Button as={RouterLink} to="/orders/new" colorScheme="teal" mt={4}>
            Buat Pesanan Pertama
          </Button>
        </Box>
      ) : (
        <>
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>ID</Th>
                <Th>Nama Pelanggan</Th>
                <Th>Total</Th>
                <Th>Status</Th>
                <Th>Tanggal</Th>
                <Th>Aksi</Th>
              </Tr>
            </Thead>
            <Tbody>
              {orders.map((order) => (
                <Tr key={order.id}>
                  <Td>{order.id}</Td>
                  <Td>{order.customer_name}</Td>
                  <Td>Rp {order.total_amount?.toLocaleString('id-ID')}</Td>
                  <Td>{getStatusBadge(order.status)}</Td>
                  <Td>{new Date(order.created_at).toLocaleDateString('id-ID')}</Td>
                  <Td>
                    <Button
                      as={RouterLink}
                      to={`/orders/${order.id}`}
                      size="sm"
                      colorScheme="blue"
                    >
                      Detail
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>

          <Flex justifyContent="space-between" mt={4}>
            <Text>
              Menampilkan {orders.length} dari {pagination.total} pesanan
            </Text>
            <Flex>
              <Button
                onClick={handlePrevPage}
                isDisabled={pagination.offset === 0}
                mr={2}
              >
                Sebelumnya
              </Button>
              <Button
                onClick={handleNextPage}
                isDisabled={pagination.offset + pagination.limit >= pagination.total}
              >
                Selanjutnya
              </Button>
            </Flex>
          </Flex>
        </>
      )}
    </Box>
  );
}

export default OrdersPage;
