import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Heading, 
  FormControl, 
  FormLabel, 
  Input, 
  Button, 
  VStack, 
  Alert, 
  AlertIcon,
  Container,
  Image,
  Text,
  useBreakpointValue
} from '@chakra-ui/react';
import { useAuth } from '../auth/AuthContext';

const LoginPage: React.FC = () => {
  const headingSize = useBreakpointValue({ base: "md", md: "lg" });
  const boxPadding = useBreakpointValue({ base: 4, md: 8 });
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!username || !password) {
      setError('Username dan password harus diisi');
      setIsLoading(false);
      return;
    }

    try {
      const result = await login(username, password);
      
      if (result.success && result.user) {
        // Navigate based on user role
        switch(result.user.role) {
          case 'admin':
            navigate('/admin');
            break;
          case 'outlet_manager':
            navigate('/outlet/dashboard');
            break;
          case 'deliveryman':
            navigate('/delivery/dashboard');
            break;
          default:
            navigate('/orders');
        }
      } else {
        setError(result.message || 'Username atau password salah');
      }
    } catch (error) {
      setError('Terjadi kesalahan saat login. Silakan coba lagi.');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxW="md" py={{ base: 6, md: 12 }} px={{ base: 4, md: 6 }}>
      <Box 
        p={boxPadding} 
        borderWidth={1} 
        borderRadius="lg" 
        boxShadow="lg" 
        bg="white"
      >
        <VStack spacing={6}>
          <Image 
            src="https://logo.kurniasari.co.id/logo%20kurniasari%20web.svg" 
            alt="Kurniasari Logo" 
            maxH="100px"
            fallbackSrc="https://via.placeholder.com/150x80?text=Kurniasari" 
          />
          
          <Heading size={headingSize} textAlign="center">Login Kurniasari</Heading>
          <Text fontSize="md" color="gray.600" textAlign="center">
            Silakan masukkan username dan password Anda untuk mengakses sistem
          </Text>
          
          {error && (
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              {error}
            </Alert>
          )}
          
          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            <VStack spacing={4} align="stretch">
              <FormControl id="username" isRequired>
                <FormLabel>Username</FormLabel>
                <Input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </FormControl>
              
              <FormControl id="password" isRequired>
                <FormLabel>Password</FormLabel>
                <Input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </FormControl>
              
              <Button 
                mt={4} 
                colorScheme="teal" 
                type="submit"
                isLoading={isLoading}
                width="full"
              >
                Login
              </Button>
            </VStack>
          </form>
          
          <Text fontSize="sm" color="gray.500" textAlign="center">
            © {new Date().getFullYear()} Kurniasari. All rights reserved.
          </Text>
        </VStack>
      </Box>
    </Container>
  );
};

export default LoginPage;
