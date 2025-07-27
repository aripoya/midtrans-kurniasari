import { Box, Heading, Flex, Button, Text, HStack, useBreakpointValue } from '@chakra-ui/react';
import { useAuth } from '../auth/AuthContext';
import { useLocation } from 'react-router-dom';
import NotificationBell from './NotificationBell';

function Header() {
  const { isLoggedIn, user, logout } = useAuth();
  const location = useLocation();
  const headingSize = useBreakpointValue({ base: "md", md: "xl" });
  const showUsername = useBreakpointValue({ base: false, sm: true });
  
  // Check if we're on a public order page
  const isPublicOrderPage = location.pathname.includes('ORDER-');

  return (
    <Box
      as="nav"
      bg="white"
      borderBottomWidth="1px"
      boxShadow="sm"
      py={4}
      px={4}
      className="admin-header"
    >
      <Flex 
        justify="space-between" 
        align="center"
        direction={{ base: "column", sm: "row" }}
        gap={{ base: 2, sm: 0 }}
      >
        <Heading
          fontSize={headingSize}
          fontWeight="bold"
          color="teal.500"
          textAlign={{ base: "center", sm: "left" }}
        >
          Kurniasari Order Management
        </Heading>
        
        {isLoggedIn && !isPublicOrderPage && (
          <HStack spacing={{ base: 2, md: 4 }} className="admin-element" align="center">
            {showUsername && <Text>{user?.role === 'admin' ? 'Admin: ' : user?.role === 'outlet_manager' ? 'Outlet: ' : 'Delivery: '}{user?.username}</Text>}
            {/* Only show notifications for authenticated users */}
            <NotificationBell />
            <Button
              colorScheme="teal"
              variant="outline"
              size="sm"
              onClick={logout}
              className="logout-btn"
            >
              Logout
            </Button>
          </HStack>
        )}
      </Flex>
    </Box>
  );
}

export default Header;
