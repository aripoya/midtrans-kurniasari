import React, { useEffect, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Badge,
  Card,
  CardBody,
  Heading,
  Divider,
  useToast,
  Icon,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Spinner,
  Code
} from '@chakra-ui/react';
import { FaCopy, FaExternalLinkAlt, FaCheck, FaShippingFast } from 'react-icons/fa';
import { useSearchParams, useNavigate } from 'react-router-dom';

const JNETrackingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  
  const resiNumber = searchParams.get('resi') || '';
  const orderId = searchParams.get('orderId') || '';
  
  const [copied, setCopied] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  // Auto-copy resi to clipboard on page load
  useEffect(() => {
    if (resiNumber) {
      navigator.clipboard.writeText(resiNumber).then(() => {
        setCopied(true);
        toast({
          title: 'Nomor Resi JNE Siap!',
          description: `Nomor resi ${resiNumber} telah disalin ke clipboard`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }).catch(() => {
        toast({
          title: 'Info',
          description: 'Silakan copy nomor resi secara manual',
          status: 'info',
          duration: 3000,
          isClosable: true,
        });
      });
    }
  }, [resiNumber, toast]);

  const handleCopyResi = async () => {
    try {
      await navigator.clipboard.writeText(resiNumber);
      setCopied(true);
      toast({
        title: 'Berhasil!',
        description: 'Nomor resi telah disalin ke clipboard',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Gagal menyalin ke clipboard',
        status: 'error',
        duration: 2000,
        isClosable: true,
      });
    }
  };

  const handleOpenJNETracking = () => {
    setIsOpening(true);
    
    // Copy resi to clipboard again before opening
    navigator.clipboard.writeText(resiNumber).catch(() => {});
    
    // Open JNE tracking page
    window.open('https://jne.co.id/en/tracking-package', '_blank');
    
    setTimeout(() => {
      setIsOpening(false);
    }, 2000);
  };

  const handleGoBack = () => {
    if (orderId) {
      navigate(`/order/${orderId}`);
    } else {
      navigate(-1);
    }
  };

  return (
    <Box minH="100vh" bg="gray.50" py={8}>
      <Box maxW="md" mx="auto" px={4}>
        <VStack spacing={6} align="stretch">
          
          {/* Header with JNE branding */}
          <Box textAlign="center">
            <HStack justify="center" mb={3}>
              <Icon as={FaShippingFast} color="red.500" boxSize={8} />
              <Heading size="lg" color="red.600">
                JNE Tracking
              </Heading>
            </HStack>
            <Text color="gray.600" fontSize="sm">
              Jalur Nugraha Ekakurir - Lacak paket Anda dengan mudah
            </Text>
          </Box>

          {/* Resi Display Card */}
          <Card>
            <CardBody>
              <VStack spacing={4} align="stretch">
                <Box textAlign="center">
                  <Text fontSize="sm" color="gray.600" mb={2}>
                    Nomor Resi JNE:
                  </Text>
                  <Code 
                    fontSize="xl" 
                    fontWeight="bold" 
                    p={3} 
                    borderRadius="md"
                    colorScheme="red"
                    display="block"
                  >
                    {resiNumber}
                  </Code>
                </Box>

                <HStack spacing={2}>
                  <Button
                    leftIcon={<Icon as={copied ? FaCheck : FaCopy} />}
                    colorScheme={copied ? "green" : "gray"}
                    variant="outline"
                    onClick={handleCopyResi}
                    flex={1}
                    size="sm"
                  >
                    {copied ? 'Tersalin!' : 'Copy Resi'}
                  </Button>
                </HStack>
              </VStack>
            </CardBody>
          </Card>

          {/* Status Alert */}
          {copied && (
            <Alert status="success" borderRadius="md">
              <AlertIcon />
              <Box>
                <AlertTitle>Siap untuk tracking JNE!</AlertTitle>
                <AlertDescription>
                  Nomor resi telah disalin ke clipboard Anda
                </AlertDescription>
              </Box>
            </Alert>
          )}

          {/* Main Action Button */}
          <Button
            leftIcon={isOpening ? <Spinner size="sm" /> : <Icon as={FaExternalLinkAlt} />}
            colorScheme="red"
            size="lg"
            onClick={handleOpenJNETracking}
            isLoading={isOpening}
            loadingText="Membuka JNE..."
            _hover={{
              bg: 'red.600',
              transform: 'translateY(-2px)',
              boxShadow: 'lg',
            }}
            transition="all 0.2s"
          >
            Buka JNE Tracking
          </Button>

          {/* Instructions */}
          <Card>
            <CardBody>
              <VStack spacing={3} align="start">
                <HStack>
                  <Icon as={FaShippingFast} color="red.500" />
                  <Heading size="sm" color="red.600">
                    Panduan JNE Tracking:
                  </Heading>
                </HStack>
                <VStack spacing={2} align="start" fontSize="sm" color="gray.700">
                  <Text>
                    <Badge colorScheme="red" mr={2}>1</Badge>
                    Klik "Buka JNE Tracking" untuk membuka halaman JNE
                  </Text>
                  <Text>
                    <Badge colorScheme="red" mr={2}>2</Badge>
                    Paste nomor resi yang sudah disalin ke kolom "Airway Bill"
                  </Text>
                  <Text>
                    <Badge colorScheme="red" mr={2}>3</Badge>
                    Klik tombol "Track" untuk melihat status pengiriman
                  </Text>
                  <Text>
                    <Badge colorScheme="red" mr={2}>4</Badge>
                    Halaman kedua akan menampilkan detail tracking lengkap
                  </Text>
                </VStack>
              </VStack>
            </CardBody>
          </Card>

          {/* Additional Info */}
          <Card bg="blue.50" border="1px" borderColor="blue.200">
            <CardBody>
              <VStack spacing={2} align="start">
                <HStack>
                  <Icon as={FaCheck} color="blue.500" />
                  <Text fontSize="sm" fontWeight="bold" color="blue.700">
                    Automation Features:
                  </Text>
                </HStack>
                <VStack spacing={1} align="start" fontSize="xs" color="blue.600">
                  <Text>• Auto-copy nomor resi ke clipboard</Text>
                  <Text>• Direct link ke JNE tracking official</Text>
                  <Text>• Sampai halaman kedua (no "See More" required)</Text>
                  <Text>• Back navigation ke detail pesanan</Text>
                </VStack>
              </VStack>
            </CardBody>
          </Card>

          <Divider />

          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={handleGoBack}
            color="gray.600"
            _hover={{ bg: 'gray.100' }}
          >
            ← Kembali ke Detail Pesanan
          </Button>

        </VStack>
      </Box>
    </Box>
  );
};

export default JNETrackingPage;
