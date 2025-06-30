import { useState } from 'react';
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

function LoginPage() {
  const headingSize = useBreakpointValue({ base: "md", md: "lg" });
  const boxPadding = useBreakpointValue({ base: 4, md: 8 });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!username || !password) {
      setError('Username dan password harus diisi');
      setIsLoading(false);
      return;
    }

    const success = login(username, password);
    
    if (success) {
      navigate('/orders');
    } else {
      setError('Username atau password salah');
    }
    
    setIsLoading(false);
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
          
          <Heading size={headingSize} textAlign="center">Login Admin</Heading>
          
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
}

export default LoginPage;
