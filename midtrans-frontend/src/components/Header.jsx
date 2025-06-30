import { Box, Heading, Flex, Button, Text, HStack, useBreakpointValue } from '@chakra-ui/react';
import { useAuth } from '../auth/AuthContext';

function Header() {
  const { isLoggedIn, user, logout } = useAuth();
  const headingSize = useBreakpointValue({ base: "md", md: "xl" });
  const showUsername = useBreakpointValue({ base: false, sm: true });

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
        
        {isLoggedIn && (
          <HStack spacing={{ base: 2, md: 4 }}>
            {showUsername && <Text>Admin: {user?.username}</Text>}
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
