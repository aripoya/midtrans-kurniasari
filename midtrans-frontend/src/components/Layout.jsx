import { Box, Container, Flex } from '@chakra-ui/react';
import Header from './Header';

function Layout({ children }) {
  return (
    <Box minH="100vh" bg="gray.50">
      <Header />
      <Container maxW="container.xl" pt="6" pb="8">
        <Flex direction="column">
          {children}
        </Flex>
      </Container>
    </Box>
  );
}

export default Layout;
