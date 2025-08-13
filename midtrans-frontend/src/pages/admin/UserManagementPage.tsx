import React, { useState, useEffect, ChangeEvent, useCallback } from 'react';
import {
  Box,
  Button,
  Container,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
  VStack,
  IconButton
} from '@chakra-ui/react';
import { FaEdit, FaTrash, FaKey } from 'react-icons/fa';
import { adminApi } from '../../api/adminApi';

interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'outlet_manager' | 'deliveryman';
  outlet_id?: string;
  email?: string;
}

interface Outlet {
  id: string;
  name: string;
}

interface FormValues {
  username: string;
  name: string;
  password: string;
  role: 'admin' | 'outlet_manager' | 'deliveryman';
  outlet_id: string;
  email: string;
}

const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formValues, setFormValues] = useState<FormValues>({
    username: '',
    name: '',
    password: '',
    role: 'outlet_manager',
    outlet_id: '',
    email: ''
  });
  const [locations, setLocations] = useState<any[]>([]);

 const toast = useToast();
  const { isOpen: isCreateOpen, onOpen: onCreateOpen, onClose: onCreateClose } = useDisclosure();
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const { isOpen: isResetOpen, onOpen: onResetOpen, onClose: onResetClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  
  const [outlets, setOutlets] = useState<Outlet[]>([]);

    const loadAllData = useCallback(async (): Promise<void> => {
      setLoading(true);
        try {
          // Load locations
          const locationsRes = await adminApi.getLocations();
          console.log('🔍 Locations API response:', locationsRes);
          if (locationsRes.success && locationsRes.data) {
            const locationsList = Array.isArray(locationsRes.data) ? locationsRes.data : [];
            console.log('🔍 Processed locations:', locationsList);
            setLocations(locationsList);
          } else {
            console.warn('🔍 Locations API failed or returned no data:', locationsRes);
            setLocations([]);
          }

          // Load outlets dynamically from backend
          console.log('🚀 Starting to fetch outlets...');
          const outletsRes = await adminApi.getOutlets();
          console.log('🏪 Outlets API response:', outletsRes);
          console.log('🏪 Outlets response type:', typeof outletsRes);
          console.log('🏪 Outlets response keys:', Object.keys(outletsRes || {}));
          
          if (outletsRes.success && (outletsRes.outlets || outletsRes.data)) {
            const outletsList = outletsRes.outlets || outletsRes.data || [];
            console.log('🏪 Processed outlets:', outletsList);
            console.log('🏪 Outlets count:', outletsList.length);
            console.log('🏪 First outlet:', outletsList[0]);
            setOutlets(outletsList);
          } else {
            console.warn('🏪 Outlets API failed or returned no data:', outletsRes);
            console.error('🏪 API Error details:', outletsRes.error);
            setOutlets([]);
          }
        } catch (error) {
          console.error('Error loading data:', error);
          setLocations([]); 
          setOutlets([]);
        }
    }, [toast]);

  useEffect(() => {
    fetchUsers();
    loadAllData();
  }, []);

  // Fetch users from API
  const fetchUsers = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await adminApi.getUsers();
      
      if (response.success) {
        setUsers(response.data || []);
      } else {
        // Handle authentication errors - show error but don't force logout
        if (response.error?.includes('Unauthorized') || response.error?.includes('401')) {
          toast({
            title: 'Authentication Error',
            description: 'Unable to load users. Please check your session and try refreshing the page.',
            status: 'warning',
            duration: 5000,
            isClosable: true,
          });
          // Let AuthContext handle session validation instead of forcing redirect
        } else {
          toast({
            title: 'Error',
            description: response.error || 'Failed to fetch users',
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        }
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'An error occurred';
      
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        toast({
          title: 'Authentication Required',
          description: 'Please log in to access user management',
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Error',
          description: errorMessage,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle input change
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setFormValues(prevValues => ({
      ...prevValues,
      [name]: value
    }));
  };

  // Open create user modal
  const handleOpenCreateModal = (): void => {
    setFormValues({
      username: '',
      name: '',
      password: '',
      role: 'outlet_manager',
      outlet_id: '',
      email: ''
    });
    onCreateOpen();
  };

  // Open edit user modal
  const handleOpenEditModal = (user: User): void => {
    setSelectedUser(user);
    setFormValues({
      username: user.username || '',
      name: user.name || '',
      password: '', // Don't prefill password for security
      role: user.role || 'outlet_manager',
      outlet_id: user.outlet_id || '',
      email: user.email || ''
    });
    onEditOpen();
  };

  // Open reset password modal
  const handleOpenResetModal = (user: User): void => {
    setSelectedUser(user);
    setFormValues(prev => ({
      ...prev,
      password: '',
    }));
    onResetOpen();
  };

  // Open delete user modal
  const handleOpenDeleteModal = (user: User): void => {
    setSelectedUser(user);
    onDeleteOpen();
  };

  // Create new user
  const handleCreateUser = async (): Promise<void> => {
    try {
      if (!formValues.username || !formValues.password || !formValues.name || !formValues.role) {
        toast({
          title: 'Validation Error',
          description: 'Please fill in all required fields',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        return;
      }

      // For outlet managers, outlet_id is required
      if (formValues.role === 'outlet_manager' && !formValues.outlet_id) {
        toast({
          title: 'Validation Error',
          description: 'Please select an outlet for the outlet manager',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        return;
      }

      const response = await adminApi.createUser(formValues);
      
      if (response.success) {
        toast({
          title: 'Success',
          description: 'User created successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        onCreateClose();
        await fetchUsers();
      } else {
        toast({
          title: 'Error',
          description: response.error || 'Failed to create user',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'An error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Update existing user
  const handleUpdateUser = async (): Promise<void> => {
    try {
      if (!selectedUser || !formValues.username || !formValues.name || !formValues.role) {
        toast({
          title: 'Validation Error',
          description: 'Please fill in all required fields',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        return;
      }

      // For outlet managers, outlet_id is required
      if (formValues.role === 'outlet_manager' && !formValues.outlet_id) {
        toast({
          title: 'Validation Error',
          description: 'Please select an outlet for the outlet manager',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        return;
      }

      // Prepare update data (exclude password if it's empty)
      const updateData: Partial<FormValues> = { ...formValues };
      if (!updateData.password) {
        delete updateData.password;
      }

      const response = await adminApi.updateUser(selectedUser.id, updateData);
      
      if (response.success) {
        toast({
          title: 'Success',
          description: 'User updated successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        onEditClose();
        await fetchUsers();
      } else {
        toast({
          title: 'Error',
          description: response.error || 'Failed to update user',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'An error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Reset user password
  const handleResetPassword = async (): Promise<void> => {
    try {
      if (!selectedUser || !formValues.password) {
        toast({
          title: 'Validation Error',
          description: 'Please enter a new password',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        return;
      }

      const response = await adminApi.resetPassword(selectedUser.id, formValues.password);
      
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Password reset successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        onResetClose();
      } else {
        toast({
          title: 'Error',
          description: response.error || 'Failed to reset password',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'An error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Delete user
  const handleDeleteUser = async (): Promise<void> => {
    try {
      if (!selectedUser) return;

      const response = await adminApi.deleteUser(selectedUser.id);
      
      if (response.success) {
        toast({
          title: 'Success',
          description: 'User deleted successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        onDeleteClose();
        await fetchUsers();
      } else {
        toast({
          title: 'Error',
          description: response.error || 'Failed to delete user',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'An error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const getRoleDisplayName = (role: string): string => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'outlet_manager':
        return 'Outlet Manager';
      case 'deliveryman':
        return 'Delivery Man';
      default:
        return role;
    }
  };

  const getOutletDisplayName = (outletId: string): string => {
    const outlet = outlets.find(o => o.id === outletId);
    return outlet ? outlet.name : outletId || '-';
  };

  return (
    <Container maxW="container.xl" py={8}>
      <Flex justify="space-between" align={{ base: 'start', md: 'center' }} mb={8} direction={{ base: 'column', md: 'row' }} gap={4}>
        <Box>
          <Heading size="lg">User Management</Heading>
          <Text fontSize="sm" color="gray.500">Manage admin, outlet manager, and deliveryman</Text>
        </Box>
        <Button colorScheme="blue" onClick={handleOpenCreateModal}>+ Add User</Button>
      </Flex>

      {loading ? (
        <Box textAlign="center" py={10}><Text>Loading users...</Text></Box>
      ) : users.length === 0 ? (
        <Box textAlign="center" py={12}><Text fontSize="lg" color="gray.500">No users found.</Text></Box>
      ) : (
        <Box overflowX="auto" borderWidth="1px" borderRadius="lg" shadow="sm">
          <Table variant="simple" size="md">
            <Thead bg="gray.100">
              <Tr>
                <Th>Username</Th>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Outlet</Th>
                <Th>Email</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {users.map((user, index) => (
                <Tr key={user.id} bg={index % 2 === 0 ? 'gray.50' : 'white'}>
                  <Td>{user.username}</Td>
                  <Td>{user.name}</Td>
                  <Td>{getRoleDisplayName(user.role)}</Td>
                  <Td>{getOutletDisplayName(user.outlet_id || '')}</Td>
                  <Td>{user.email || '-'}</Td>
                  <Td>
                    <HStack spacing={1}>
                      <IconButton aria-label="Edit" icon={<FaEdit />} size="sm" colorScheme="blue" variant="ghost" onClick={() => handleOpenEditModal(user)} />
                      <IconButton aria-label="Reset" icon={<FaKey />} size="sm" colorScheme="yellow" variant="ghost" onClick={() => handleOpenResetModal(user)}/>
                      <IconButton aria-label="Delete" icon={<FaTrash />} size="sm" colorScheme="red" variant="ghost" onClick={() => handleOpenDeleteModal(user)} />
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

     {/* Create User Modal */}
      <Modal isOpen={isCreateOpen} onClose={onCreateClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create New User</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Username</FormLabel>
                <Input 
                  name="username" 
                  value={formValues.username} 
                  onChange={handleInputChange} 
                />
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel>Password</FormLabel>
                <Input 
                  name="password"
                  type="password" 
                  value={formValues.password} 
                  onChange={handleInputChange} 
                />
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel>Name</FormLabel>
                <Input 
                  name="name" 
                  value={formValues.name} 
                  onChange={handleInputChange} 
                />
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel>Role</FormLabel>
                <Select 
                  name="role" 
                  value={formValues.role} 
                  onChange={handleInputChange}
                >
                  <option value="admin">Admin</option>
                  <option value="outlet_manager">Outlet Manager</option>
                  <option value="deliveryman">Delivery Man</option>
                </Select>
              </FormControl>
              
              {formValues.role === 'outlet_manager' && (
                <FormControl isRequired>
                  <FormLabel>Outlet</FormLabel>
                  <Select 
                    name="outlet_id" 
                    value={formValues.outlet_id} 
                    onChange={handleInputChange}
                  >
                    <option value="">Select Outlet</option>
                    {outlets.map(outlet => (
                      <option key={outlet.id} value={outlet.id}>{outlet.name}</option>
                    ))}
                  </Select>
                </FormControl>
              )}
              
              <FormControl>
                <FormLabel>Email</FormLabel>
                <Input 
                  name="email" 
                  type="email"
                  value={formValues.email} 
                  onChange={handleInputChange} 
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onCreateClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleCreateUser}>
              Create User
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={isEditOpen} onClose={onEditClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit User</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Username</FormLabel>
                <Input 
                  name="username" 
                  value={formValues.username} 
                  onChange={handleInputChange} 
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>Password (leave blank to keep current)</FormLabel>
                <Input 
                  name="password"
                  type="password" 
                  value={formValues.password} 
                  onChange={handleInputChange} 
                  placeholder="Enter new password or leave blank"
                />
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel>Name</FormLabel>
                <Input 
                  name="name" 
                  value={formValues.name} 
                  onChange={handleInputChange} 
                />
              </FormControl>
              
              <FormControl isRequired>
                <FormLabel>Role</FormLabel>
                <Select 
                  name="role" 
                  value={formValues.role} 
                  onChange={handleInputChange}
                >
                  <option value="admin">Admin</option>
                  <option value="outlet_manager">Outlet Manager</option>
                  <option value="deliveryman">Delivery Man</option>
                </Select>
              </FormControl>
              
              {formValues.role === 'outlet_manager' && (
                <FormControl isRequired>
                  <FormLabel>Outlet</FormLabel>
                  <Select 
                    name="outlet_id" 
                    value={formValues.outlet_id} 
                    onChange={handleInputChange}
                  >
                    <option value="">Select Outlet</option>
                     {locations.map((location) => (
                      <option key={location.id} value={location.nama_lokasi}>
                        {location.nama_lokasi}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              )}
              
              <FormControl>
                <FormLabel>Email</FormLabel>
                <Input 
                  name="email" 
                  type="email"
                  value={formValues.email} 
                  onChange={handleInputChange} 
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onEditClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleUpdateUser}>
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Reset Password Modal */}
      <Modal isOpen={isResetOpen} onClose={onResetClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Reset Password</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Text>Reset password for user: <strong>{selectedUser?.username}</strong></Text>
              
              <FormControl isRequired>
                <FormLabel>New Password</FormLabel>
                <Input 
                  name="password"
                  type="password" 
                  value={formValues.password} 
                  onChange={handleInputChange} 
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onResetClose}>
              Cancel
            </Button>
            <Button colorScheme="yellow" onClick={handleResetPassword}>
              Reset Password
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete User Modal */}
      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Delete User</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>Are you sure you want to delete user <strong>{selectedUser?.username}</strong>?</Text>
            <Text mt={2} color="red.500">This action cannot be undone.</Text>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onDeleteClose}>
              Cancel
            </Button>
            <Button colorScheme="red" onClick={handleDeleteUser}>
              Delete User
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
};

export default UserManagementPage;
