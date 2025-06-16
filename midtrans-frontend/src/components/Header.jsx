import { Box, Heading } from '@chakra-ui/react';

// Simplified header without router links for debugging
function Header() {
  return (
    <Box
      as="nav"
      bg="white"
      borderBottomWidth="1px"
      boxShadow="sm"
      py={4}
      px={4}
    >
      <Heading
        fontSize="xl"
        fontWeight="bold"
        color="teal.500"
      >
        Kurniasari Order Management
      </Heading>
    </Box>
  );
}

export default Header;
