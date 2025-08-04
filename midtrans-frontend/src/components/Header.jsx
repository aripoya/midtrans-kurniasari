import {
  Box,
  Heading,
  Flex,
  Button,
  Text,
  HStack,
  useBreakpointValue,
  Spacer,
} from '@chakra-ui/react';
import { useAuth } from '../auth/AuthContext';
import { useLocation } from 'react-router-dom';
import NotificationBell from './NotificationBell';

function Header() {
  const { isLoggedIn, user, logout } = useAuth();
  const location = useLocation();

  const headingSize = useBreakpointValue({ base: 'md', md: 'xl' });
  const showUsername = useBreakpointValue({ base: false, sm: true });
  const isPublicOrderPage = location.pathname.includes('ORDER-');

  const getUserPrefix = () => {
    if (user?.role === 'admin') return 'Admin: ';
    if (user?.role === 'outlet_manager') return 'Outlet: ';
    return 'Delivery: ';
  };

  return (
    <Box
      as="nav"
      bg="white"
      borderBottomWidth="1px"
      boxShadow="sm"
      py={4}
      px={4}
    >
      <Flex
        direction="row"
        align="center"
        justify="space-between"
        wrap="wrap"
        gap={4}
      >
        <Heading
          fontSize={headingSize}
          fontWeight="bold"
          color="teal.500"
          flexShrink={0}
        >
          Kurniasari Order Management
        </Heading>
        {isLoggedIn && !isPublicOrderPage && (
          <Flex
            align="center"
            gap={4}
            ml="auto"
            flexWrap="wrap"
            justify="flex-end"
          >
            {showUsername && (
              <Text whiteSpace="nowrap">
                {getUserPrefix()}
                {user?.username}
              </Text>
            )}
            <NotificationBell />
            <Button
              colorScheme="teal"
              variant="outline"
              size="sm"
              onClick={logout}
            >
              Logout
            </Button>
          </Flex>
        )}
      </Flex>
    </Box>
  );
}

export default Header;
