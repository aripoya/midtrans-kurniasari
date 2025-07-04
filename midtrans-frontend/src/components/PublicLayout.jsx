import { Box, Container, Flex, Heading } from '@chakra-ui/react';

function PublicLayout({ children }) {
  return (
    <Box minH="100vh" bg="gray.50">
      <Box
        as="nav"
        bg="white"
        borderBottomWidth="1px"
        boxShadow="sm"
        py={4}
        px={4}
      >
        <Flex justify="center" align="center">
          <Heading
            fontSize={{ base: "md", md: "xl" }}
            fontWeight="bold"
            color="teal.500"
            textAlign="center"
          >
            Kurniasari Order Management
          </Heading>
        </Flex>
      </Box>
      <Container 
        maxW="container.xl" 
        pt={{ base: 4, md: 6 }} 
        pb={{ base: 6, md: 8 }}
        px={{ base: 3, md: 4 }}
      >
        <Flex direction="column">
          {children}
        </Flex>
      </Container>
    </Box>
  );
}

export default PublicLayout;
