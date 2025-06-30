import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Heading, FormControl, FormLabel, Input, Button,
  VStack, HStack, Text, NumberInput, NumberInputField,
  FormErrorMessage, useToast, Card, CardBody, Grid, GridItem,
  Table, Thead, Tbody, Tr, Th, Td, TableContainer, IconButton,
  useBreakpointValue, Stack, Divider, Flex
} from '@chakra-ui/react';
import Select from 'react-select';
import { DeleteIcon } from '@chakra-ui/icons';
import { orderService } from '../api/orderService';
import { productService } from '../api/productService';

function NewOrderPage() {
  const isMobile = useBreakpointValue({ base: true, md: false });
  const navigate = useNavigate();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState([{ productId: '', name: '', price: '', quantity: 1 }]);
  const [products, setProducts] = useState([]);
  
  const [formData, setFormData] = useState({
    customer_name: '',
    email: '',
    phone: ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await productService.getProducts();
        setProducts(data.products || []);
      } catch (error) {
        toast({ title: "Gagal memuat produk", description: "Tidak dapat mengambil daftar produk dari server.", status: "error", duration: 5000, isClosable: true });
      }
    };
    fetchProducts();
  }, [toast]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) setErrors({ ...errors, [name]: '' });
  };

  const handleProductSelect = (index, selectedOption) => {
    const selectedProduct = products.find(p => p.id === selectedOption.value);
    if (selectedProduct) {
      const newItems = [...items];
      newItems[index] = { ...newItems[index], productId: selectedProduct.id, name: selectedProduct.name, price: selectedProduct.price };
      setItems(newItems);
      const newErrors = { ...errors };
      delete newErrors[`items[${index}].name`];
      delete newErrors[`items[${index}].price`];
      setErrors(newErrors);
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
    if (errors[`items[${index}].${field}`]) {
      const newErrors = { ...errors };
      delete newErrors[`items[${index}].${field}`];
      setErrors(newErrors);
    }
  };

  const addItem = () => {
    setItems(prev => [...prev, { name: '', price: '', quantity: 1 }]);
  };

  const removeItem = (index) => {
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

  const validateForm = () => {
    const newErrors = {};
    if (!formData.customer_name) newErrors.customer_name = 'Nama pelanggan wajib diisi';
    if (!formData.email) newErrors.email = 'Email wajib diisi';
    else if (!formData.email.match(/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/)) newErrors.email = 'Format email tidak valid';
    if (!formData.phone) newErrors.phone = 'Nomor telepon wajib diisi';
    items.forEach((item, index) => {
      if (!item.name) newErrors[`items[${index}].name`] = 'Pilih produk terlebih dahulu';
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateTotal = () => {
    return items.reduce((total, item) => {
      return total + (Number(item.price) || 0) * (Number(item.quantity) || 0);
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('🔍 Form submit triggered');
    
    if (!validateForm()) {
      console.log('❌ Form validation failed', errors);
      toast({
        title: "Formulir tidak valid",
        description: "Mohon periksa kembali data yang dimasukkan",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      return;
    }
    
    console.log('✅ Form validation passed');
    setIsLoading(true);
    
    try {
      // Prepare order data
      const orderData = {
        customer_name: formData.customer_name,
        email: formData.email,
        phone: formData.phone,
        items: items.map(item => ({
          name: item.name,
          price: Number(item.price),
          quantity: Number(item.quantity)
        }))
      };
      
      console.log('📦 Sending order data:', orderData);
      console.log('🔄 Using configured API client via orderService');
      
      // Use orderService instead of direct fetch to localhost
      const response = await orderService.createOrder(orderData);
      console.log('✅ API response:', response);
      console.log('✅ API response:', response);
      
      toast({
        title: "Order berhasil dibuat",
        description: "Anda akan diarahkan ke halaman pembayaran",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      
      // Redirect to payment page or order details
      if (response && response.payment_link) {
        // Midtrans redirect
        console.log('🔄 Redirecting to payment page:', response.payment_link);
        window.location.href = response.payment_link;
      } else {
        // Fallback to order details
        console.log('🔄 Redirecting to order details:', response.order_id);
        navigate(`/orders/${response.order_id}`);
      }
      
    } catch (error) {
      console.error('❌ Error creating order:', error);
      toast({
        title: "Gagal membuat pesanan",
        description: error.message || "Terjadi kesalahan saat membuat pesanan",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box p={{ base: 2, md: 5 }}>
      <form onSubmit={handleSubmit}>
        <Heading size={{ base: "md", md: "lg" }} mb={{ base: 4, md: 6 }}>Buat Pesanan Baru</Heading>
        <Grid templateColumns={{ base: "1fr", md: "1fr 2fr" }} gap={{ base: 4, md: 6 }}>
          <GridItem>
            <Card>
              <CardBody>
                <Heading size={{ base: "sm", md: "md" }} mb={{ base: 3, md: 4 }}>Informasi Pelanggan</Heading>
                <VStack spacing={4}>
                  <FormControl isRequired isInvalid={errors.customer_name}>
                    <FormLabel>Nama Pelanggan</FormLabel>
                    <Input name="customer_name" value={formData.customer_name} onChange={handleFormChange} />
                    <FormErrorMessage>{errors.customer_name}</FormErrorMessage>
                  </FormControl>
                  <FormControl isRequired isInvalid={errors.email}>
                    <FormLabel>Email</FormLabel>
                    <Input name="email" type="email" value={formData.email} onChange={handleFormChange} />
                    <FormErrorMessage>{errors.email}</FormErrorMessage>
                  </FormControl>
                  <FormControl isRequired isInvalid={errors.phone}>
                    <FormLabel>Nomor Telepon</FormLabel>
                    <Input name="phone" value={formData.phone} onChange={handleFormChange} />
                    <FormErrorMessage>{errors.phone}</FormErrorMessage>
                  </FormControl>
                </VStack>
              </CardBody>
            </Card>
          </GridItem>

          <GridItem>
            <Card>
              <CardBody>
                <Heading as="h2" size={{ base: "sm", md: "md" }} mb={{ base: 3, md: 4 }}>Items Pesanan</Heading>
                {isMobile ? (
                  <VStack spacing={4} align="stretch" w="full">
                    {items.map((item, index) => (
                      <Card key={index} size="sm" variant="outline">
                        <CardBody>
                          <VStack spacing={3} align="stretch">
                            <FormControl isRequired isInvalid={errors[`items[${index}].name`]}>
                              <FormLabel fontSize="sm">Produk</FormLabel>
                              <Select
                                placeholder="Cari & pilih produk..."
                                options={products.map(p => ({ value: p.id, label: p.name }))}
                                onChange={(selectedOption) => handleProductSelect(index, selectedOption)}
                                value={item.productId ? { value: item.productId, label: item.name } : null}
                                menuPortalTarget={document.body}
                                styles={{
                                  menuPortal: base => ({ ...base, zIndex: 9999 }),
                                  control: (base) => ({ ...base, minHeight: '38px' })
                                }}
                              />
                              <FormErrorMessage>{errors[`items[${index}].name`]}</FormErrorMessage>
                            </FormControl>
                            
                            <HStack justify="space-between">
                              <FormLabel fontSize="sm" mb={0}>Harga:</FormLabel>
                              <Text fontWeight="medium">Rp {Number(item.price).toLocaleString('id-ID')}</Text>
                            </HStack>
                            
                            <HStack justify="space-between" align="center">
                              <FormLabel fontSize="sm" mb={0}>Jumlah:</FormLabel>
                              <NumberInput 
                                size="sm" 
                                maxW="100px" 
                                min={1} 
                                defaultValue={1} 
                                value={item.quantity} 
                                onChange={(valueString) => handleItemChange(index, 'quantity', valueString)}
                              >
                                <NumberInputField />
                              </NumberInput>
                            </HStack>
                            
                            <Divider />
                            
                            <HStack justify="space-between">
                              <Text fontWeight="bold">Subtotal:</Text>
                              <Text fontWeight="bold">Rp {(Number(item.price) * Number(item.quantity)).toLocaleString('id-ID')}</Text>
                            </HStack>
                            
                            <Button 
                              leftIcon={<DeleteIcon />} 
                              colorScheme="red" 
                              size="sm" 
                              onClick={() => removeItem(index)}
                              mt={1}
                            >
                              Hapus
                            </Button>
                          </VStack>
                        </CardBody>
                      </Card>
                    ))}
                  </VStack>
                ) : (
                  <TableContainer>
                    <Table variant="simple">
                      <Thead>
                        <Tr>
                          <Th>Produk</Th>
                          <Th isNumeric>Harga</Th>
                          <Th isNumeric>Jumlah</Th>
                          <Th isNumeric>Subtotal</Th>
                          <Th>Aksi</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {items.map((item, index) => (
                          <Tr key={index}>
                            <Td>
                              <FormControl isRequired isInvalid={errors[`items[${index}].name`]}>
                                <Select
                                  placeholder="Cari & pilih produk..."
                                  options={products.map(p => ({ value: p.id, label: p.name }))}
                                  onChange={(selectedOption) => handleProductSelect(index, selectedOption)}
                                  value={item.productId ? { value: item.productId, label: item.name } : null}
                                  menuPortalTarget={document.body}
                                  styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                                />
                                <FormErrorMessage>{errors[`items[${index}].name`]}</FormErrorMessage>
                              </FormControl>
                            </Td>
                            <Td isNumeric>Rp {Number(item.price).toLocaleString('id-ID')}</Td>
                            <Td isNumeric>
                              <NumberInput size="sm" maxW={20} min={1} defaultValue={1} value={item.quantity} onChange={(valueString) => handleItemChange(index, 'quantity', valueString)}>
                                <NumberInputField />
                              </NumberInput>
                            </Td>
                            <Td isNumeric>Rp {(Number(item.price) * Number(item.quantity)).toLocaleString('id-ID')}</Td>
                            <Td>
                              <IconButton aria-label="Hapus item" icon={<DeleteIcon />} colorScheme="red" size="sm" onClick={() => removeItem(index)} />
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </TableContainer>
                )}
                <Flex 
                  direction={{ base: "column", sm: "row" }} 
                  w="full" 
                  mt={4} 
                  alignItems={{ base: "stretch", sm: "center" }}
                  justifyContent={{ base: "center", sm: "flex-end" }}
                  gap={3}
                >
                  <Button 
                    onClick={addItem} 
                    colorScheme="teal" 
                    size="sm" 
                    w={{ base: "full", sm: "auto" }}
                  >
                    + Tambah Item
                  </Button>
                  <Box 
                    p={{ base: 3, md: 4 }} 
                    bg="gray.50" 
                    borderRadius="md"
                    w={{ base: "full", sm: "auto" }}
                    textAlign="center"
                  >
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
}

export default NewOrderPage;
