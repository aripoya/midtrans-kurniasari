import React, { useEffect, useState } from 'react';
import { Box, Button, Text, VStack, Heading, Code, Alert, AlertIcon } from '@chakra-ui/react';
import api from '../api/api';
import { useAuth } from '../auth/AuthContext';

// TypeScript interfaces
interface ErrorInfo {
  message: string;
  response: any;
  status: string | number;
}

const DebugNotificationPage: React.FC = () => {
  const { isAuthenticated, user, getToken } = useAuth();
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  
  const testNotificationEndpoint = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setResponse(null);
    
    try {
      const token = getToken();
      
      // Log the request details
      console.log('Request URL:', `${api.defaults.baseURL}/notifications`);
      console.log('Auth token:', token);
      
      // Add auth token to headers
      const response = await api.get('/notifications', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log('Full response:', response);
      setResponse(response.data);
    } catch (err: any) {
      console.error('Error testing notification endpoint:', err);
      setError({
        message: err.message,
        response: err.response?.data || 'No response data',
        status: err.response?.status || 'Unknown status'
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Box p={5}>
      <Heading mb={4}>Notification API Debug</Heading>
      
      {!isAuthenticated && (
        <Alert status="warning" mb={4}>
          <AlertIcon />
          You are not authenticated. Please login first.
        </Alert>
      )}
      
      {isAuthenticated && (
        <Box mb={4}>
          <Text>Logged in as: {user?.username} (Role: {user?.role})</Text>
        </Box>
      )}
      
      <Button 
        colorScheme="blue" 
        onClick={testNotificationEndpoint} 
        isLoading={loading}
        isDisabled={!isAuthenticated}
        mb={4}
      >
        Test Notification API
      </Button>
      
      {error && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          <VStack align="start" w="100%">
            <Text fontWeight="bold">Error: {error.message}</Text>
            <Text>Status: {error.status}</Text>
            <Box overflowX="auto" w="100%">
              <Code p={2} w="100%">
                {JSON.stringify(error.response, null, 2)}
              </Code>
            </Box>
          </VStack>
        </Alert>
      )}
      
      {response && (
        <Box overflowX="auto" w="100%">
          <Heading size="md" mb={2}>Response:</Heading>
          <Code p={2} w="100%" whiteSpace="pre-wrap">
            {JSON.stringify(response, null, 2)}
          </Code>
        </Box>
      )}
    </Box>
  );
};

export default DebugNotificationPage;
