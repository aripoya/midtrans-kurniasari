import { Box, Container, Flex, useBreakpointValue } from '@chakra-ui/react';
import Header from './Header';

function Layout({ children }) {
  return (
    <Box minH="100vh" bg="gray.50">
      <Header />
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

export default Layout;
