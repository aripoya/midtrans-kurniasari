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
import { FaCopy, FaExternalLinkAlt, FaCheck } from 'react-icons/fa';
import { useSearchParams, useNavigate } from 'react-router-dom';

const TIKITrackingPage: React.FC = () => {
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
          title: 'Nomor Resi Siap!',
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

  const handleOpenTIKITracking = () => {
    setIsOpening(true);
    
    // Copy resi to clipboard again before opening
    navigator.clipboard.writeText(resiNumber).catch(() => {});
    
    // Open TIKI tracking page
    window.open('https://www.tiki.id/id/track', '_blank');
    
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
          
          {/* Header */}
          <Box textAlign="center">
            <Heading size="lg" color="blue.600" mb={2}>
              TIKI Tracking
            </Heading>
            <Text color="gray.600">
              Lacak paket Anda dengan mudah
            </Text>
          </Box>

          {/* Resi Display Card */}
          <Card>
            <CardBody>
              <VStack spacing={4} align="stretch">
                <Box textAlign="center">
                  <Text fontSize="sm" color="gray.600" mb={2}>
                    Nomor Resi:
                  </Text>
                  <Code 
                    fontSize="xl" 
                    fontWeight="bold" 
                    p={3} 
                    borderRadius="md"
                    colorScheme="blue"
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
                <AlertTitle>Siap untuk tracking!</AlertTitle>
                <AlertDescription>
                  Nomor resi telah disalin ke clipboard Anda
                </AlertDescription>
              </Box>
            </Alert>
          )}

          {/* Main Action Button */}
          <Button
            leftIcon={isOpening ? <Spinner size="sm" /> : <Icon as={FaExternalLinkAlt} />}
            colorScheme="blue"
            size="lg"
            onClick={handleOpenTIKITracking}
            isLoading={isOpening}
            loadingText="Membuka TIKI..."
          >
            Buka TIKI Tracking
          </Button>

          {/* Instructions */}
          <Card>
            <CardBody>
              <VStack spacing={3} align="start">
                <Heading size="sm" color="blue.600">
                  Panduan:
                </Heading>
                <VStack spacing={2} align="start" fontSize="sm" color="gray.700">
                  <Text>
                    <Badge colorScheme="blue" mr={2}>1</Badge>
                    Klik "Buka TIKI Tracking" untuk membuka halaman TIKI
                  </Text>
                  <Text>
                    <Badge colorScheme="blue" mr={2}>2</Badge>
                    Paste nomor resi yang sudah disalin ke kolom pencarian
                  </Text>
                  <Text>
                    <Badge colorScheme="blue" mr={2}>3</Badge>
                    Klik "Lacak Resi" untuk melihat status pesanan
                  </Text>
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
          >
            ← Kembali ke Detail Pesanan
          </Button>

        </VStack>
      </Box>
    </Box>
  );
};

export default TIKITrackingPage;
