import { useState } from 'react';
import { Box, Button, Text, Heading, VStack, Code, Spinner, useToast } from '@chakra-ui/react';
import apiClient from '../api/api';

function DebugPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const toast = useToast();

  const testEndpoint = async (endpoint, method = 'GET', data = null) => {
    setLoading(true);
    setResult(null);
    setError(null);
    
    try {
      console.log(`Testing ${method} ${endpoint}`);
      let response;
      
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
    } catch (err) {
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

  return (
    <Box p={5}>
      <Heading mb={5}>API Debug Page</Heading>
      
      <VStack spacing={4} align="flex-start" mb={8}>
        <Heading size="md">Test GET Endpoints</Heading>
        <Button 
          colorScheme="blue" 
          onClick={() => testEndpoint('/api/config')}
          isLoading={loading}
        >
          Test /api/config
        </Button>
        <Button 
          colorScheme="blue" 
          onClick={() => testEndpoint('/api/products')}
          isLoading={loading}
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
        >
          Test Create Product
        </Button>
      </VStack>

      <Box mt={5} p={4} borderWidth={1} borderRadius="md">
        <Heading size="md" mb={3}>Result:</Heading>
        {loading ? (
          <Spinner />
        ) : error ? (
          <Box bg="red.50" p={3} borderRadius="md">
            <Text color="red.500" fontWeight="bold">Error: {error.message}</Text>
            <Text>Status: {error.status}</Text>
            <Text mt={2}>Response:</Text>
            <Code p={2} display="block" whiteSpace="pre-wrap">
              {typeof error.response === 'object' 
                ? JSON.stringify(error.response, null, 2)
                : error.response}
            </Code>
          </Box>
        ) : result ? (
          <Box bg="green.50" p={3} borderRadius="md">
            <Code p={2} display="block" whiteSpace="pre-wrap">
              {JSON.stringify(result, null, 2)}
            </Code>
          </Box>
        ) : (
          <Text>Run a test to see results</Text>
        )}
      </Box>
    </Box>
  );
}

export default DebugPage;
