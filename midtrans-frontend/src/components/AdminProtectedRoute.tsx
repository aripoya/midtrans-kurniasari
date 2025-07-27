import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Center,
  Spinner,
  Text
} from '@chakra-ui/react';
import { useAuth } from '../auth/AuthContext';

// TypeScript interface
interface AdminProtectedRouteProps {
  children: ReactNode;
}

const AdminProtectedRoute: React.FC<AdminProtectedRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth();
  
  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <Center h="100vh">
        <Spinner size="xl" />
        <Text ml={4}>Checking authentication...</Text>
      </Center>
    );
  }
  
  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // Check if user has admin role
  if (user.role !== 'admin') {
    return (
      <Center h="100vh">
        <Text color="red.500" fontSize="lg">
          Access denied: Admin privileges required
        </Text>
      </Center>
    );
  }
  
  // User is authenticated and has admin role
  return <>{children}</>;
};

export default AdminProtectedRoute;
