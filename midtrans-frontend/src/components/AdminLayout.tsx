import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, Container, Flex, Heading, HStack, Link, Spacer, Text, useColorModeValue } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

const AdminLayout: React.FC = () => {
  const bgColor = useColorModeValue('gray.100', 'gray.900');
  const headerBg = useColorModeValue('white', 'gray.800');
  
  return (
    <Box minH="100vh" bg={bgColor}>
      {/* Admin Header */}
      <Box as="header" bg={headerBg} py={4} px={6} boxShadow="sm" position="sticky" top={0} zIndex={10}>
        <Flex align="center">
          <Heading size="md" as={RouterLink} to="/admin" color="teal.500">
            Kurniasari Admin
          </Heading>
          <Spacer />
          <HStack spacing={6}>
            <Link as={RouterLink} to="/admin/orders" fontWeight="medium">
              Pesanan
            </Link>
            <Link as={RouterLink} to="/admin/orders/new" fontWeight="medium">
              Pesanan Baru
            </Link>
            <Link as={RouterLink} to="/admin/users" fontWeight="medium">
              User Management
            </Link>
            <Link as={RouterLink} to="/admin/activity" fontWeight="medium">
              Aktivitas Admin
            </Link>
            <Link as={RouterLink} to="/admin/dalam-kota-report" fontWeight="medium">
              Laporan Dalam Kota
            </Link>
            <Link as={RouterLink} to="/admin/luar-kota-report" fontWeight="medium">
              Laporan Luar Kota
            </Link>
            <Link as={RouterLink} to="/admin/safe-migration" fontWeight="medium">
              Safe Migration
            </Link>
          </HStack>
        </Flex>
      </Box>
      
      {/* Main Content */}
      <Container maxW="container.xl" py={8}>
        <Outlet />
      </Container>
      
      {/* Footer */}
      <Box as="footer" py={6} textAlign="center" borderTopWidth={1} borderColor="gray.200">
        <Text fontSize="sm" color="gray.500">
          &copy; {new Date().getFullYear()} Kurniasari Order Management - Admin Panel
        </Text>
      </Box>
    </Box>
  );
};

export default AdminLayout;
