import { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Box, Heading, Text, VStack, HStack, Badge, Button,
  Table, Tbody, Tr, Td, Th, Divider, Spinner,
  Alert, AlertIcon, AlertTitle, Card, CardBody,
  Stat, StatLabel, StatNumber, StatGroup, useToast
} from '@chakra-ui/react';
import { orderService } from '../api/orderService';

function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await orderService.getOrderById(id);
      setOrder(data.order || null);
    } catch (error) {
      console.error('Error fetching order details:', error);
      setError('Gagal memuat detail pesanan. Silakan coba lagi nanti.');
    } finally {
      setLoading(false);
    }
  };

  const refreshStatus = async () => {
    try {
      setRefreshing(true);
      const status = await orderService.checkTransactionStatus(id);
      
      if (status.success && status.transaction_status) {
        toast({
          title: 'Status berhasil diperbarui',
          description: 'Status pembayaran telah diperbarui',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });

        // Refresh order data
        fetchOrder();
      } else {
        toast({
          title: 'Status tidak berubah',
          description: 'Tidak ada perubahan status pembayaran',
          status: 'info',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('Error refreshing status:', error);
      toast({
        title: 'Gagal memperbarui status',
        description: 'Terjadi kesalahan saat memperbarui status',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setRefreshing(false);
    }
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

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
        <Text mt={4}>Memuat detail pesanan...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert status="error">
        <AlertIcon />
        <AlertTitle>{error}</AlertTitle>
      </Alert>
    );
  }

  if (!order) {
    return (
      <Alert status="warning">
        <AlertIcon />
        <AlertTitle>Pesanan tidak ditemukan</AlertTitle>
        <Button as={RouterLink} to="/orders" ml={4} colorScheme="blue">
          Kembali ke Daftar Pesanan
        </Button>
      </Alert>
    );
  }

  return (
    <Box>
      <HStack justify="space-between" mb={6}>
        <VStack align="start" spacing={1}>
          <Heading size="lg">Detail Pesanan #{order.id}</Heading>
          <Text color="gray.600">Dibuat pada {new Date(order.created_at).toLocaleString('id-ID')}</Text>
        </VStack>
        
        <HStack>
          <Button as={RouterLink} to="/orders" variant="outline">
            Kembali
          </Button>
          <Button 
            colorScheme="blue" 
            onClick={refreshStatus} 
            isLoading={refreshing}
            loadingText="Memperbarui..."
          >
            Perbarui Status
          </Button>
        </HStack>
      </HStack>

      <VStack spacing={6} align="stretch">
        <Card>
          <CardBody>
            <StatGroup>
              <Stat>
                <StatLabel>Status Pembayaran</StatLabel>
                <StatNumber>{getStatusBadge(order.status)}</StatNumber>
              </Stat>
              
              <Stat>
                <StatLabel>Total Pembayaran</StatLabel>
                <StatNumber>Rp {order.total_amount?.toLocaleString('id-ID')}</StatNumber>
              </Stat>
              
              <Stat>
                <StatLabel>Metode Pembayaran</StatLabel>
                <StatNumber>{order.payment_method || 'Belum dipilih'}</StatNumber>
              </Stat>
            </StatGroup>
            
            {order.payment_url && order.status === 'pending' && (
              <Button
                colorScheme="teal"
                size="lg"
                mt={4}
                w="100%"
                onClick={() => window.open(order.payment_url, '_blank')}
              >
                Bayar Sekarang
              </Button>
            )}
          </CardBody>
        </Card>
        
        <Card>
          <CardBody>
            <Heading size="md" mb={4}>Informasi Pelanggan</Heading>
            <Table variant="simple">
              <Tbody>
                <Tr>
                  <Th>Nama</Th>
                  <Td>{order.customer_name}</Td>
                </Tr>
                <Tr>
                  <Th>Email</Th>
                  <Td>{order.email}</Td>
                </Tr>
                <Tr>
                  <Th>Telepon</Th>
                  <Td>{order.phone}</Td>
                </Tr>
              </Tbody>
            </Table>
          </CardBody>
        </Card>
        
        <Card>
          <CardBody>
            <Heading size="md" mb={4}>Detail Item Pesanan</Heading>
            <Table variant="simple">
              <Tbody>
                <Tr>
                  <Th>Nama Item</Th>
                  <Th>Harga Satuan</Th>
                  <Th>Jumlah</Th>
                  <Th>Subtotal</Th>
                </Tr>
                {order.items?.map((item, index) => (
                  <Tr key={index}>
                    <Td>{item.name}</Td>
                    <Td>Rp {item.price?.toLocaleString('id-ID')}</Td>
                    <Td>{item.quantity}</Td>
                    <Td>Rp {(item.price * item.quantity)?.toLocaleString('id-ID')}</Td>
                  </Tr>
                ))}
                <Tr>
                  <Td colSpan={3} fontWeight="bold">Total</Td>
                  <Td fontWeight="bold">Rp {order.total_amount?.toLocaleString('id-ID')}</Td>
                </Tr>
              </Tbody>
            </Table>
          </CardBody>
        </Card>
        
        {order.transaction_id && (
          <Card>
            <CardBody>
              <Heading size="md" mb={4}>Informasi Transaksi</Heading>
              <Table variant="simple">
                <Tbody>
                  <Tr>
                    <Th>Transaction ID</Th>
                    <Td>{order.transaction_id}</Td>
                  </Tr>
                  <Tr>
                    <Th>Status Terakhir</Th>
                    <Td>{getStatusBadge(order.status)}</Td>
                  </Tr>
                  {order.payment_time && (
                    <Tr>
                      <Th>Waktu Pembayaran</Th>
                      <Td>{new Date(order.payment_time).toLocaleString('id-ID')}</Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
            </CardBody>
          </Card>
        )}
      </VStack>
    </Box>
  );
}

export default OrderDetailPage;
