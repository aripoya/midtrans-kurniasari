import { useEffect, useState } from 'react';
import { Box, Heading, Text, Stack, Card, CardBody, Stat, StatLabel, StatNumber, SimpleGrid, useToast, Container, useBreakpointValue } from '@chakra-ui/react';
import { configService } from '../api/configService';

function HomePage() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const data = await configService.getConfig();
        setConfig(data);
      } catch (error) {
        console.error('Error fetching configuration:', error);
        toast({
          title: 'Error mengambil konfigurasi',
          description: 'Tidak dapat terhubung dengan API',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [toast]);

  // Responsif styling untuk iPhone 6.5-6.7 inch
  const headingSize = useBreakpointValue({ base: "xl", md: "2xl" });
  const subheadingSize = useBreakpointValue({ base: "md", md: "xl" });
  const statLabelSize = useBreakpointValue({ base: "sm", md: "md" });

  return (
    <Container maxW="container.xl" p={{ base: 3, md: 5 }}>
      <Box textAlign="center" py={{ base: 6, md: 10 }}>
        <Heading as="h1" size={headingSize} mb={4}>
          Kurniasari Order Management System
        </Heading>
        <Text fontSize={subheadingSize} color="gray.600">
          Sistem manajemen pemesanan dengan integrasi pembayaran Midtrans
        </Text>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={10}>
        <Card>
          <CardBody>
            <Heading size="md" mb={4}>Status Sistem</Heading>
            {loading ? (
              <Text>Memuat informasi...</Text>
            ) : config ? (
              <Stack>
                <Stat>
                  <StatLabel fontSize={statLabelSize}>Environment</StatLabel>
                  <StatNumber>{config.environment}</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel fontSize={statLabelSize}>Nama Aplikasi</StatLabel>
                  <StatNumber>{config.app_name}</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel fontSize={statLabelSize}>Midtrans Config</StatLabel>
                  <StatNumber>{config.has_midtrans_config ? '✅ Tersedia' : '❌ Tidak Tersedia'}</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel fontSize={statLabelSize}>Database</StatLabel>
                  <StatNumber>{config.has_database ? '✅ Terhubung' : '❌ Tidak Terhubung'}</StatNumber>
                </Stat>
                <Text fontSize="sm" color="gray.500">
                  Last Updated: {new Date(config.timestamp).toLocaleString('id-ID')}
                </Text>
              </Stack>
            ) : (
              <Text>Data tidak tersedia</Text>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <Heading size="md" mb={4}>Tentang Aplikasi</Heading>
            <Text>
              Sistem ini memungkinkan Anda untuk membuat dan mengelola pesanan, serta memproses pembayaran
              secara otomatis dengan Midtrans. Gunakan menu navigasi di atas untuk mengakses fitur-fitur aplikasi.
            </Text>
            <Box mt={4}>
              <Text fontWeight="bold">Fitur-fitur:</Text>
              <Text>• Pembuatan order baru</Text>
              <Text>• Melihat daftar order yang ada</Text>
              <Text>• Detail status pembayaran setiap order</Text>
              <Text>• Konfirmasi pembayaran otomatis melalui Midtrans</Text>
            </Box>
          </CardBody>
        </Card>
      </SimpleGrid>
    </Container>
  );
}

export default HomePage;
