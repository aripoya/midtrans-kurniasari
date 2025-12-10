import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Heading,
  Text,
  useToast,
  Card,
  CardBody,
  InputGroup,
  InputRightElement,
  IconButton,
} from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons';

interface PasswordProtectedProps {
  children: React.ReactNode;
  requiredUsername: string;
  requiredPassword: string;
  pageTitle: string;
  storageKey: string;
}

const PasswordProtected: React.FC<PasswordProtectedProps> = ({
  children,
  requiredUsername,
  requiredPassword,
  pageTitle,
  storageKey,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    // Check if already authenticated in this session
    const authStatus = sessionStorage.getItem(storageKey);
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, [storageKey]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simple delay for UX
    setTimeout(() => {
      if (username === requiredUsername && password === requiredPassword) {
        sessionStorage.setItem(storageKey, 'true');
        setIsAuthenticated(true);
        toast({
          title: 'Akses diberikan',
          description: `Selamat datang di ${pageTitle}`,
          status: 'success',
          duration: 2000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Akses ditolak',
          description: 'Username atau password salah',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        setPassword('');
      }
      setLoading(false);
    }, 500);
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <Box
      minH="80vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="gray.50"
    >
      <Card maxW="md" w="full" boxShadow="lg">
        <CardBody>
          <VStack spacing={6} align="stretch">
            <Box textAlign="center">
              <Heading size="lg" mb={2} color="red.600">
                🔒 Halaman Terlindungi
              </Heading>
              <Text color="gray.600" fontSize="sm">
                {pageTitle}
              </Text>
              <Text color="gray.500" fontSize="xs" mt={2}>
                Masukkan kredensial khusus untuk mengakses halaman ini
              </Text>
            </Box>

            <form onSubmit={handleSubmit}>
              <VStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Username</FormLabel>
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username"
                    autoComplete="off"
                    bg="white"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="sm">Password</FormLabel>
                  <InputGroup>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password"
                      autoComplete="off"
                      bg="white"
                    />
                    <InputRightElement>
                      <IconButton
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                        onClick={() => setShowPassword(!showPassword)}
                        variant="ghost"
                        size="sm"
                      />
                    </InputRightElement>
                  </InputGroup>
                </FormControl>

                <Button
                  type="submit"
                  colorScheme="blue"
                  width="full"
                  isLoading={loading}
                  loadingText="Memverifikasi..."
                >
                  Masuk
                </Button>
              </VStack>
            </form>

            <Box
              p={3}
              bg="yellow.50"
              borderRadius="md"
              borderWidth="1px"
              borderColor="yellow.200"
            >
              <Text fontSize="xs" color="yellow.800" textAlign="center">
                ⚠️ Halaman ini berisi fitur sensitif database migration.
                Hanya untuk administrator yang berwenang.
              </Text>
            </Box>
          </VStack>
        </CardBody>
      </Card>
    </Box>
  );
};

export default PasswordProtected;
