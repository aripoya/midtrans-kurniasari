import React, { useState, useEffect } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Box, Heading, Text, VStack, Badge, Button,
  Table, Tbody, Tr, Td, Spinner,
  Alert, AlertIcon, Card, CardBody,
  useToast
} from '@chakra-ui/react';
import { adminApi, Order } from '../../api/adminApi';
import EditableLokasiPengiriman from '../../components/EditableLokasiPengiriman';

const AdminOrderDetailPageWorking: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Box p={6}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Box>
          <Button as={RouterLink} to="/admin/orders" variant="ghost" mb={4}>
            ← Back to Orders
          </Button>
          <Heading size="lg">Order Detail #{order.id}</Heading>
        </Box>

        {/* Order Information Card */}
        <Card>
          <CardBody>
            <Heading size="md" mb={4}>Order Information</Heading>
            <Table variant="simple">
              <Tbody>
                <Tr>
                  <Td fontWeight="semibold" w="200px">Order ID</Td>
                  <Td>{order.id}</Td>
                </Tr>
                <Tr>
                  <Td fontWeight="semibold">Customer</Td>
                  <Td>{order.customer_name}</Td>
                </Tr>
                <Tr>
                  <Td fontWeight="semibold">Phone</Td>
                  <Td>{order.customer_phone}</Td>
                </Tr>
                <Tr>
                  <Td fontWeight="semibold">Total Amount</Td>
                  <Td>Rp {order.total_amount?.toLocaleString('id-ID')}</Td>
                </Tr>
                <Tr>
                  <Td fontWeight="semibold">Payment Status</Td>
                  <Td>
                    <Badge colorScheme={order.payment_status === 'paid' ? 'green' : 'red'}>
                      {order.payment_status}
                    </Badge>
                  </Td>
                </Tr>
                <Tr>
                  <Td fontWeight="semibold">Shipping Status</Td>
                  <Td>
                    <Badge colorScheme="blue">
                      {order.shipping_status}
                    </Badge>
                  </Td>
                </Tr>
                <Tr>
                  <Td fontWeight="semibold">Shipping Area</Td>
                  <Td>
                    <Badge colorScheme={order.shipping_area === 'luar-kota' ? 'orange' : 'blue'}>
                      {order.shipping_area === 'luar-kota' ? 'Luar Kota' : 'Dalam Kota'}
                    </Badge>
                  </Td>
                </Tr>

                {/* Editable Lokasi Pengiriman - only for Dalam Kota orders */}
                {order.shipping_area === 'dalam-kota' && (
                  <Tr>
                    <Td fontWeight="semibold">
                      {order.shipping_status === 'Siap Kirim' ? 'Tujuan Pengiriman' : 'Lokasi Pengiriman'}
                    </Td>
                    <Td>
                      <EditableLokasiPengiriman 
                        order={order} 
                        onOrderUpdate={setOrder}
                      />
                    </Td>
                  </Tr>
                )}

                <Tr>
                  <Td fontWeight="semibold">Pickup Method</Td>
                  <Td>{order.pickup_method}</Td>
                </Tr>
                <Tr>
                  <Td fontWeight="semibold">Created At</Td>
                  <Td>{new Date(order.created_at).toLocaleString('id-ID')}</Td>
                </Tr>
              </Tbody>
            </Table>
          </CardBody>
        </Card>
      </VStack>
    </Box>
  );
};

export default AdminOrderDetailPageWorking;
