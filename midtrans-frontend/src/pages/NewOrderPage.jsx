import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Heading, FormControl, FormLabel, Input, Button,
  VStack, HStack, Text, NumberInput, NumberInputField,
  FormErrorMessage, useToast, Container
} from '@chakra-ui/react';
import { orderService } from '../api/orderService';

function NewOrderPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState([{ name: '', price: '', quantity: 1 }]);
  
  const [formData, setFormData] = useState({
    customer_name: '',
    email: '',
    phone: ''
  });

  const [errors, setErrors] = useState({});

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
    
    // Clear error
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
    
    // Validate customer details
    if (!formData.customer_name) {
      newErrors.customer_name = 'Nama pelanggan wajib diisi';
    }
    
    if (!formData.email) {
      newErrors.email = 'Email wajib diisi';
    } else if (!formData.email.match(/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/)) {
      newErrors.email = 'Format email tidak valid';
    }
    
    if (!formData.phone) {
      newErrors.phone = 'Nomor telepon wajib diisi';
    }
    
    // Validate items
    items.forEach((item, index) => {
      if (!item.name) {
        newErrors[`items[${index}].name`] = 'Nama item wajib diisi';
      }
      
      if (!item.price) {
        newErrors[`items[${index}].price`] = 'Harga wajib diisi';
      } else if (isNaN(item.price) || Number(item.price) <= 0) {
        newErrors[`items[${index}].price`] = 'Harga harus berupa angka positif';
      }
      
      if (!item.quantity || Number(item.quantity) < 1) {
        newErrors[`items[${index}].quantity`] = 'Jumlah minimal 1';
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
    <Container maxW="container.lg" py={5}>
      <Box bg="white" p={6} rounded="md" shadow="md">
        <form onSubmit={handleSubmit}>
          <VStack spacing={6} align="stretch">
            <Heading size="lg">Buat Pesanan Baru</Heading>
            
            <Box p={5} borderWidth="1px" borderRadius="md">
              <Heading size="md" mb={4}>Informasi Pelanggan</Heading>
              
              <VStack spacing={4}>
                <FormControl isRequired isInvalid={errors.customer_name}>
                  <FormLabel>Nama Pelanggan</FormLabel>
                  <Input 
                    name="customer_name"
                    value={formData.customer_name}
                    onChange={handleFormChange}
                  />
                  <FormErrorMessage>{errors.customer_name}</FormErrorMessage>
                </FormControl>
                
                <FormControl isRequired isInvalid={errors.email}>
                  <FormLabel>Email</FormLabel>
                  <Input 
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleFormChange}
                  />
                  <FormErrorMessage>{errors.email}</FormErrorMessage>
                </FormControl>
                
                <FormControl isRequired isInvalid={errors.phone}>
                  <FormLabel>Nomor Telepon</FormLabel>
                  <Input 
                    name="phone"
                    value={formData.phone}
                    onChange={handleFormChange}
                  />
                  <FormErrorMessage>{errors.phone}</FormErrorMessage>
                </FormControl>
              </VStack>
            </Box>
            
            <Box p={5} borderWidth="1px" borderRadius="md">
              <Heading size="md" mb={4}>Items Pesanan</Heading>
              
              {items.map((item, index) => (
                <HStack key={index} spacing={4} mb={4} align="start">
                  <FormControl isRequired isInvalid={errors[`items[${index}].name`]}>
                    <FormLabel>Nama Item</FormLabel>
                    <Input 
                      value={item.name}
                      onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                    />
                    <FormErrorMessage>{errors[`items[${index}].name`]}</FormErrorMessage>
                  </FormControl>
                  
                  <FormControl isRequired isInvalid={errors[`items[${index}].price`]}>
                    <FormLabel>Harga (Rp)</FormLabel>
                    <NumberInput min={1}>
                      <NumberInputField 
                        value={item.price}
                        onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                      />
                    </NumberInput>
                    <FormErrorMessage>{errors[`items[${index}].price`]}</FormErrorMessage>
                  </FormControl>
                  
                  <FormControl isRequired isInvalid={errors[`items[${index}].quantity`]}>
                    <FormLabel>Jumlah</FormLabel>
                    <NumberInput min={1} defaultValue={1}>
                      <NumberInputField 
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      />
                    </NumberInput>
                    <FormErrorMessage>{errors[`items[${index}].quantity`]}</FormErrorMessage>
                  </FormControl>
                  
                  <Button 
                    colorScheme="red" 
                    onClick={() => removeItem(index)}
                    mt={8}
                  >
                    Hapus
                  </Button>
                </HStack>
              ))}
              
              <Button onClick={addItem} colorScheme="blue">
                + Tambah Item
              </Button>
              
              <Box mt={6} p={4} bg="gray.50" borderRadius="md">
                <Heading size="sm" mb={2}>Ringkasan Pesanan</Heading>
                <Text>Total: Rp {calculateTotal().toLocaleString('id-ID')}</Text>
              </Box>
            </Box>
            
            <Button 
              type="submit" 
              colorScheme="teal" 
              size="lg"
              isLoading={isLoading}
              loadingText="Membuat Pesanan..."
            >
              Buat Pesanan &amp; Lanjut ke Pembayaran
            </Button>
          </VStack>
        </form>
      </Box>
    </Container>
  );
}

export default NewOrderPage;
