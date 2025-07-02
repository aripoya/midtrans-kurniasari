import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Heading, FormControl, FormLabel, Input, Button,
  VStack, HStack, Text, NumberInput, NumberInputField,
  FormErrorMessage, useToast, Card, CardBody, Grid, GridItem,
  Table, Thead, Tbody, Tr, Th, Td, TableContainer, IconButton,
  useBreakpointValue, Stack, Divider, Flex
} from '@chakra-ui/react';
import CreatableSelect from 'react-select/creatable';
import { DeleteIcon } from '@chakra-ui/icons';
import { orderService } from '../api/orderService';
import { productService } from '../api/productService';
import { loadMidtransScript } from '../utils/midtransHelper';

function NewOrderPage() {
  const isMobile = useBreakpointValue({ base: true, lg: false });
  const navigate = useNavigate();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState([{ productId: '', name: '', price: '', quantity: 1, isCustom: false }]);
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

  const handleProductChange = (index, selectedOption) => {
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
        newItems[index] = { ...newItems[index], productId: selectedProduct.id, name: selectedProduct.name, price: selectedProduct.price, isCustom: false };
      }
    }
    setItems(newItems);

    const newErrors = { ...errors };
    delete newErrors[`items[${index}].name`];
    delete newErrors[`items[${index}].price`];
    setErrors(newErrors);
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
    setItems(prev => [...prev, { productId: '', name: '', price: '', quantity: 1, isCustom: false }]);
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
      if (!item.name) {
        newErrors[`items[${index}].name`] = 'Pilih produk atau masukkan nama item';
      }
      // All items must have a price. For custom items, it must be entered manually.
      if (!item.price || Number(item.price) <= 0) {
        newErrors[`items[${index}].price`] = 'Harga wajib diisi dan lebih besar dari 0';
      }
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
    
    if (!validateForm()) {
      toast({ title: "Formulir tidak valid", description: "Mohon periksa kembali data yang dimasukkan", status: "error", duration: 5000, isClosable: true });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const orderPayload = {
        customer_name: formData.customer_name,
        email: formData.email,
        phone: formData.phone,
        items: items.map(item => ({ id: item.productId, name: item.name, price: Number(item.price), quantity: Number(item.quantity) }))
      };
      
      const response = await orderService.createOrder(orderPayload);
      
      if (!response || !response.orderId) {
        throw new Error('Gagal membuat pesanan: tidak ada ID pesanan yang diterima dari server.');
      }
      
      toast({ title: "Order berhasil dibuat", description: "Sedang memuat halaman pembayaran...", status: "success", duration: 3000, isClosable: true });

      if (response.token) {
        await loadMidtransScript();
        
        if (window.snap) {
          window.snap.pay(response.token, {
            onSuccess: (result) => {
              toast({ title: 'Pembayaran Berhasil', description: 'Status pembayaran telah diperbarui.', status: 'success', duration: 5000, isClosable: true });
              navigate(`/orders/${response.orderId}`);
            },
            onPending: (result) => {
              toast({ title: 'Menunggu Pembayaran', description: 'Selesaikan pembayaran Anda.', status: 'info', duration: 5000, isClosable: true });
              navigate(`/orders/${response.orderId}`);
            },
            onError: (result) => {
              toast({ title: "Pembayaran Gagal", description: "Terjadi kesalahan saat memproses pembayaran.", status: "error", duration: 5000, isClosable: true });
              navigate(`/orders/${response.orderId}`);
            },
            onClose: () => {
              toast({ title: "Pembayaran Dibatalkan", description: "Anda menutup halaman pembayaran.", status: "warning", duration: 5000, isClosable: true });
              navigate(`/orders/${response.orderId}`);
            }
          });
        } else {
          throw new Error('Midtrans Snap script tidak termuat');
        }
      } else if (response.redirect_url) {
        // Fallback to redirect URL if Snap token is not available
        window.location.href = response.redirect_url;
      } else {
        // If no payment options are available, go directly to the order details page
        toast({ title: 'Pesanan Dibuat', description: 'Tidak ada opsi pembayaran yang tersedia, melihat detail pesanan.', status: 'info', duration: 3000, isClosable: true });
        navigate(`/orders/${response.orderId}`);
      }
      
    } catch (error) {
      console.error('❌ Error creating order:', error);
      toast({
        title: "Gagal membuat pesanan",
        description: error.message || "Terjadi kesalahan saat membuat pesanan.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box p={{ base: 4, md: 6, lg: 8 }}>
      <form onSubmit={handleSubmit}>
        <Heading size={{ base: "lg", md: "xl" }} mb={{ base: 4, md: 6 }}>Buat Pesanan Baru</Heading>
        <Grid templateColumns={{ base: "1fr", lg: "2fr 3fr" }} gap={{ base: 4, md: 6 }}>
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
                
                {/* Mobile View */}
                {isMobile ? (
                  <VStack spacing={4} align="stretch" w="full">
                    {items.map((item, index) => (
                      <Card key={index} size="sm" variant="outline">
                        <CardBody>
                          <VStack spacing={3} align="stretch">
                            <FormControl isRequired isInvalid={errors[`items[${index}].name`]}>
                              <FormLabel fontSize="sm">Produk</FormLabel>
                              <CreatableSelect
                                isClearable
                                placeholder="Cari atau buat produk..."
                                options={products.map(p => ({ value: p.id, label: p.name }))}
                                onChange={(option) => handleProductChange(index, option)}
                                onCreateOption={(inputValue) => handleProductChange(index, { value: inputValue, label: inputValue, __isNew__: true })}
                                value={item.name ? { value: item.productId || item.name, label: item.name } : null}
                                menuPortalTarget={document.body}
                                styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                              />
                              <FormErrorMessage>{errors[`items[${index}].name`]}</FormErrorMessage>
                            </FormControl>

                            <FormControl isRequired isInvalid={errors[`items[${index}].price`]}>
                               <FormLabel fontSize="sm">Harga</FormLabel>
                               <NumberInput 
                                value={item.price}
                                onChange={(val) => handleItemChange(index, 'price', val)}
                                isDisabled={!item.isCustom && item.productId}
                               > 
                                 <NumberInputField placeholder="Harga produk" />
                               </NumberInput>
                               <FormErrorMessage>{errors[`items[${index}].price`]}</FormErrorMessage>
                            </FormControl>

                            <HStack justify="space-between" align="center">
                              <FormLabel fontSize="sm" mb={0}>Jumlah:</FormLabel>
                              <NumberInput size="sm" maxW="100px" min={1} value={item.quantity} onChange={(val) => handleItemChange(index, 'quantity', val)}>
                                <NumberInputField />
                              </NumberInput>
                            </HStack>

                            <Divider />

                            <HStack justify="space-between">
                              <Text fontWeight="bold">Subtotal:</Text>
                              <Text fontWeight="bold">Rp {(Number(item.price) * Number(item.quantity)).toLocaleString('id-ID')}</Text>
                            </HStack>

                            <Button leftIcon={<DeleteIcon />} colorScheme="red" size="sm" onClick={() => removeItem(index)} mt={1}>
                              Hapus
                            </Button>
                          </VStack>
                        </CardBody>
                      </Card>
                    ))}
                  </VStack>
                ) : (
                  /* Desktop View */
                  <TableContainer>
                    <Table variant="simple">
                      <Thead>
                        <Tr>
                          <Th minW="300px">Produk</Th>
                          <Th minW="150px">Harga</Th>
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
                               <FormControl isRequired isInvalid={errors[`items[${index}].price`]}>
                                 <NumberInput 
                                  value={item.price} 
                                  onChange={(val) => handleItemChange(index, 'price', val)} 
                                  isDisabled={!item.isCustom && item.productId}
                                 > 
                                   <NumberInputField placeholder="Harga" />
                                 </NumberInput>
                                <FormErrorMessage>{errors[`items[${index}].price`]}</FormErrorMessage>
                               </FormControl>
                            </Td>
                            <Td isNumeric>
                              <NumberInput size="sm" maxW="80px" min={1} value={item.quantity} onChange={(val) => handleItemChange(index, 'quantity', val)}>
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
}

export default NewOrderPage;
