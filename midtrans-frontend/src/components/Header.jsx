import { Box, Heading, Flex, Button, Text, HStack } from '@chakra-ui/react';
import { useAuth } from '../auth/AuthContext';

function Header() {
  const { isLoggedIn, user, logout } = useAuth();

  return (
    <Box
      as="nav"
      bg="white"
      borderBottomWidth="1px"
      boxShadow="sm"
      py={4}
      px={4}
    >
      <Flex justify="space-between" align="center">
        <Heading
          fontSize="xl"
          fontWeight="bold"
          color="teal.500"
        >
          Kurniasari Order Management
        </Heading>
        
        {isLoggedIn && (
          <HStack spacing={4}>
            <Text>Admin: {user?.username}</Text>
            <Button
              colorScheme="teal"
              variant="outline"
              size="sm"
              onClick={logout}
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
