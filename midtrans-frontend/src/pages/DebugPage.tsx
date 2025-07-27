import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  Text, 
  Heading, 
  VStack, 
  Code, 
  Spinner, 
  useToast, 
  Container, 
  useBreakpointValue 
} from '@chakra-ui/react';
import apiClient from '../api/api';

// TypeScript interfaces
interface ErrorInfo {
  message: string;
  response: any;
  status: string | number;
}

type HTTPMethod = 'GET' | 'POST';

const DebugPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const toast = useToast();

  const testEndpoint = async (endpoint: string, method: HTTPMethod = 'GET', data: any = null): Promise<void> => {
    setLoading(true);
    setResult(null);
    setError(null);
    
    try {
      console.log(`Testing ${method} ${endpoint}`);
      let response: any;
      
      if (method === 'GET') {
        response = await apiClient.get(endpoint);
      } else if (method === 'POST') {
        response = await apiClient.post(endpoint, data);
      }
      
      console.log('Response:', response);
      setResult(response.data);
      toast({
        title: 'Request successful',
        description: `${method} ${endpoint} succeeded`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (err: any) {
      console.error('Error:', err);
      setError({
        message: err.message,
        response: err.response?.data || 'No response data',
        status: err.response?.status || 'No status code'
      });
      toast({
        title: 'Request failed',
        description: `${method} ${endpoint} failed: ${err.message}`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // Responsif styling untuk iPhone 6.5-6.7 inch
  const headingSize = useBreakpointValue({ base: "lg", md: "xl" });
  const buttonWidth = useBreakpointValue({ base: "100%", md: "auto" });
  const buttonSize = useBreakpointValue({ base: "sm", md: "md" });

  return (
    <Container maxW="container.xl" p={{ base: 3, md: 5 }}>
      <Heading mb={5} size={headingSize}>API Debug Page</Heading>
      
      <VStack spacing={4} align="flex-start" mb={8}>
        <Heading size="md">Test GET Endpoints</Heading>
        <Button 
          colorScheme="blue" 
          onClick={() => testEndpoint('/api/config')}
          isLoading={loading}
          width={buttonWidth}
          size={buttonSize}
        >
          Test /api/config
        </Button>
        <Button 
          colorScheme="blue" 
          onClick={() => testEndpoint('/api/products')}
          isLoading={loading}
          width={buttonWidth}
          size={buttonSize}
        >
          Test GET /api/products
        </Button>
      </VStack>

      <VStack spacing={4} align="flex-start" mb={8}>
        <Heading size="md">Test POST Endpoints</Heading>
        <Button 
          colorScheme="green" 
          onClick={() => testEndpoint('/api/products', 'POST', { name: 'Test Product ' + Date.now(), price: 10000 })}
          isLoading={loading}
          width={buttonWidth}
          size={buttonSize}
        >
          Test Create Product
        </Button>
      </VStack>

      <Box mt={5} p={{ base: 3, md: 4 }} borderWidth={1} borderRadius="md" overflowX="auto">
        <Heading size="md" mb={3}>Result:</Heading>
        {loading ? (
          <Spinner />
        ) : error ? (
          <Box bg="red.50" p={3} borderRadius="md">
            <Text color="red.500" fontWeight="bold">Error: {error.message}</Text>
            <Text>Status: {error.status}</Text>
            <Text mt={2}>Response:</Text>
            <Code p={2} display="block" whiteSpace="pre-wrap" fontSize={{ base: "xs", md: "sm" }} overflowX="auto">
              {typeof error.response === 'object' 
                ? JSON.stringify(error.response, null, 2)
                : error.response}
            </Code>
          </Box>
        ) : result ? (
          <Box bg="green.50" p={3} borderRadius="md">
            <Code p={2} display="block" whiteSpace="pre-wrap" fontSize={{ base: "xs", md: "sm" }} overflowX="auto">
              {JSON.stringify(result, null, 2)}
            </Code>
          </Box>
        ) : (
          <Text>Run a test to see results</Text>
        )}
      </Box>
    </Container>
  );
};

export default DebugPage;
