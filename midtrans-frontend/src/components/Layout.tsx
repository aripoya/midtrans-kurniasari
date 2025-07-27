import React, { ReactNode } from 'react';
import { Box, Container, Flex } from '@chakra-ui/react';
import Header from './Header';

// TypeScript interface
interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
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
};

export default Layout;
