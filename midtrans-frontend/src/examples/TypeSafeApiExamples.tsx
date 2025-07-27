// 🚀 TYPE-SAFE API INTEGRATION EXAMPLES
// Demonstrating the power of our newly migrated adminApi.ts with full TypeScript support

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  VStack, 
  HStack, 
  Text, 
  Badge, 
  Input, 
  Select,
  Alert,
  AlertIcon,
  Spinner,
  useToast,
  Heading,
  Divider
} from '@chakra-ui/react';

// Import our type-safe adminApi with all interfaces
import { 
  adminApi, 
  type Order, 
  type User, 
  type CreateUserRequest, 
  type UpdateOrderDetailsRequest,
  type OrdersResponse,
  type UsersResponse 
} from '../api/adminApi';

// 🎯 1. TYPE-SAFE ORDER MANAGEMENT EXAMPLE
const OrderManagementExample: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const toast = useToast();

  // ✨ Type-safe API call with proper error handling
  const fetchOrders = async (): Promise<void> => {
    setLoading(true);
    try {
      // ✨ adminApi.getAdminOrders() now returns properly typed OrdersResponse
      const response: OrdersResponse = await adminApi.getAdminOrders();
      
      if (response.success && response.data?.orders) {
        // ✨ TypeScript knows orders is Order[] array
        setOrders(response.data.orders);
        
        // ✨ IntelliSense shows all Order properties
        response.data.orders.forEach(order => {
          console.log(`Order ${order.id}: ${order.customer_name} - ${order.payment_status}`);
        });
      } else {
        throw new Error(response.error || 'Failed to fetch orders');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true
      });
    } finally {
      setLoading(false);
    }
  };

  // ✨ Type-safe order status update
  const updateOrderStatus = async (orderId: string, newStatus: string): Promise<void> => {
    try {
      // ✨ TypeScript ensures correct parameter types
      const response = await adminApi.updateOrderShippingStatus(orderId, newStatus);
      
      if (response.success) {
        // ✨ Type-safe state update
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order.id === orderId 
              ? { ...order, shipping_status: newStatus }
              : order
          )
        );
        
        toast({
          title: 'Success',
          description: 'Order status updated successfully',
          status: 'success'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        status: 'error'
      });
    }
  };

  // ✨ Type-safe order details update
  const updateOrderArea = async (orderId: string, shippingArea: 'dalam-kota' | 'luar-kota'): Promise<void> => {
    try {
      // ✨ UpdateOrderDetailsRequest interface ensures type safety
      const updateData: UpdateOrderDetailsRequest = {
        shipping_area: shippingArea,
        admin_note: `Area changed to ${shippingArea}`
      };
      
      const response = await adminApi.updateOrderDetails(orderId, updateData);
      
      if (response.success) {
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order.id === orderId 
              ? { ...order, shipping_area: shippingArea }
              : order
          )
        );
      }
    } catch (error: any) {
      console.error('Error updating order area:', error);
    }
  };

  return (
    <Box p={6} borderWidth={1} borderRadius="lg">
      <Heading size="md" mb={4}>🎯 Type-Safe Order Management</Heading>
      
      <HStack mb={4}>
        <Button 
          onClick={fetchOrders} 
          isLoading={loading}
          colorScheme="blue"
        >
          Fetch Orders
        </Button>
        <Text>Found {orders.length} orders</Text>
      </HStack>

      {loading ? (
        <Spinner />
      ) : (
        <VStack spacing={3} align="stretch">
          {orders.slice(0, 5).map(order => (
            <Box key={order.id} p={3} borderWidth={1} borderRadius="md">
              <HStack justify="space-between">
                <VStack align="start" spacing={1}>
                  <Text fontWeight="bold">#{order.id.substring(0, 8)}</Text>
                  <Text fontSize="sm">{order.customer_name}</Text>
                  <HStack>
                    {/* ✨ Type-safe badge rendering based on payment_status union type */}
                    <Badge colorScheme={
                      order.payment_status === 'settlement' ? 'green' :
                      order.payment_status === 'pending' ? 'yellow' : 'red'
                    }>
                      {order.payment_status}
                    </Badge>
                    <Badge variant="outline">{order.shipping_area}</Badge>
                  </HStack>
                </VStack>
                
                <VStack>
                  <Button 
                    size="xs" 
                    onClick={() => updateOrderStatus(order.id, 'dikirim')}
                  >
                    Mark Shipped
                  </Button>
                  <Button 
                    size="xs" 
                    variant="outline"
                    onClick={() => updateOrderArea(
                      order.id, 
                      order.shipping_area === 'dalam-kota' ? 'luar-kota' : 'dalam-kota'
                    )}
                  >
                    Toggle Area
                  </Button>
                </VStack>
              </HStack>
            </Box>
          ))}
        </VStack>
      )}
    </Box>
  );
};

// 🛡️ 2. TYPE-SAFE USER MANAGEMENT EXAMPLE
const UserManagementExample: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [newUser, setNewUser] = useState<CreateUserRequest>({
    username: '',
    password: '',
    name: '',
    role: 'outlet_manager',
    outlet_id: ''
  });
  const toast = useToast();

  // ✨ Type-safe user fetching
  const fetchUsers = async (): Promise<void> => {
    setLoading(true);
    try {
      // ✨ UsersResponse provides full type safety
      const response: UsersResponse = await adminApi.getUsers();
      
      if (response.success && response.data) {
        // ✨ TypeScript knows users is User[] array
        setUsers(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch users');
      }
    } catch (error: any) {
      toast({
        title: 'Error fetching users',
        description: error.message,
        status: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // ✨ Type-safe user creation
  const createUser = async (): Promise<void> => {
    try {
      // ✨ CreateUserRequest interface ensures all required fields
      const response = await adminApi.createUser(newUser);
      
      if (response.success) {
        toast({
          title: 'User created successfully',
          status: 'success'
        });
        
        // Reset form
        setNewUser({
          username: '',
          password: '',
          name: '',
          role: 'outlet_manager',
          outlet_id: ''
        });
        
        // Refresh users list
        await fetchUsers();
      }
    } catch (error: any) {
      toast({
        title: 'Error creating user',
        description: error.message,
        status: 'error'
      });
    }
  };

  // ✨ Type-safe form handling
  const handleInputChange = (field: keyof CreateUserRequest, value: string): void => {
    setNewUser(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Box p={6} borderWidth={1} borderRadius="lg">
      <Heading size="md" mb={4}>🛡️ Type-Safe User Management</Heading>
      
      <VStack spacing={4} align="stretch">
        <HStack>
          <Button onClick={fetchUsers} isLoading={loading} colorScheme="green">
            Fetch Users
          </Button>
          <Text>Users: {users.length}</Text>
        </HStack>

        {/* User Creation Form */}
        <Box p={4} bg="gray.50" borderRadius="md">
          <Text fontWeight="bold" mb={3}>Create New User</Text>
          <VStack spacing={3}>
            <HStack width="100%">
              <Input
                placeholder="Username"
                value={newUser.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
              />
              <Input
                placeholder="Password"
                type="password"
                value={newUser.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
              />
            </HStack>
            
            <HStack width="100%">
              <Input
                placeholder="Full Name"
                value={newUser.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
              {/* ✨ Type-safe role selection with union type */}
              <Select
                value={newUser.role}
                onChange={(e) => handleInputChange('role', e.target.value as CreateUserRequest['role'])}
              >
                <option value="admin">Admin</option>
                <option value="outlet_manager">Outlet Manager</option>
                <option value="deliveryman">Deliveryman</option>
              </Select>
            </HStack>
            
            <Button onClick={createUser} colorScheme="blue" width="100%">
              Create User
            </Button>
          </VStack>
        </Box>

        {/* Users List */}
        <VStack spacing={2} align="stretch">
          {users.slice(0, 3).map(user => (
            <Box key={user.id} p={3} borderWidth={1} borderRadius="md">
              <HStack justify="space-between">
                <VStack align="start" spacing={0}>
                  <Text fontWeight="bold">{user.name}</Text>
                  <Text fontSize="sm" color="gray.600">@{user.username}</Text>
                </VStack>
                
                <VStack align="end" spacing={0}>
                  {/* ✨ Type-safe role badge */}
                  <Badge colorScheme={
                    user.role === 'admin' ? 'red' :
                    user.role === 'outlet_manager' ? 'blue' : 'purple'
                  }>
                    {user.role}
                  </Badge>
                  {user.outlet_id && (
                    <Text fontSize="xs" color="gray.500">{user.outlet_id}</Text>
                  )}
                </VStack>
              </HStack>
            </Box>
          ))}
        </VStack>
      </VStack>
    </Box>
  );
};

// 📸 3. TYPE-SAFE IMAGE UPLOAD EXAMPLE
const ImageUploadExample: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [orderId, setOrderId] = useState<string>('');
  const [imageType, setImageType] = useState<'siap_kirim' | 'pengiriman' | 'diterima'>('siap_kirim');
  const toast = useToast();

  // ✨ Type-safe file upload
  const handleFileUpload = async (): Promise<void> => {
    if (!selectedFile || !orderId) {
      toast({
        title: 'Missing information',
        description: 'Please select a file and enter order ID',
        status: 'warning'
      });
      return;
    }

    setUploading(true);
    try {
      // ✨ Type-safe image upload with proper File type and image type enum
      const response = await adminApi.uploadShippingImage(orderId, imageType, selectedFile);
      
      if (response.success) {
        toast({
          title: 'Image uploaded successfully',
          status: 'success'
        });
        setSelectedFile(null);
        setOrderId('');
      } else {
        throw new Error(response.error || 'Upload failed');
      }
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message,
        status: 'error'
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box p={6} borderWidth={1} borderRadius="lg">
      <Heading size="md" mb={4}>📸 Type-Safe Image Upload</Heading>
      
      <VStack spacing={4}>
        <Input
          placeholder="Order ID"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
        />
        
        {/* ✨ Type-safe image type selection */}
        <Select
          value={imageType}
          onChange={(e) => setImageType(e.target.value as typeof imageType)}
        >
          <option value="siap_kirim">Foto Siap Kirim</option>
          <option value="pengiriman">Foto Pengiriman</option>
          <option value="diterima">Foto Diterima</option>
        </Select>
        
        <Input
          type="file"
          accept="image/*"
          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
        />
        
        <Button 
          onClick={handleFileUpload}
          isLoading={uploading}
          colorScheme="purple"
          isDisabled={!selectedFile || !orderId}
        >
          Upload Image
        </Button>
        
        {selectedFile && (
          <Text fontSize="sm" color="gray.600">
            Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
          </Text>
        )}
      </VStack>
    </Box>
  );
};

// 🎯 MAIN COMPONENT - SHOWCASE ALL TYPE-SAFE FEATURES
const TypeSafeApiExamples: React.FC = () => {
  return (
    <Box p={6} maxW="1200px" mx="auto">
      <Heading size="lg" mb={6} textAlign="center">
        🚀 Type-Safe API Integration Examples
      </Heading>
      
      <Text mb={6} textAlign="center" color="gray.600">
        Demonstrating the power of our migrated adminApi.ts with comprehensive TypeScript support
      </Text>
      
      <VStack spacing={8} align="stretch">
        <OrderManagementExample />
        <Divider />
        <UserManagementExample />
        <Divider />
        <ImageUploadExample />
        
        <Alert status="info">
          <AlertIcon />
          <Box>
            <Text fontWeight="bold">✨ Enhanced Development Experience:</Text>
            <Text fontSize="sm">
              • Full IntelliSense support for all API methods<br/>
              • Compile-time error detection<br/>
              • Type-safe request/response handling<br/>
              • Automatic code completion<br/>
              • Better refactoring capabilities
            </Text>
          </Box>
        </Alert>
      </VStack>
    </Box>
  );
};

export default TypeSafeApiExamples;

/*
🎯 KEY BENEFITS DEMONSTRATED:

1. 🔒 TYPE SAFETY:
   - All API responses are properly typed
   - Request payloads use interface validation
   - Union types prevent invalid values

2. 🚀 DEVELOPER EXPERIENCE:
   - IntelliSense shows all available properties
   - Automatic error detection at compile-time
   - Better code navigation and refactoring

3. 🛡️ ERROR PREVENTION:
   - Invalid parameter types caught before runtime
   - Missing required fields highlighted immediately
   - Type-safe state management

4. 📈 MAINTAINABILITY:
   - Clear interfaces document API contracts
   - Changes to types propagate throughout codebase
   - Self-documenting code with type annotations

🚀 Try opening this file in VS Code and:
   - Hover over any variable to see its type
   - Type "adminApi." to see all available methods
   - Try changing types to see immediate feedback
   - Use Ctrl/Cmd+Click to navigate to type definitions
*/
