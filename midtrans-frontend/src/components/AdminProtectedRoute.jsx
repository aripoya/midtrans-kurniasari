import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Card,
  CardBody,
  Center,
  Container,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Spinner,
  Stack,
  Text,
  useToast,
  VStack
} from '@chakra-ui/react';

// Simple mock auth service - replace with actual implementation
const authService = {
  login: async (username, password) => {
    // In a real app, make API call to validate credentials
    // For demo purposes, we'll accept admin/admin123
    if (username === 'admin' && password === 'admin123') {
      localStorage.setItem('adminToken', 'mock-jwt-token');
      return { success: true };
    }
    return { success: false, error: 'Invalid credentials' };
  },
  
  isAuthenticated: () => {
    return localStorage.getItem('adminToken') !== null;
  },
  
  logout: () => {
    localStorage.removeItem('adminToken');
  }
};

const LoginForm = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const result = await authService.login(username, password);
      if (result.success) {
        toast({
          title: "Login berhasil",
          status: "success",
          duration: 2000,
        });
        onLogin();
      } else {
        setError(result.error || 'Login gagal');
      }
    } catch (err) {
      setError('Terjadi kesalahan sistem');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Container maxW="md" py={12}>
      <VStack spacing={8}>
        <Heading>Admin Login</Heading>
        <Card w="100%">
          <CardBody>
            <form onSubmit={handleSubmit}>
              <VStack spacing={4}>
                {error && (
                  <Alert status="error">
                    <AlertIcon />
                    {error}
                  </Alert>
                )}
                <FormControl isRequired>
                  <FormLabel>Username</FormLabel>
                  <Input 
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Password</FormLabel>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </FormControl>
                <Button
                  type="submit"
                  colorScheme="teal"
                  width="full"
                  isLoading={loading}
                >
                  Login
                </Button>
              </VStack>
            </form>
          </CardBody>
        </Card>
        <Text fontSize="sm" color="gray.500">
          Untuk demo, gunakan username: admin, password: admin123
        </Text>
      </VStack>
    </Container>
  );
};

function AdminProtectedRoute({ children }) {
  const [checking, setChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();
  
  useEffect(() => {
    // Check authentication status
    const checkAuth = () => {
      setIsAuthenticated(authService.isAuthenticated());
      setChecking(false);
    };
    
    checkAuth();
  }, []);
  
  if (checking) {
    return (
      <Center h="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }
  
  if (!isAuthenticated) {
    return (
      <LoginForm onLogin={() => setIsAuthenticated(true)} />
    );
  }
  
  return children;
}

export default AdminProtectedRoute;
