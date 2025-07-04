import { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import {
  Box, Heading, Text, VStack, HStack, Badge, Button,
  Table, Tbody, Tr, Td, Th, Thead, Divider, Spinner,
  Alert, AlertIcon, Card, CardBody, CardHeader, CardFooter,
  useToast, Flex, Grid, GridItem, Select, FormControl, 
  FormLabel, Textarea, SimpleGrid, Stack, Tag,
  useDisclosure, Modal, ModalOverlay, ModalContent,
  ModalHeader, ModalBody, ModalFooter, ModalCloseButton,
  Accordion, AccordionItem, AccordionButton, 
  AccordionPanel, AccordionIcon
} from '@chakra-ui/react';
import { orderService } from '../../api/orderService';
import { refreshOrderStatus } from '../../api/api';
import { adminApi } from '../../api/adminApi';

function AdminOrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shippingStatus, setShippingStatus] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const fetchOrder = async () => {
    try {
      console.log('[AdminOrderDetailPage] Fetching order:', id);
      setLoading(true);
      setError(null);
      const data = await orderService.getOrderById(id);
      console.log('[AdminOrderDetailPage] API response:', data);
      
      if (data.success && data.order) {
        let finalOrder = data.order;
        console.log('[AdminOrderDetailPage] Original order data:', finalOrder);
        
        if (finalOrder.payment_response) {
          try {
            const paymentDetails = JSON.parse(finalOrder.payment_response);
            finalOrder = {
              ...finalOrder,
              payment_method: paymentDetails.payment_type || finalOrder.payment_method,
              payment_time: paymentDetails.settlement_time || finalOrder.payment_time,
              status: paymentDetails.transaction_status || finalOrder.status,
            };
            console.log('[AdminOrderDetailPage] Enhanced order with payment details:', finalOrder);
          } catch (e) {
            console.error("Failed to parse payment_response:", e);
          }
        }
        setOrder(finalOrder);
        setShippingStatus(finalOrder.shipping_status || '');
      } else {
        console.error('[AdminOrderDetailPage] Order not found or API returned error');
        setError(`Pesanan tidak ditemukan.`);
      }
    } catch (err) {
      console.error('[AdminOrderDetailPage] Error fetching order:', err);
      setError(`Gagal memuat detail pesanan: ${err.message}.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    try {
      const { data } = await refreshOrderStatus(id);
      if (data.success) {
        await fetchOrder(); // Refetch to get all updated data
        toast({
          title: "Status Diperbarui",
          description: `Status pembayaran sekarang adalah: ${data.payment_status}.`,
          status: "success",
          duration: 5000,
          isClosable: true,
        });
      } else {
        throw new Error(data.error || 'Gagal memperbarui status.');
      }
    } catch (err) {
      toast({
        title: "Gagal Memperbarui",
        description: err.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Function for updating shipping status using adminApi
  const handleUpdateStatus = async () => {
    setIsUpdating(true);
    try {
      const response = await adminApi.updateOrderStatus(id, shippingStatus, adminNote);
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Update local state
      setOrder(prev => ({
        ...prev,
        shipping_status: shippingStatus
      }));
      
      toast({
        title: "Status pesanan diperbarui",
        description: `Status berhasil diubah menjadi: ${shippingStatus}`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      
      // Reset admin note after successful update
      setAdminNote('');
    } catch (err) {
      toast({
        title: "Gagal memperbarui status",
        description: err.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getPaymentStatusBadge = (status) => {
    const statusMap = {
      pending: { scheme: 'yellow', text: 'Menunggu Pembayaran' },
      paid: { scheme: 'green', text: 'Dibayar' },
      settlement: { scheme: 'green', text: 'Dibayar' },
      capture: { scheme: 'green', text: 'Dibayar' },
      deny: { scheme: 'red', text: 'Ditolak' },
      cancel: { scheme: 'red', text: 'Dibatalkan' },
      expire: { scheme: 'red', text: 'Kadaluarsa' },
      failure: { scheme: 'red', text: 'Gagal' }
    };

    const statusInfo = statusMap[status] || { scheme: 'gray', text: status || 'Tidak Diketahui' };
    return <Badge colorScheme={statusInfo.scheme}>{statusInfo.text}</Badge>;
  };

  const getShippingStatusBadge = (status) => {
    const statusMap = {
      'dikemas': { scheme: 'blue', text: 'Dikemas' },
      'siap kirim': { scheme: 'purple', text: 'Siap Kirim' },
      'dikirim': { scheme: 'orange', text: 'Dalam Pengiriman' },
      'sedang dikirim': { scheme: 'orange', text: 'Dalam Pengiriman' },
      'received': { scheme: 'green', text: 'Diterima' }
    };

    const statusInfo = statusMap[status?.toLowerCase()] || { scheme: 'gray', text: status || 'Menunggu Diproses' };
    return <Badge colorScheme={statusInfo.scheme}>{statusInfo.text}</Badge>;
  };

  if (loading) {
    return (
      <Flex justify="center" align="center" height="200px">
        <Spinner size="xl" />
      </Flex>
    );
  }

  if (error || !order) {
    return (
      <Alert status="warning">
        <AlertIcon />
        {error || "Pesanan tidak ditemukan."}
      </Alert>
    );
  }

  const isPaid = ['paid', 'settlement', 'capture'].includes(order.payment_status);

  return (
    <AdminLayout>
      <Box p={4}>
        <HStack mb={6} justify="space-between">
          <Heading size="lg">
            Detail Pesanan #{order.id.substring(0, 8)}
          </Heading>
        <Button 
          as={RouterLink} 
          to="/admin/orders" 
          variant="outline"
        >
          Kembali ke Daftar
        </Button>
      </HStack>

      <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={6}>
        {/* Main order details */}
        <GridItem colSpan={{ base: 1, lg: 2 }}>
          <Card mb={6}>
            <CardHeader>
              <Heading size="md">Informasi Pesanan</Heading>
            </CardHeader>
            <CardBody>
              <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={6}>
                <GridItem>
                  <Heading size="sm" mb={4}>Informasi Pelanggan</Heading>
                  <Text><strong>Nama:</strong> {order.customer_name}</Text>
                  <Text><strong>Email:</strong> {order.customer_email}</Text>
                  <Text><strong>Telepon:</strong> {order.customer_phone}</Text>
                  {order.customer_address && (
                    <Text whiteSpace="pre-wrap"><strong>Alamat:</strong> {order.customer_address}</Text>
                  )}
                </GridItem>
                <GridItem>
                  <Heading size="sm" mb={4}>Detail Pembayaran</Heading>
                  <Text><strong>Total:</strong> Rp {order.total_amount?.toLocaleString('id-ID')}</Text>
                  <HStack mt={2}>
                    <Text><strong>Status Pembayaran:</strong></Text>
                    {getPaymentStatusBadge(order.payment_status)}
                  </HStack>
                  <HStack mt={2}>
                    <Text><strong>Status Pengiriman:</strong></Text>
                    {getShippingStatusBadge(order.shipping_status)}
                  </HStack>
                  <Text mt={2}><strong>Metode:</strong> <Tag>{order.payment_method || 'N/A'}</Tag></Text>
                  {order.payment_time && (
                    <Text><strong>Waktu Pembayaran:</strong> {new Date(order.payment_time).toLocaleString()}</Text>
                  )}
                  <Text><strong>Dibuat:</strong> {new Date(order.created_at).toLocaleString()}</Text>
                </GridItem>
              </Grid>

              <Divider my={6} />

              <Heading size="sm" mb={4}>Barang Pesanan</Heading>
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Produk</Th>
                      <Th isNumeric>Jumlah</Th>
                      <Th isNumeric>Harga</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {order.items && order.items.map((item, index) => (
                      <Tr key={index}>
                        <Td>{item.product_name}</Td>
                        <Td isNumeric>{item.quantity}</Td>
                        <Td isNumeric>Rp {item.product_price?.toLocaleString('id-ID')}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            </CardBody>
          </Card>

          {/* Payment details accordion */}
          {order.payment_response && (
            <Card mb={6}>
              <CardHeader p={0}>
                <Accordion allowToggle>
                  <AccordionItem border="none">
                    <AccordionButton py={4} px={6}>
                      <Box as="span" flex='1' textAlign='left'>
                        <Heading size="md">Detail Teknis Pembayaran</Heading>
                      </Box>
                      <AccordionIcon />
                    </AccordionButton>
                    <AccordionPanel pb={4} px={6}>
                      <Box 
                        bg="gray.50" 
                        p={3} 
                        borderRadius="md" 
                        fontFamily="monospace" 
                        fontSize="sm" 
                        overflowX="auto"
                      >
                        <pre>{JSON.stringify(JSON.parse(order.payment_response), null, 2)}</pre>
                      </Box>
                    </AccordionPanel>
                  </AccordionItem>
                </Accordion>
              </CardHeader>
            </Card>
          )}
        </GridItem>

        {/* Admin action panel */}
        <GridItem>
          <Card>
            <CardHeader>
              <Heading size="md">Aksi Admin</Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel>Status Pengiriman</FormLabel>
                  <Select 
                    value={shippingStatus} 
                    onChange={e => setShippingStatus(e.target.value)}
                  >
                    <option value="">Menunggu Diproses</option>
                    <option value="dikemas">Dikemas</option>
                    <option value="siap kirim">Siap Kirim</option>
                    <option value="sedang dikirim">Dalam Pengiriman</option>
                    <option value="received">Diterima</option>
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>Catatan Admin</FormLabel>
                  <Textarea 
                    value={adminNote}
                    onChange={e => setAdminNote(e.target.value)}
                    placeholder="Tambahkan catatan terkait pesanan (opsional)"
                  />
                </FormControl>

                <Button 
                  colorScheme="blue" 
                  onClick={handleUpdateStatus}
                  isLoading={isUpdating}
                  isDisabled={order.shipping_status === shippingStatus}
                >
                  Perbarui Status Pesanan
                </Button>

                <Divider />

                <Button 
                  onClick={handleRefreshStatus}
                  isLoading={isRefreshing}
                  variant="outline"
                >
                  Perbarui Status Pembayaran dari Midtrans
                </Button>

                {isPaid && order.payment_url && (
                  <Button 
                    as="a"
                    href={order.payment_url} 
                    target="_blank"
                    variant="outline"
                  >
                    Lihat Detail Pembayaran di Midtrans
                  </Button>
                )}

                <Button 
                  as={RouterLink}
                  to="/admin/orders/new"
                  colorScheme="teal"
                >
                  Buat Pesanan Baru
                </Button>
              </VStack>
            </CardBody>
            <CardFooter>
              <Button 
                onClick={onOpen} 
                colorScheme="red" 
                variant="ghost" 
                size="sm" 
                width="full"
              >
                Batalkan Pesanan
              </Button>
            </CardFooter>
          </Card>
        </GridItem>
      </SimpleGrid>

      {/* Cancel Order Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Batalkan Pesanan</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>Apakah Anda yakin ingin membatalkan pesanan ini? Tindakan ini tidak dapat dibatalkan.</Text>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="red" mr={3}>
              Ya, Batalkan
            </Button>
            <Button variant="ghost" onClick={onClose}>Batal</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      </Box>
    </AdminLayout>
  );
}

export default AdminOrderDetailPage;
