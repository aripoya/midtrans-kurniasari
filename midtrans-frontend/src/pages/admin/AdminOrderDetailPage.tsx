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
import { adminApi, Order, Outlet } from '../../api/adminApi';
import ShippingImageDisplay from '../../components/ShippingImageDisplay';

type ShippingImages = {
  ready_for_pickup: string | null;
  picked_up: string | null;
  delivered: string | null;
};

// Normalize Midtrans/payment statuses to FE canonical values
const normalizePaymentStatus = (status?: string): 'paid' | 'pending' | 'failed' | string => {
  const s = (status || '').toLowerCase();
  if (['paid', 'settlement', 'capture'].includes(s)) return 'paid';
  if (['pending', 'authorize'].includes(s)) return 'pending';
  if (['failed', 'deny', 'cancel', 'cancelled', 'expired'].includes(s)) return 'failed';
  return s || 'pending';
};

const paymentLabelID = (normalized: string) => {
  if (normalized === 'paid') return 'LUNAS';
  if (normalized === 'pending') return 'MENUNGGU';
  return 'GAGAL';
};

const AdminOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Edit states
  const [formData, setFormData] = useState<Partial<Order>>({});
  const [updateLoading, setUpdateLoading] = useState(false);
  
  // Modal states
  const { isOpen: isStatusOpen, onOpen: onStatusOpen, onClose: onStatusClose } = useDisclosure();
  const { isOpen: isPaymentOpen, onOpen: onPaymentOpen, onClose: onPaymentClose } = useDisclosure();
  
  // Status update states
  const [newShippingStatus, setNewShippingStatus] = useState('');
  const [newPaymentStatus, setNewPaymentStatus] = useState('');
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [shippingImages, setShippingImages] = useState<ShippingImages>({
    ready_for_pickup: null,
    picked_up: null,
    delivered: null,
  });

  const transformURL = (url: string): string => {
    if (!url) return url;
    if (url.includes('imagedelivery.net') || url.includes('cloudflareimages.com')) return url;
    if (url.includes('/api/images/')) {
      const filename = url.split('/').pop();
      if (filename) return `https://imagedelivery.net/ZB3RMqDfebexy8n_rRUJkA/${filename}/public`;
    }
    try {
      const last = url.split('/').pop() || '';
      const imageId = last.split('?')[0];
      if (imageId && imageId.length > 10) {
        return `https://imagedelivery.net/ZB3RMqDfebexy8n_rRUJkA/${imageId}/public`;
      }
    } catch {}
    return url;
  };

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
          setFormData(response.data); // Initialize form data

          // Fetch shipping images from public endpoint for consistency with outlet/public
          try {
            const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://order-management-app-production.wahwooh.workers.dev';
            const res = await fetch(`${apiUrl}/api/test-shipping-photos/${id}`);
            if (res.ok) {
              const data = await res.json();
              const images = data.success ? data.data : data;
              const processed: ShippingImages = { ready_for_pickup: null, picked_up: null, delivered: null };
              (['ready_for_pickup','picked_up','delivered'] as const).forEach((k) => {
                if (images?.[k]?.url) processed[k] = transformURL(images[k].url);
              });
              setShippingImages(processed);
            }
          } catch (e) {
            console.error('[AdminOrderDetail] Failed to fetch shipping images', e);
          }
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

    const fetchOutlets = async () => {
      try {
        const response = await adminApi.getUnifiedOutlets();
        if (response.success && response.data) {
          setOutlets(response.data);
        } else {
          console.error("Failed to fetch outlets:", response.error);
          toast({ title: 'Gagal Memuat Outlet', description: response.error, status: 'error' });
        }
      } catch (error) {
        console.error("Error fetching outlets:", error);
        toast({ title: 'Error', description: 'Tidak dapat memuat daftar outlet.', status: 'error' });
      }
    };

    fetchOutlets();
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

  // Handle form input changes
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle form submission
  const handleFormSubmit = async () => {
    if (!id) return;
    try {
      setUpdateLoading(true);
      const response = await adminApi.updateOrderDetails(id, formData);
      if (!response.success) throw new Error(response.error || 'Gagal menyimpan perubahan');

      // Reload order from backend to ensure fresh data
      const orderResponse = await adminApi.getOrderDetails(id);
      if (orderResponse.success && orderResponse.data) {
        setOrder(orderResponse.data);
        setFormData(orderResponse.data);
      }
      
      toast({
        title: 'Berhasil',
        description: 'Detail pesanan berhasil diperbarui',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Gagal menyimpan perubahan',
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
      // Only shipping status can be updated manually here
      if (type === 'payment') {
        toast({
          title: 'Tidak dapat diubah',
          description: 'Status pembayaran disinkronkan dari Midtrans dan tidak bisa diubah manual.',
          status: 'info',
          duration: 4000,
          isClosable: true,
        });
        onPaymentClose();
        setUpdateLoading(false);
        return;
      }

      const response = await adminApi.updateOrderStatus(id, status);
      
      if (response.success) {
        // Reload order data
        const orderResponse = await adminApi.getOrderDetails(id);
        if (orderResponse.success && orderResponse.data) {
          setOrder(orderResponse.data);
        }
        
        onStatusClose();
        setNewShippingStatus('');
        
        toast({
          title: 'Berhasil',
          description: 'Status pengiriman berhasil diperbarui',
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
        description: error.message || 'Gagal memperbarui status',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setUpdateLoading(false);
    }
  };


  return (
    <Box p={6}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Box>
          <HStack justify="space-between" align="center" mb={3}>
            <Button as={RouterLink} to="/admin/orders" variant="ghost">
              ← Kembali ke Daftar Pesanan
            </Button>
          </HStack>
          <HStack spacing={4} align="center" flexWrap="wrap">
            <Heading size="lg">Detail Pesanan #{order.id}</Heading>
            {(() => { const n = normalizePaymentStatus(order.payment_status); return (
              <Badge colorScheme={n === 'paid' ? 'green' : n === 'pending' ? 'yellow' : 'red'}>
                Pembayaran: {n === 'paid' ? 'LUNAS' : paymentLabelID(n)}
              </Badge>
            ); })()}
            <Badge colorScheme="blue">Pengiriman: {order.shipping_status?.toUpperCase()}</Badge>
            <Badge colorScheme={order.shipping_area === 'luar-kota' ? 'orange' : 'blue'}>
              {order.shipping_area === 'luar-kota' ? 'LUAR KOTA' : 'DALAM KOTA'}
            </Badge>
          </HStack>
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
                          {(() => { const n = normalizePaymentStatus(order.payment_status); return (
                            <Badge colorScheme={n === 'paid' ? 'green' : n === 'pending' ? 'yellow' : 'red'}>
                              {paymentLabelID(n)}
                            </Badge>
                          ); })()}
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
                      {order.admin_note && (
                        <Tr>
                          <Td fontWeight="semibold">Catatan Admin</Td>
                          <Td>{order.admin_note}</Td>
                        </Tr>
                      )}
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
                      
                      <Tr>
                        <Td fontWeight="semibold">Lokasi Pengambilan</Td>
                        <Td>{order.pickup_location || 'Outlet Bonbin'}</Td>
                      </Tr>
                      <Tr>
                        <Td fontWeight="semibold">Metode Pengiriman</Td>
                        <Td>{order.pickup_method === 'deliveryman' ? 'Kurir Toko' : order.pickup_method === 'ojek-online' ? 'Ojek Online' : (order.pickup_method || '-')}</Td>
                      </Tr>
                      <Tr>
                        <Td fontWeight="semibold">Layanan Kurir</Td>
                        <Td>{order.courier_service || 'TRAVEL'}</Td>
                      </Tr>
                      <Tr>
                        <Td fontWeight="semibold">Tipe Pesanan</Td>
                        <Td>{order.tipe_pesanan || 'Pesan Antar'}</Td>
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

        {/* Edit Form */}
        <Card>
          <CardHeader>
            <Heading size="md">Edit Detail Pesanan</Heading>
          </CardHeader>
          <CardBody>
            <VStack as="form" spacing={4} align="stretch" onSubmit={(e) => { e.preventDefault(); handleFormSubmit(); }}>
              <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                <GridItem>
                  <Text fontWeight="semibold">Nama Pelanggan</Text>
                  <Input name="customer_name" value={formData.customer_name || ''} onChange={handleFormChange} />
                </GridItem>
                <GridItem>
                  <Text fontWeight="semibold">No. Telepon</Text>
                  <Input name="customer_phone" value={formData.customer_phone || ''} onChange={handleFormChange} />
                </GridItem>
                <GridItem>
                  <Text fontWeight="semibold">Email</Text>
                  <Input name="customer_email" value={formData.customer_email || ''} onChange={handleFormChange} />
                </GridItem>
                <GridItem>
                  <Text fontWeight="semibold">Area Pengiriman</Text>
                  <Select name="shipping_area" value={formData.shipping_area || ''} onChange={handleFormChange}>
                    <option value="dalam-kota">Dalam Kota</option>
                    <option value="luar-kota">Luar Kota</option>
                  </Select>
                </GridItem>
                <GridItem>
                  <Text fontWeight="semibold">Metode Pengiriman</Text>
                  <Select name="pickup_method" value={formData.pickup_method || ''} onChange={handleFormChange}>
                    <option value="deliveryman">Kurir Toko</option>
                    <option value="ojek-online">Ojek Online</option>
                  </Select>
                </GridItem>
                <GridItem>
                  <Text fontWeight="semibold">Tipe Pesanan</Text>
                  <Select name="tipe_pesanan" value={formData.tipe_pesanan || ''} onChange={handleFormChange} placeholder="Pilih tipe pesanan">
                    <option value="Pesan Antar">Pesan Antar</option>
                    <option value="Pesan Ambil">Pesan Ambil</option>
                  </Select>
                </GridItem>
                <GridItem>
                  <Text fontWeight="semibold">Layanan Kurir</Text>
                  {formData.pickup_method === 'ojek-online' ? (
                    <Select name="courier_service" value={formData.courier_service || ''} onChange={handleFormChange} placeholder="Pilih layanan">
                      <option value="Gojek">Gojek</option>
                      <option value="Grab">Grab</option>
                    </Select>
                  ) : (
                    <Input name="courier_service" value={formData.courier_service || ''} onChange={handleFormChange} />
                  )}
                </GridItem>
                <GridItem>
                  <Text fontWeight="semibold">Nomor Resi</Text>
                  <Input name="tracking_number" value={formData.tracking_number || ''} onChange={handleFormChange} />
                </GridItem>
                <GridItem>
                  <Text fontWeight="semibold">Lokasi Pengiriman</Text>
                  <Select name="lokasi_pengiriman" value={formData.lokasi_pengiriman || ''} onChange={handleFormChange} placeholder="Pilih Lokasi Pengiriman">
                    {outlets.map(outlet => (
                      <option key={outlet.id} value={outlet.name}>
                        {outlet.name}
                      </option>
                    ))}
                  </Select>
                </GridItem>
                 <GridItem>
                  <Text fontWeight="semibold">Lokasi Pengambilan</Text>
                  <Input name="pickup_location" value={formData.pickup_location || ''} onChange={handleFormChange} />
                </GridItem>
              </Grid>
              <Box>
                <Text fontWeight="semibold">Catatan Admin</Text>
                <Textarea name="admin_note" value={formData.admin_note || ''} onChange={handleFormChange} placeholder="Tambahkan catatan pesanan..." />
              </Box>
              <Button type="submit" colorScheme="blue" isLoading={updateLoading} size="lg">
                Simpan Perubahan
              </Button>
            </VStack>
          </CardBody>
        </Card>

        {/* Status Foto Pesanan */}
        <Card>
          <CardHeader>
            <Heading size="md">Status Foto Pesanan</Heading>
          </CardHeader>
          <CardBody>
            <Grid templateColumns="repeat(3, 1fr)" gap={4}>
              <Box>
                <Text fontWeight="semibold" mb={2} textAlign="center">Foto Siap Kirim</Text>
                <ShippingImageDisplay
                  imageUrl={shippingImages.ready_for_pickup ?? undefined}
                  type="ready_for_pickup"
                  label="Foto Siap Kirim"
                  showPlaceholder={true}
                  maxHeight="180px"
                />
              </Box>
              <Box>
                <Text fontWeight="semibold" mb={2} textAlign="center">Foto Pengiriman</Text>
                <ShippingImageDisplay
                  imageUrl={shippingImages.picked_up ?? undefined}
                  type="picked_up"
                  label="Foto Pengiriman"
                  showPlaceholder={true}
                  maxHeight="180px"
                />
              </Box>
              <Box>
                <Text fontWeight="semibold" mb={2} textAlign="center">Foto Diterima</Text>
                <ShippingImageDisplay
                  imageUrl={shippingImages.delivered ?? undefined}
                  type="delivered"
                  label="Foto Diterima"
                  showPlaceholder={true}
                  maxHeight="180px"
                />
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
              {(() => { const n = normalizePaymentStatus(order.payment_status); return (
                <Text>Status saat ini: <Badge colorScheme={n === 'paid' ? 'green' : n === 'pending' ? 'yellow' : 'red'}>{paymentLabelID(n)}</Badge></Text>
              ); })()}
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
// Force deployment Sun Aug 24 16:02:10 WIB 2025
