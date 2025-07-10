import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { 
  Box, Heading, Text, Table, Thead, Tbody, Tr, Th, Td, 
  Badge, Button, Flex, Spinner, useToast, Stack, Card, CardBody,
  HStack, useBreakpointValue, VStack
} from '@chakra-ui/react';
import { orderService } from '../api/orderService';

function OrdersPage() {
  const isMobile = useBreakpointValue({ base: true, md: false });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ limit: 50, offset: 0, total: 0 });
  const toast = useToast();

  useEffect(() => {
    // Fetch orders when the component mounts
    fetchOrders();

    // This function will be called when an order is updated on the detail page
    const handleOrderUpdated = () => {
      console.log('An order was updated, refreshing the list...');
      fetchOrders();
    };

    // Listen for the custom event dispatched from the detail page
    window.addEventListener('order-updated', handleOrderUpdated);

    // Clean up the listener when the component is unmounted
    return () => {
      window.removeEventListener('order-updated', handleOrderUpdated);
    };
  }, []); // The empty dependency array ensures this effect runs only once on mount

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
      case 'paid':
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
  
  const getShippingStatusBadge = (status) => {
    switch (status) {
      case 'di kemas':
        return <Badge colorScheme="blue">Dikemas</Badge>;
      case 'siap kirim':
        return <Badge colorScheme="cyan">Siap Kirim</Badge>;
      case 'siap di ambil':
        return <Badge colorScheme="teal">Siap Ambil</Badge>;
      case 'sedang dikirim':
        return <Badge colorScheme="orange">Sedang Dikirim</Badge>;
      case 'received':
      case 'Sudah Di Terima':
        return <Badge colorScheme="green">Sudah Diterima</Badge>;
      case 'Sudah Di Ambil':
        return <Badge colorScheme="green">Sudah Diambil</Badge>;
      default:
        return <Badge colorScheme="gray">Diproses</Badge>;
    }
  };

  return (
    <Box>
      <Flex 
        justifyContent="space-between" 
        alignItems={{ base: "flex-start", sm: "center" }} 
        mb={6}
        flexDirection={{ base: "column", sm: "row" }}
        gap={3}
      >
        <Heading size="lg">Daftar Pesanan</Heading>
        <Button as={RouterLink} to="/orders/new" colorScheme="teal" size={{ base: "md", sm: "md" }}>
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
          {isMobile ? (
            <Stack spacing={4}>
              {orders.map((order) => (
                <Card key={order.id} variant="outline" size="sm">
                  <CardBody>
                    <VStack align="stretch" spacing={2}>
                      <HStack justify="space-between">
                        <Text fontWeight="bold">ID: {order.id}</Text>
                        <Text fontWeight="medium">Rp {order.total_amount?.toLocaleString('id-ID')}</Text>
                      </HStack>
                      <Text>{order.customer_name}</Text>
                      <HStack justify="space-between">
                        <Box>
                          <Text fontSize="xs" color="gray.500">Status Pembayaran:</Text>
                          {getStatusBadge(order.payment_status || order.status)}
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="gray.500">Status Pesanan:</Text>
                          {getShippingStatusBadge(order.shipping_status)}
                        </Box>
                      </HStack>
                      <Text color="gray.600" fontSize="sm">
                        {new Date(order.created_at).getDate().toString().padStart(2, '0')}-{(new Date(order.created_at).getMonth() + 1).toString().padStart(2, '0')}-{new Date(order.created_at).getFullYear()}
                      </Text>
                      <Button
                        as={RouterLink}
                        to={`/orders/${order.id}`}
                        size="sm"
                        colorScheme="blue"
                        width="full"
                        mt={1}
                      >
                        Detail
                      </Button>
                    </VStack>
                  </CardBody>
                </Card>
              ))}
            </Stack>
          ) : (
            <Box overflowX="auto">
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>ID</Th>
                    <Th>Nama Pelanggan</Th>
                    <Th>Total</Th>
                    <Th>Status Pembayaran</Th>
                    <Th>Status Pesanan</Th>
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
                      <Td>{getStatusBadge(order.payment_status || order.status)}</Td>
                      <Td>{getShippingStatusBadge(order.shipping_status)}</Td>
                      <Td>{new Date(order.created_at).getDate().toString().padStart(2, '0')}-{(new Date(order.created_at).getMonth() + 1).toString().padStart(2, '0')}-{new Date(order.created_at).getFullYear()}</Td>
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
            </Box>
          )}

          <Flex 
            justifyContent="space-between" 
            mt={4}
            flexDirection={{ base: "column", sm: "row" }}
            gap={3}
          >
            <Text textAlign={{ base: "center", sm: "left" }}>
              Menampilkan {orders.length} dari {pagination.total} pesanan
            </Text>
            <Flex justifyContent={{ base: "center", sm: "flex-end" }}>
              <Button
                onClick={handlePrevPage}
                isDisabled={pagination.offset === 0}
                mr={2}
                size={{ base: "sm", md: "md" }}
              >
                Sebelumnya
              </Button>
              <Button
                onClick={handleNextPage}
                isDisabled={pagination.offset + pagination.limit >= pagination.total}
                size={{ base: "sm", md: "md" }}
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
