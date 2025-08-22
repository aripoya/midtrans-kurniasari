import React, { useState, useEffect } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box, Heading, VStack, HStack, Badge, Button,
  Table, Tbody, Tr, Td, Spinner, Grid, GridItem,
  Alert, AlertIcon, Card, CardBody, CardHeader,
  useToast, Input, Textarea, Select, Text,
  Modal, ModalOverlay, ModalContent, ModalHeader,
  ModalFooter, ModalBody, ModalCloseButton,
  useDisclosure, Divider
} from '@chakra-ui/react';
import { adminApi, Order } from '../../api/adminApi';
import EditableLokasiPengiriman from '../../components/EditableLokasiPengiriman';

const AdminOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editedOrder, setEditedOrder] = useState<Order | null>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  
  // Modal states
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const { isOpen: isStatusOpen, onOpen: onStatusOpen, onClose: onStatusClose } = useDisclosure();
  const { isOpen: isPaymentOpen, onOpen: onPaymentOpen, onClose: onPaymentClose } = useDisclosure();
  
  // Status update states
  const [newShippingStatus, setNewShippingStatus] = useState('');
  const [newPaymentStatus, setNewPaymentStatus] = useState('');

  // Load order data
  useEffect(() => {
    const loadOrder = async () => {
      if (!id) {
        setError('Order ID not found');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await adminApi.getOrderDetails(id);
        
        if (response.success && response.data) {
          console.log('Order data loaded:', response.data);
          setOrder(response.data);
        } else {
          throw new Error(response.error || 'Failed to load order');
        }
      } catch (error: any) {
        console.error('Error loading order:', error);
        const errorMessage = error.message || 'Failed to load order';
        setError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [id, toast]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="400px">
        <Spinner size="xl" />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert status="error">
        <AlertIcon />
        {error}
      </Alert>
    );
  }

  if (!order) {
    return (
      <Alert status="warning">
        <AlertIcon />
        Order not found
      </Alert>
    );
  }

  // Handle update order
  const handleUpdateOrder = async () => {
    if (!editedOrder || !id) return;
    
    try {
      setUpdateLoading(true);
      const response = await adminApi.updateOrder(id, editedOrder);
      
      if (response.success) {
        setOrder(editedOrder);
        setIsEditing(false);
        onEditClose();
        toast({
          title: 'Success',
          description: 'Order updated successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        throw new Error(response.error || 'Failed to update order');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update order',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setUpdateLoading(false);
    }
  };

  // Handle status updates
  const handleStatusUpdate = async (type: 'shipping' | 'payment') => {
    if (!id) return;
    
    try {
      setUpdateLoading(true);
      const status = type === 'shipping' ? newShippingStatus : newPaymentStatus;
      
      const response = await adminApi.updateOrderStatus(id, type, status);
      
      if (response.success) {
        // Reload order data
        const orderResponse = await adminApi.getOrderDetails(id);
        if (orderResponse.success && orderResponse.data) {
          setOrder(orderResponse.data);
        }
        
        if (type === 'shipping') {
          onStatusClose();
          setNewShippingStatus('');
        } else {
          onPaymentClose();
          setNewPaymentStatus('');
        }
        
        toast({
          title: 'Success',
          description: `${type === 'shipping' ? 'Shipping' : 'Payment'} status updated`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        throw new Error(response.error || 'Failed to update status');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update status',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setUpdateLoading(false);
    }
  };

  // Start editing
  const startEdit = () => {
    setEditedOrder({ ...order });
    setIsEditing(true);
    onEditOpen();
  };

  return (
    <Box p={6}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Box>
          <HStack justify="space-between" align="center" mb={4}>
            <Button as={RouterLink} to="/admin/orders" variant="ghost">
              ← Kembali ke Daftar Pesanan
            </Button>
            <HStack>
              <Button colorScheme="blue" onClick={startEdit}>
                Edit Catatan
              </Button>
            </HStack>
          </HStack>
          <Heading size="lg">Detail Pesanan</Heading>
        </Box>

        {/* Main Content Grid */}
        <Grid templateColumns={{ base: "1fr", lg: "2fr 1fr" }} gap={6}>
          {/* Left Column - Order Information */}
          <GridItem>
            <VStack spacing={4} align="stretch">
              {/* Order Information Card */}
              <Card>
                <CardHeader>
                  <Heading size="md">Informasi Pesanan</Heading>
                </CardHeader>
                <CardBody>
                  <Table variant="simple" size="sm">
                    <Tbody>
                      <Tr>
                        <Td fontWeight="semibold" w="180px">ID Pesanan</Td>
                        <Td>{order.id}</Td>
                      </Tr>
                      <Tr>
                        <Td fontWeight="semibold">Nama Pelanggan</Td>
                        <Td>{order.customer_name}</Td>
                      </Tr>
                      <Tr>
                        <Td fontWeight="semibold">No. Telepon</Td>
                        <Td>{order.customer_phone}</Td>
                      </Tr>
                      <Tr>
                        <Td fontWeight="semibold">Email</Td>
                        <Td>{order.customer_email || 'Tidak ada'}</Td>
                      </Tr>
                      <Tr>
                        <Td fontWeight="semibold">Total Pembayaran</Td>
                        <Td>Rp {order.total_amount?.toLocaleString('id-ID')}</Td>
                      </Tr>
                      <Tr>
                        <Td fontWeight="semibold">Status Pembayaran</Td>
                        <Td>
                          <Badge colorScheme={order.payment_status === 'paid' ? 'green' : order.payment_status === 'pending' ? 'yellow' : 'red'}>
                            {order.payment_status?.toUpperCase()}
                          </Badge>
                        </Td>
                      </Tr>
                      <Tr>
                        <Td fontWeight="semibold">Status Pengiriman</Td>
                        <Td>
                          <Badge colorScheme="blue">
                            {order.shipping_status?.toUpperCase()}
                          </Badge>
                        </Td>
                      </Tr>
                      <Tr>
                        <Td fontWeight="semibold">Tanggal Dibuat</Td>
                        <Td>{new Date(order.created_at).toLocaleDateString('id-ID')}</Td>
                      </Tr>
                      <Tr>
                        <Td fontWeight="semibold">Metode Pembayaran</Td>
                        <Td>{order.payment_method || 'Transfer'}</Td>
                      </Tr>
                      <Tr>
                        <Td fontWeight="semibold">Area Pengiriman</Td>
                        <Td>
                          <Badge colorScheme={order.shipping_area === 'luar-kota' ? 'orange' : 'blue'}>
                            {order.shipping_area === 'luar-kota' ? 'LUAR KOTA' : 'DALAM KOTA'}
                          </Badge>
                        </Td>
                      </Tr>
                      
                      {/* Editable fields */}
                      {order.shipping_area === 'dalam-kota' && (
                        <Tr>
                          <Td fontWeight="semibold">Lokasi Pengiriman</Td>
                          <Td>
                            <EditableLokasiPengiriman 
                              order={order} 
                              onOrderUpdate={setOrder}
                            />
                          </Td>
                        </Tr>
                      )}
                      
                      <Tr>
                        <Td fontWeight="semibold">Lokasi Pengambilan</Td>
                        <Td>{order.pickup_location || 'Outlet Bonbin'}</Td>
                      </Tr>
                      <Tr>
                        <Td fontWeight="semibold">Metode Pengiriman</Td>
                        <Td>{order.pickup_method}</Td>
                      </Tr>
                      <Tr>
                        <Td fontWeight="semibold">Layanan Kurir</Td>
                        <Td>{order.courier_service || 'TRAVEL'}</Td>
                      </Tr>
                      <Tr>
                        <Td fontWeight="semibold">Tipe Pesanan</Td>
                        <Td>{order.order_type || 'Pesan Antar'}</Td>
                      </Tr>
                      <Tr>
                        <Td fontWeight="semibold">Terakhir Diupdate</Td>
                        <Td>{new Date(order.updated_at || order.created_at).toLocaleDateString('id-ID')}</Td>
                      </Tr>
                    </Tbody>
                  </Table>
                </CardBody>
              </Card>

              {/* Action Buttons */}
              <Card>
                <CardBody>
                  <VStack spacing={3}>
                    <Button 
                      colorScheme="blue" 
                      width="full" 
                      size="lg"
                      onClick={onStatusOpen}
                    >
                      Perbarui Status Pesanan
                    </Button>
                    <Button 
                      colorScheme="teal" 
                      width="full" 
                      size="lg"
                      onClick={onPaymentOpen}
                    >
                      Perbarui Status Pembayaran dari Midtrans
                    </Button>
                    <Button 
                      colorScheme="green" 
                      width="full" 
                      size="lg"
                      onClick={() => navigate('/admin/orders/new')}
                    >
                      Buat Pesanan Baru
                    </Button>
                    <Button 
                      colorScheme="red" 
                      variant="outline" 
                      width="full"
                      size="lg"
                    >
                      Batalkan Pesanan
                    </Button>
                  </VStack>
                </CardBody>
              </Card>
            </VStack>
          </GridItem>

          {/* Right Column - Item Pesanan */}
          <GridItem>
            <VStack spacing={4} align="stretch">
              <Card>
                <CardHeader>
                  <Heading size="md">Item Pesanan</Heading>
                </CardHeader>
                <CardBody>
                  <VStack align="stretch" spacing={3}>
                    {order.items && order.items.length > 0 ? (
                      order.items.map((item: any, index: number) => (
                        <Box key={index} p={3} borderWidth={1} borderRadius="md">
                          <HStack justify="space-between">
                            <Text fontWeight="semibold">{item.product_name || item.name}</Text>
                            <Text>Qty: {item.quantity}</Text>
                          </HStack>
                          <Text fontSize="sm" color="gray.600">
                            Rp {(item.price || 0).toLocaleString('id-ID')}
                          </Text>
                        </Box>
                      ))
                    ) : (
                      <Box p={3} borderWidth={1} borderRadius="md">
                        <Text fontWeight="semibold">bakpia</Text>
                        <HStack justify="space-between">
                          <Text fontSize="sm" color="gray.600">Qty: 1</Text>
                          <Text fontSize="sm" color="gray.600">
                            Rp {order.total_amount?.toLocaleString('id-ID')}
                          </Text>
                        </HStack>
                      </Box>
                    )}
                  </VStack>
                </CardBody>
              </Card>
            </VStack>
          </GridItem>
        </Grid>

        {/* Status Foto Pesanan */}
        <Card>
          <CardHeader>
            <Heading size="md">Status Foto Pesanan</Heading>
          </CardHeader>
          <CardBody>
            <Grid templateColumns="repeat(3, 1fr)" gap={4}>
              <Box textAlign="center">
                <Text fontWeight="semibold" mb={2}>Foto Siap Kirim</Text>
                <Text color="gray.500" fontSize="sm">Belum ada foto</Text>
              </Box>
              <Box textAlign="center">
                <Text fontWeight="semibold" mb={2}>Foto Pengiriman</Text>
                <Text color="gray.500" fontSize="sm">Belum ada foto</Text>
              </Box>
              <Box textAlign="center">
                <Text fontWeight="semibold" mb={2}>Foto Diterima</Text>
                <Text color="gray.500" fontSize="sm">Belum ada foto</Text>
              </Box>
            </Grid>
            <Divider my={4} />
            <Box textAlign="center">
              <Button colorScheme="blue">
                📱 Generate QR Code
              </Button>
            </Box>
          </CardBody>
        </Card>
      </VStack>

      {/* Edit Order Modal */}
      <Modal isOpen={isEditOpen} onClose={onEditClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Catatan Pesanan</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {editedOrder && (
              <VStack spacing={4}>
                <Box w="full">
                  <Text fontWeight="semibold" mb={2}>Nama Pelanggan</Text>
                  <Input
                    value={editedOrder.customer_name || ''}
                    onChange={(e) => setEditedOrder({...editedOrder, customer_name: e.target.value})}
                  />
                </Box>
                <Box w="full">
                  <Text fontWeight="semibold" mb={2}>No. Telepon</Text>
                  <Input
                    value={editedOrder.customer_phone || ''}
                    onChange={(e) => setEditedOrder({...editedOrder, customer_phone: e.target.value})}
                  />
                </Box>
                <Box w="full">
                  <Text fontWeight="semibold" mb={2}>Email</Text>
                  <Input
                    value={editedOrder.customer_email || ''}
                    onChange={(e) => setEditedOrder({...editedOrder, customer_email: e.target.value})}
                  />
                </Box>
                <Box w="full">
                  <Text fontWeight="semibold" mb={2}>Catatan</Text>
                  <Textarea
                    value={editedOrder.notes || ''}
                    onChange={(e) => setEditedOrder({...editedOrder, notes: e.target.value})}
                    placeholder="Tambahkan catatan pesanan..."
                  />
                </Box>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onEditClose}>
              Batal
            </Button>
            <Button 
              colorScheme="blue" 
              onClick={handleUpdateOrder}
              isLoading={updateLoading}
            >
              Simpan Perubahan
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Update Shipping Status Modal */}
      <Modal isOpen={isStatusOpen} onClose={onStatusClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Perbarui Status Pengiriman</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Text>Status saat ini: <Badge colorScheme="blue">{order.shipping_status}</Badge></Text>
              <Box w="full">
                <Text fontWeight="semibold" mb={2}>Status Baru</Text>
                <Select 
                  value={newShippingStatus}
                  onChange={(e) => setNewShippingStatus(e.target.value)}
                  placeholder="Pilih status baru"
                >
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="dikemas">Dikemas</option>
                  <option value="siap kirim">Siap Kirim</option>
                  <option value="shipping">Shipping</option>
                  <option value="delivered">Delivered</option>
                </Select>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onStatusClose}>
              Batal
            </Button>
            <Button 
              colorScheme="blue" 
              onClick={() => handleStatusUpdate('shipping')}
              isLoading={updateLoading}
              isDisabled={!newShippingStatus}
            >
              Update Status
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Update Payment Status Modal */}
      <Modal isOpen={isPaymentOpen} onClose={onPaymentClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Perbarui Status Pembayaran</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Text>Status saat ini: <Badge colorScheme={order.payment_status === 'paid' ? 'green' : 'red'}>{order.payment_status}</Badge></Text>
              <Box w="full">
                <Text fontWeight="semibold" mb={2}>Status Baru</Text>
                <Select 
                  value={newPaymentStatus}
                  onChange={(e) => setNewPaymentStatus(e.target.value)}
                  placeholder="Pilih status baru"
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </Select>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onPaymentClose}>
              Batal
            </Button>
            <Button 
              colorScheme="blue" 
              onClick={() => handleStatusUpdate('payment')}
              isLoading={updateLoading}
              isDisabled={!newPaymentStatus}
            >
              Update Status
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default AdminOrderDetailPage;
// Force deployment Fri Aug 22 21:03:41 WIB 2025
