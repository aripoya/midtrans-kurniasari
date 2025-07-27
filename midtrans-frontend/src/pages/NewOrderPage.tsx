import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Heading, FormControl, FormLabel, Input, Button,
  VStack, HStack, Text, NumberInput, NumberInputField,
  FormErrorMessage, useToast, Card, CardBody, Grid, GridItem,
  Table, Thead, Tbody, Tr, Th, Td, TableContainer, IconButton,
  useBreakpointValue, Stack, Divider, Flex, Textarea
} from '@chakra-ui/react';
import CreatableSelect from 'react-select/creatable';
import { DeleteIcon } from '@chakra-ui/icons';
import { orderService } from '../api/orderService';
import { productService } from '../api/productService';
import { loadMidtransScript } from '../utils/midtransHelper';

// TypeScript interfaces
interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
}

interface OrderItem {
  productId: string | null;
  name: string;
  price: string | number;
  quantity: number;
  isCustom: boolean;
}

interface FormData {
  customer_name: string;
  email: string;
  phone: string;
  customer_address: string;
}

interface FormErrors {
  [key: string]: string;
}

interface SelectOption {
  value: string;
  label: string;
  __isNew__?: boolean;
}

interface MidtransCallbackResult {
  transaction_status: string;
  order_id: string;
  payment_type: string;
}

const NewOrderPage: React.FC = () => {
  const isMobile = useBreakpointValue({ base: true, lg: false });
  const navigate = useNavigate();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [items, setItems] = useState<OrderItem[]>([{ productId: '', name: '', price: '', quantity: 1, isCustom: false }]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [formData, setFormData] = useState<FormData>({
    customer_name: '',
    email: '',
    phone: '',
    customer_address: ''
  });

  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    const fetchProducts = async (): Promise<void> => {
      try {
        const data = await productService.getProducts();
        setProducts(data.products || []);
      } catch (error) {
        toast({ 
          title: "Gagal memuat produk", 
          description: "Tidak dapat mengambil daftar produk dari server.", 
          status: "error", 
          duration: 5000, 
          isClosable: true 
        });
      }
    };
    fetchProducts();
  }, [toast]);

  const handleFormChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) setErrors({ ...errors, [name]: '' });
  };

  const handleProductChange = (index: number, selectedOption: SelectOption | null): void => {
    const newItems = [...items];
    if (!selectedOption) {
      // Item cleared
      newItems[index] = { productId: '', name: '', price: '', quantity: 1, isCustom: false };
    } else if (selectedOption.__isNew__) {
      // Handle new, custom product
      newItems[index] = { ...newItems[index], productId: null, name: selectedOption.value, price: '', isCustom: true };
    } else {
      // Handle existing product
      const selectedProduct = products.find(p => p.id === selectedOption.value);
      if (selectedProduct) {
        newItems[index] = { 
          ...newItems[index], 
          productId: selectedProduct.id, 
          name: selectedProduct.name, 
          price: selectedProduct.price, 
          isCustom: false 
        };
      }
    }
    setItems(newItems);

    const newErrors = { ...errors };
    delete newErrors[`items[${index}].name`];
    delete newErrors[`items[${index}].price`];
    setErrors(newErrors);
  };

  const handleItemChange = (index: number, field: keyof OrderItem, value: string | number): void => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
    if (errors[`items[${index}].${field}`]) {
      const newErrors = { ...errors };
      delete newErrors[`items[${index}].${field}`];
      setErrors(newErrors);
    }
  };

  const addItem = (): void => {
    setItems(prev => [...prev, { productId: '', name: '', price: '', quantity: 1, isCustom: false }]);
  };

  const removeItem = (index: number): void => {
    if (items.length === 1) {
      toast({
        title: "Tidak dapat menghapus",
        description: "Order harus memiliki minimal 1 item",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.customer_name) newErrors.customer_name = 'Nama pelanggan wajib diisi';
    if (!formData.email) newErrors.email = 'Email wajib diisi';
    else if (!formData.email.match(/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/)) newErrors.email = 'Format email tidak valid';
    if (!formData.phone) newErrors.phone = 'Nomor telepon wajib diisi';
    
    items.forEach((item, index) => {
      if (!item.name) {
        newErrors[`items[${index}].name`] = 'Nama produk wajib diisi';
      }
      if (!item.price || Number(item.price) <= 0) {
        newErrors[`items[${index}].price`] = 'Harga produk wajib diisi dan harus lebih dari 0';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateTotal = (): number => {
    return items.reduce((total, item) => total + (Number(item.price) * Number(item.quantity)), 0);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: "Form tidak valid",
        description: "Harap periksa kembali data yang diisi",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    setIsLoading(true);

    try {
      const orderData = {
        customer_name: formData.customer_name,
        customer_phone: formData.phone,
        customer_address: formData.customer_address,
        email: formData.email,
        shipping_area: 'dalam_kota' as const,
        pickup_method: 'delivery',
        items: items.map(item => ({
          product_id: item.productId,
          product_name: item.name,
          product_price: Number(item.price),
          quantity: Number(item.quantity)
        })),
        total_amount: calculateTotal()
      };

      console.log('🚀 [DEBUG] Order data being sent:', JSON.stringify(orderData, null, 2));
      console.log('🚀 [DEBUG] Items count:', orderData.items.length);
      console.log('🚀 [DEBUG] Total amount:', orderData.total_amount);
      
      const response = await orderService.createOrder(orderData);
      console.log('🚀 [DEBUG] Order service response:', JSON.stringify(response, null, 2));
      
      if (response.success && response.data) {
        // Load Midtrans script and show payment page
        await loadMidtransScript();
        
        if (window.snap) {
          window.snap.pay(response.data.snap_token, {
            onSuccess: (result: MidtransCallbackResult) => {
              toast({
                title: "Pembayaran berhasil!",
                description: "Pesanan Anda telah dibuat dan pembayaran berhasil diproses.",
                status: "success",
                duration: 5000,
                isClosable: true,
              });
              navigate(`/orders/${response.data.order_id}`);
            },
            onPending: (result: MidtransCallbackResult) => {
              toast({
                title: "Pembayaran pending",
                description: "Silakan selesaikan pembayaran Anda.",
                status: "info",
                duration: 5000,
                isClosable: true,
              });
              navigate(`/orders/${response.data.order_id}`);
            },
            onError: (result: MidtransCallbackResult) => {
              toast({
                title: "Pembayaran gagal",
                description: "Terjadi kesalahan saat memproses pembayaran.",
                status: "error",
                duration: 5000,
                isClosable: true,
              });
            },
            onClose: () => {
              // User closed the payment popup
              navigate(`/orders/${response.data.order_id}`);
            }
          });
        } else {
          throw new Error('Midtrans script not loaded');
        }
      } else {
        throw new Error(response.message || 'Gagal membuat pesanan');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      toast({
        title: "Gagal membuat pesanan",
        description: error instanceof Error ? error.message : "Terjadi kesalahan yang tidak dikenal",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box maxW="6xl" mx="auto" p={{ base: 4, md: 6 }}>
      <Heading mb={{ base: 6, md: 8 }} textAlign="center" size={{ base: "lg", md: "xl" }}>
        Buat Pesanan Baru
      </Heading>
      
      <form onSubmit={handleSubmit}>
        <Grid templateColumns={{ base: "1fr", xl: "2fr 3fr" }} gap={{ base: 6, md: 8 }}>
          <GridItem>
            <Card>
              <CardBody>
                <Heading size="md" mb={4}>Informasi Pelanggan</Heading>
                <VStack spacing={4} align="stretch">
                  <FormControl isRequired isInvalid={!!errors.customer_name}>
                    <FormLabel>Nama Pelanggan</FormLabel>
                    <Input 
                      name="customer_name" 
                      value={formData.customer_name} 
                      onChange={handleFormChange}
                      placeholder="Masukkan nama pelanggan"
                    />
                    <FormErrorMessage>{errors.customer_name}</FormErrorMessage>
                  </FormControl>

                  <FormControl isRequired isInvalid={!!errors.email}>
                    <FormLabel>Email</FormLabel>
                    <Input 
                      name="email" 
                      type="email"
                      value={formData.email} 
                      onChange={handleFormChange}
                      placeholder="contoh@email.com"
                    />
                    <FormErrorMessage>{errors.email}</FormErrorMessage>
                  </FormControl>

                  <FormControl isRequired isInvalid={!!errors.phone}>
                    <FormLabel>Nomor Telepon</FormLabel>
                    <Input 
                      name="phone" 
                      value={formData.phone} 
                      onChange={handleFormChange}
                      placeholder="08xxxxxxxxxx"
                    />
                    <FormErrorMessage>{errors.phone}</FormErrorMessage>
                  </FormControl>

                  <FormControl isRequired isInvalid={!!errors.customer_address}>
                    <FormLabel>Alamat</FormLabel>
                    <Textarea 
                      name="customer_address" 
                      value={formData.customer_address} 
                      onChange={handleFormChange}
                      placeholder="Masukkan alamat lengkap"
                      rows={3}
                    />
                    <FormErrorMessage>{errors.customer_address}</FormErrorMessage>
                  </FormControl>
                </VStack>
              </CardBody>
            </Card>
          </GridItem>

          <GridItem>
            <Card>
              <CardBody>
                <Heading size="md" mb={4}>Detail Pesanan</Heading>
                
                {isMobile ? (
                  <VStack spacing={4} align="stretch">
                    {items.map((item, index) => (
                      <Box key={index} p={4} borderWidth="1px" borderRadius="md">
                        <VStack spacing={3} align="stretch">
                          <FormControl isRequired isInvalid={!!errors[`items[${index}].name`]}>
                            <FormLabel fontSize="sm">Produk</FormLabel>
                            <CreatableSelect
                              isClearable
                              placeholder="Cari atau buat produk..."
                              options={products.map(p => ({ value: p.id, label: p.name }))}
                              onChange={(option) => handleProductChange(index, option)}
                              onCreateOption={(inputValue) => handleProductChange(index, { value: inputValue, label: inputValue, __isNew__: true })}
                              value={item.name ? { value: item.productId || item.name, label: item.name } : null}
                              menuPortalTarget={document.body}
                            />
                            <FormErrorMessage>{errors[`items[${index}].name`]}</FormErrorMessage>
                          </FormControl>

                          <HStack spacing={3}>
                            <FormControl isRequired isInvalid={!!errors[`items[${index}].price`]} flex="2">
                              <FormLabel fontSize="sm">Harga</FormLabel>
                              <NumberInput 
                                value={item.price} 
                                onChange={(val) => handleItemChange(index, 'price', val)} 
                                isDisabled={!item.isCustom && !!item.productId}
                              >
                                <NumberInputField placeholder="Harga" />
                              </NumberInput>
                              <FormErrorMessage>{errors[`items[${index}].price`]}</FormErrorMessage>
                            </FormControl>

                            <FormControl flex="1">
                              <FormLabel fontSize="sm">Jumlah</FormLabel>
                              <NumberInput min={1} value={item.quantity} onChange={(val) => handleItemChange(index, 'quantity', parseInt(val) || 1)}>
                                <NumberInputField />
                              </NumberInput>
                            </FormControl>
                          </HStack>

                          <HStack justify="space-between">
                            <Text fontWeight="bold">
                              Subtotal: Rp {(Number(item.price) * Number(item.quantity)).toLocaleString('id-ID')}
                            </Text>
                            <IconButton 
                              aria-label="Hapus item" 
                              icon={<DeleteIcon />} 
                              colorScheme="red" 
                              size="sm" 
                              onClick={() => removeItem(index)} 
                            />
                          </HStack>
                        </VStack>
                      </Box>
                    ))}
                  </VStack>
                ) : (
                  <TableContainer>
                    <Table variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Produk</Th>
                          <Th>Harga</Th>
                          <Th isNumeric>Jumlah</Th>
                          <Th isNumeric>Subtotal</Th>
                          <Th>Aksi</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {items.map((item, index) => (
                          <Tr key={index}>
                            <Td>
                              <FormControl isRequired isInvalid={!!errors[`items[${index}].name`]}>
                                <CreatableSelect
                                  isClearable
                                  placeholder="Cari atau buat produk..."
                                  options={products.map(p => ({ value: p.id, label: p.name }))}
                                  onChange={(option) => handleProductChange(index, option)}
                                  onCreateOption={(inputValue) => handleProductChange(index, { value: inputValue, label: inputValue, __isNew__: true })}
                                  value={item.name ? { value: item.productId || item.name, label: item.name } : null}
                                  menuPortalTarget={document.body}
                                />
                                <FormErrorMessage>{errors[`items[${index}].name`]}</FormErrorMessage>
                              </FormControl>
                            </Td>
                            <Td>
                               <FormControl isRequired isInvalid={!!errors[`items[${index}].price`]}>
                                 <NumberInput 
                                  value={item.price} 
                                  onChange={(val) => handleItemChange(index, 'price', val)} 
                                  isDisabled={!item.isCustom && !!item.productId}
                                 > 
                                   <NumberInputField placeholder="Harga" />
                                 </NumberInput>
                                <FormErrorMessage>{errors[`items[${index}].price`]}</FormErrorMessage>
                               </FormControl>
                            </Td>
                            <Td isNumeric>
                              <NumberInput size="sm" maxW="80px" min={1} value={item.quantity} onChange={(val) => handleItemChange(index, 'quantity', parseInt(val) || 1)}>
                                <NumberInputField />
                              </NumberInput>
                            </Td>
                            <Td isNumeric>Rp {(Number(item.price) * Number(item.quantity)).toLocaleString('id-ID')}</Td>
                            <Td>
                              <IconButton 
                                aria-label="Hapus item" 
                                icon={<DeleteIcon />} 
                                colorScheme="red" 
                                size="sm" 
                                onClick={() => removeItem(index)} 
                              />
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </TableContainer>
                )}

                <Flex direction={{ base: "column", sm: "row" }} w="full" mt={4} alignItems={{ base: "stretch", sm: "center" }} justifyContent={{ base: "center", sm: "flex-end" }} gap={3}>
                  <Button onClick={addItem} colorScheme="teal" size="sm" w={{ base: "full", sm: "auto" }}>
                    + Tambah Item
                  </Button>
                  <Box p={{ base: 3, md: 4 }} bg="gray.50" borderRadius="md" w={{ base: "full", sm: "auto" }} textAlign="center">
                    <Heading size={{ base: "sm", md: "md" }}>Total: Rp {calculateTotal().toLocaleString('id-ID')}</Heading>
                  </Box>
                </Flex>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>
        <Button 
          mt={{ base: 4, md: 6 }} 
          type="submit" 
          colorScheme="teal" 
          size={{ base: "md", md: "lg" }} 
          width="full" 
          isLoading={isLoading} 
          loadingText="Membuat Pesanan..."
        >
          Buat Pesanan & Lanjut ke Pembayaran
        </Button>
      </form>
    </Box>
  );
};

export default NewOrderPage;
