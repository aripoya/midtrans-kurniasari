import React from 'react';
import { Outlet } from 'react-router-dom';
import {
  Box,
  Container,
  Flex,
  Heading,
  Link,
  Stack,
  Text,
  useColorModeValue,
  IconButton,
  useDisclosure,
  Collapse,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { HamburgerIcon, CloseIcon } from '@chakra-ui/icons';

function AdminLayout() {
  const bgColor = useColorModeValue('gray.100', 'gray.900');
  const headerBg = useColorModeValue('white', 'gray.800');
  const { isOpen, onToggle } = useDisclosure();

  return (
    <Box minH="100vh" bg={bgColor}>
      {/* Header */}
      <Box
        as="header"
        bg={headerBg}
        py={4}
        px={{ base: 4, md: 8 }}
        boxShadow="sm"
        position="sticky"
        top={0}
        zIndex={10}
      >
        <Flex
          align="center"
          justify="space-between"
          direction="row"
        >
          {/* Logo */}
          <Heading size="md" as={RouterLink} to="/admin" color="teal.500">
            Kurniasari Admin
          </Heading>

          {/* Desktop Navigation */}
          <Flex
            gap={6}
            display={{ base: 'none', md: 'flex' }}
            align="center"
          >
            <Link as={RouterLink} to="/admin/orders" fontWeight="medium"  _hover={{ textDecoration: 'none', color: 'inherit' }}>
              Pesanan
            </Link>
            <Link as={RouterLink} to="/admin/orders/new" fontWeight="medium"  _hover={{ textDecoration: 'none', color: 'inherit' }}>
              Pesanan Baru
            </Link>
            <Link as={RouterLink} to="/admin/users" fontWeight="medium"  _hover={{ textDecoration: 'none', color: 'inherit' }}>
              User Management
            </Link>
          </Flex>

          {/* Burger Menu (Mobile only) */}
          <IconButton
            display={{ base: 'inline-flex', md: 'none' }}
            onClick={onToggle}
            icon={isOpen ? <CloseIcon /> : <HamburgerIcon />}
            variant="ghost"
            aria-label="Toggle Navigation"
          />
        </Flex>

        {/* Mobile Navigation */}
        <Collapse in={isOpen} animateOpacity>
          <Stack
            direction="column"
            spacing={3}
            mt={4}
            align="flex-start"
            display={{ base: 'flex', md: 'none' }}
            px={2}
          >
            <Link as={RouterLink} to="/admin/orders" fontWeight="medium" w="full"  _hover={{ textDecoration: 'none', color: 'inherit' }}>
              Pesanan
            </Link>
            <Link as={RouterLink} to="/admin/orders/new" fontWeight="medium" w="full"  _hover={{ textDecoration: 'none', color: 'inherit' }}>
              Pesanan Baru
            </Link>
            <Link as={RouterLink} to="/admin/users" fontWeight="medium" w="full"  _hover={{ textDecoration: 'none', color: 'inherit' }}>
              User Management
            </Link>
          </Stack>
        </Collapse>
      </Box>

      {/* Main Content */}
      <Container maxW="container.xl" py={8}>
        <Outlet />
      </Container>

      {/* Footer */}
      <Box
        as="footer"
        py={6}
        textAlign="center"
        borderTopWidth={1}
        borderColor="gray.200"
      >
        <Text fontSize="sm" color="gray.500">
          &copy; {new Date().getFullYear()} Kurniasari Order Management - Admin Panel
        </Text>
      </Box>
    </Box>
  );
}

export default AdminLayout;
