import React, { useEffect, useState, useRef, ChangeEvent } from 'react';
import { 
  Box, Heading, Button, Flex, Spinner, useToast, Table, Thead, Tbody, Tr, Th, Td, 
  Input, InputGroup, InputLeftElement, useDisclosure, Modal, ModalOverlay, ModalContent, 
  ModalHeader, ModalCloseButton, ModalBody, FormControl, FormLabel, ModalFooter, NumberInput, 
  NumberInputField, NumberInputStepper, NumberIncrementStepper, NumberDecrementStepper, AlertDialog, 
  AlertDialogBody, AlertDialogFooter, AlertDialogHeader, AlertDialogContent, AlertDialogOverlay,
  useBreakpointValue, Text, Grid, GridItem, Stack, Card, CardBody, IconButton, Container
} from '@chakra-ui/react';
import { SearchIcon, AddIcon } from '@chakra-ui/icons';
import { productService } from '../api/productService';

// TypeScript interfaces
interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
}

interface FormData {
  name: string;
  price: number | string;
}

const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const { isOpen: isModalOpen, onOpen: onModalOpen, onClose: onModalClose } = useDisclosure();
  const { isOpen: isAlertOpen, onOpen: onAlertOpen, onClose: onAlertClose } = useDisclosure();
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [formData, setFormData] = useState<FormData>({ name: '', price: '' });
  const cancelRef = useRef<HTMLButtonElement>(null);
  const initialRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const fetchProducts = async (): Promise<void> => {
    try {
      setLoading(true);
      const data = await productService.getProducts(searchTerm);
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({ 
        title: 'Error', 
        description: 'Gagal memuat daftar produk.', 
        status: 'error', 
        duration: 5000, 
        isClosable: true 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => { 
      fetchProducts(); 
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleOpenModal = (product: Product | null = null): void => {
    setProductToEdit(product);
    setFormData(product ? { name: product.name, price: product.price } : { name: '', price: '' });
    onModalOpen();
  };

  const handleSaveProduct = async (): Promise<void> => {
    try {
      if (productToEdit) {
        await productService.updateProduct(productToEdit.id, formData);
        toast({ title: 'Produk berhasil diperbarui', status: 'success' });
      } else {
        await productService.createProduct(formData);
        toast({ title: 'Produk berhasil dibuat', status: 'success' });
      }
      onModalClose();
      fetchProducts();
    } catch (error: any) {
      toast({ 
        title: 'Gagal menyimpan produk', 
        description: error.response?.data?.error, 
        status: 'error' 
      });
    }
  };

  const handleDeleteClick = (product: Product): void => {
    setProductToDelete(product);
    onAlertOpen();
  };

  const confirmDelete = async (): Promise<void> => {
    if (!productToDelete) return;
    
    try {
      await productService.deleteProduct(productToDelete.id);
      toast({ title: 'Produk berhasil dihapus', status: 'success' });
      onAlertClose();
      fetchProducts();
    } catch (error) {
      toast({ title: 'Gagal menghapus produk', status: 'error' });
    }
  };

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(e.target.value);
  };

  const handleFormNameChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setFormData({ ...formData, name: e.target.value });
  };

  const handleFormPriceChange = (valueAsString: string): void => {
    setFormData({ ...formData, price: parseInt(valueAsString) || 0 });
  };

  // Responsif heading size dan button size untuk iPhone 6.5-6.7 inci
  const headingSize = useBreakpointValue({ base: "md", md: "lg" });
  const buttonSize = useBreakpointValue({ base: "sm", md: "md" });
  const isDesktop = useBreakpointValue({ base: false, md: true });

  return (
    <Container maxW="container.xl" p={{ base: 2, md: 4 }}>
      <Flex 
        justifyContent="space-between" 
        alignItems="center" 
        mb={6}
        flexDirection={{ base: "column", sm: "row" }}
        gap={{ base: 3, sm: 0 }}
      >
        <Heading size={headingSize}>Manajemen Produk</Heading>
        <Button 
          onClick={() => handleOpenModal()} 
          colorScheme="teal" 
          leftIcon={<AddIcon />}
          size={buttonSize}
          w={{ base: "100%", sm: "auto" }}
        >
          Tambah Produk
        </Button>
      </Flex>

      <InputGroup mb={6}>
        <InputLeftElement pointerEvents="none">
          <SearchIcon color="gray.300" />
        </InputLeftElement>
        <Input 
          placeholder="Cari produk..." 
          value={searchTerm} 
          onChange={handleSearchChange}
        />
      </InputGroup>

      {loading ? (
        <Flex justifyContent="center" py={10}>
          <Spinner size="xl" />
        </Flex>
      ) : products.length === 0 ? (
        <Box textAlign="center" py={10}>
          <Text>
            {searchTerm ? `Tidak ada produk yang cocok dengan "${searchTerm}"` : 'Belum ada produk'}
          </Text>
          <Button onClick={() => handleOpenModal()} colorScheme="teal" mt={4}>
            Tambah Produk Pertama
          </Button>
        </Box>
      ) : (
        <>
          {/* Tampilan desktop: tabel */}
          <Box display={{ base: 'none', md: 'block' }} overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>ID</Th>
                  <Th>Nama Produk</Th>
                  <Th isNumeric>Harga</Th>
                  <Th>Aksi</Th>
                </Tr>
              </Thead>
              <Tbody>
                {products.map((product) => (
                  <Tr key={product.id}>
                    <Td>{product.id}</Td>
                    <Td>{product.name}</Td>
                    <Td isNumeric>Rp {product.price?.toLocaleString('id-ID')}</Td>
                    <Td>
                      <Button size="sm" colorScheme="blue" mr={2} onClick={() => handleOpenModal(product)}>
                        Edit
                      </Button>
                      <Button size="sm" colorScheme="red" onClick={() => handleDeleteClick(product)}>
                        Hapus
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
          
          {/* Tampilan mobile: kartu - dioptimalkan untuk iPhone 6.5-6.7 inci */}
          <Box display={{ base: 'block', md: 'none' }}>
            <Stack spacing={4}>
              {products.map((product) => (
                <Card key={product.id} borderWidth="1px" borderRadius="md" overflow="hidden" boxShadow="sm">
                  <CardBody p={4}>
                    <Grid templateColumns="1fr 1fr" gap={3}>
                      <Box>
                        <Text fontSize="sm" color="gray.500">ID</Text>
                        <Text fontSize="sm">{product.id}</Text>
                      </Box>
                      <Box>
                        <Text fontSize="sm" color="gray.500">Harga</Text>
                        <Text fontWeight="bold">Rp {product.price?.toLocaleString('id-ID')}</Text>
                      </Box>
                      <GridItem colSpan={2}>
                        <Text fontSize="sm" color="gray.500">Nama Produk</Text>
                        <Text fontWeight="semibold" fontSize="lg">{product.name}</Text>
                      </GridItem>
                      <GridItem colSpan={2}>
                        <Flex mt={2} gap={2}>
                          <Button size="sm" colorScheme="blue" flex={1} onClick={() => handleOpenModal(product)}>
                            Edit
                          </Button>
                          <Button size="sm" colorScheme="red" flex={1} onClick={() => handleDeleteClick(product)}>
                            Hapus
                          </Button>
                        </Flex>
                      </GridItem>
                    </Grid>
                  </CardBody>
                </Card>
              ))}
            </Stack>
          </Box>
        </>
      )}

      <Modal isOpen={isModalOpen} onClose={onModalClose} initialFocusRef={initialRef} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{productToEdit ? 'Edit Produk' : 'Tambah Produk Baru'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl isRequired>
              <FormLabel>Nama Produk</FormLabel>
              <Input 
                ref={initialRef} 
                placeholder="Kopi Susu" 
                value={formData.name} 
                onChange={handleFormNameChange} 
              />
            </FormControl>
            <FormControl mt={4} isRequired>
              <FormLabel>Harga</FormLabel>
              <NumberInput 
                min={0} 
                value={formData.price} 
                onChange={handleFormPriceChange}
              >
                <NumberInputField placeholder="25000"/>
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="teal" mr={3} onClick={handleSaveProduct}>
              Simpan
            </Button>
            <Button onClick={onModalClose}>Batal</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog isOpen={isAlertOpen} leastDestructiveRef={cancelRef} onClose={onAlertClose} isCentered>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Hapus Produk
            </AlertDialogHeader>
            <AlertDialogBody>
              Anda yakin ingin menghapus produk "{productToDelete?.name}"? Aksi ini tidak bisa dibatalkan.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onAlertClose}>
                Batal
              </Button>
              <Button colorScheme="red" onClick={confirmDelete} ml={3}>
                Hapus
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Container>
  );
};

export default ProductsPage;
