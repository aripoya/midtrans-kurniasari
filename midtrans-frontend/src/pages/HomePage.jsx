import { useEffect, useState } from 'react';
import { Box, Heading, Text, Stack, Card, CardBody, Stat, StatLabel, StatNumber, SimpleGrid, useToast } from '@chakra-ui/react';
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

  return (
    <Box>
      <Box textAlign="center" py={10}>
        <Heading as="h1" size="2xl" mb={4}>
          Kurniasari Order Management System
        </Heading>
        <Text fontSize="xl" color="gray.600">
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
                  <StatLabel>Environment</StatLabel>
                  <StatNumber>{config.environment}</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel>Nama Aplikasi</StatLabel>
                  <StatNumber>{config.app_name}</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel>Midtrans Config</StatLabel>
                  <StatNumber>{config.has_midtrans_config ? '✅ Tersedia' : '❌ Tidak Tersedia'}</StatNumber>
                </Stat>
                <Stat>
                  <StatLabel>Database</StatLabel>
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
    </Box>
  );
}

export default HomePage;
