import React, { useEffect, useState } from 'react';
import { Box, Image, Text, Spinner, useToast } from '@chakra-ui/react';

/**
 * Component to display shipping/order images with consistent styling and error handling
 * 
 * @param {Object} props
 * @param {string} props.imageUrl - URL of the image to display
 * @param {string} props.type - Type of image (e.g., 'readyForPickup', 'pickedUp', 'received')
 * @param {string} props.label - Display label for the image
 * @param {boolean} props.showPlaceholder - Whether to show placeholder when no image
 * @param {string} props.placeholderText - Text to display when no image (default: "Belum ada foto")
 * @param {string} props.maxHeight - Maximum height of the image (default: "200px")
 */
const ShippingImageDisplay = ({ 
  imageUrl, 
  type, 
  label,
  showPlaceholder = true,
  placeholderText = "Belum ada foto",
  maxHeight = "200px"
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [displayUrl, setDisplayUrl] = useState('');
  const toast = useToast();

  useEffect(() => {
    if (imageUrl) {
      // Handle loading placeholder state
      if (imageUrl === 'loading') {
        setDisplayUrl('');
        setLoading(true);
        setError(false);
        console.log(`🖼️ [ShippingImageDisplay] ${type} image is being uploaded...`);
        return;
      }
      
      // Validate URL before processing
      if (typeof imageUrl !== 'string' || 
          (!imageUrl.startsWith('http://') && 
           !imageUrl.startsWith('https://') && 
           !imageUrl.startsWith('data:image/') && 
           !imageUrl.startsWith('blob:'))) {
        console.error(`🖼️ [ShippingImageDisplay] Invalid URL format for ${type}:`, imageUrl);
        setDisplayUrl('');
        setLoading(false);
        setError(true);
        return;
      }
      
      // Clean the URL and add timestamp to prevent caching (only for HTTP URLs)
      let cleanUrl = imageUrl;
      
      if (imageUrl.startsWith('http')) {
        // Remove any existing timestamp
        if (cleanUrl.includes('?')) {
          cleanUrl = cleanUrl.split('?')[0];
        }
        
        // Add new timestamp for HTTP URLs to prevent caching
        const timestamp = Date.now();
        setDisplayUrl(`${cleanUrl}?t=${timestamp}`);
      } else {
        // For data URLs or blob URLs, use as-is
        setDisplayUrl(cleanUrl);
        
        // For blob URLs, retry with timestamp after a delay if it fails to load
        if (imageUrl.startsWith('blob:')) {
          console.log(`🖼️ [ShippingImageDisplay] Retrying ${type} image with timestamp...`);
          setTimeout(() => {
            const timestamp = Date.now();
            setDisplayUrl(`${imageUrl}?t=${timestamp}`);
          }, 1000);
        }
      }
      
      setLoading(true);
      setError(false);
      
      console.log(`🖼️ [ShippingImageDisplay] Processing ${type} image:`, cleanUrl);
    } else {
      setDisplayUrl('');
      setLoading(false);
    }
  }, [imageUrl, type]);

  // If loading state, show spinner
  if (imageUrl === 'loading') {
    return (
      <Box position="relative" mb={3}>
        {label && (
          <Text 
            fontSize="sm" 
            fontWeight="medium" 
            mb={1}
            color="gray.600"
          >
            {label}
          </Text>
        )}
        <Box 
          w="100%" 
          h="150px" 
          border="1px solid" 
          borderColor="gray.200"
          borderRadius="md"
          display="flex"
          alignItems="center"
          justifyContent="center"
          mb={2}
          bg="gray.50"
        >
          <Box textAlign="center">
            <Spinner size="md" color="blue.500" mb={2} />
            <Text fontSize="sm" color="gray.600">Mengunggah foto...</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  // If no image and placeholder is hidden
  if (!imageUrl && !showPlaceholder) {
    return null;
  }

  // If no image but placeholder should be shown
  if (!imageUrl && showPlaceholder) {
    return (
      <Box 
        w="100%" 
        h="150px" 
        border="2px dashed" 
        borderColor="gray.200"
        borderRadius="md"
        display="flex"
        alignItems="center"
        justifyContent="center"
        mb={2}
      >
        <Text color="gray.500">{placeholderText}</Text>
      </Box>
    );
  }

  return (
    <Box position="relative" mb={3}>
      {label && (
        <Text 
          fontSize="sm" 
          fontWeight="medium" 
          mb={1}
          color="gray.600"
        >
          {label}
        </Text>
      )}
      
      <Box 
        position="relative" 
        borderRadius="md"
        overflow="hidden"
        borderWidth={error ? "2px" : "1px"}
        borderColor={error ? "red.300" : "gray.200"}
        backgroundColor="gray.50"
        p={1}
      >
        {loading && (
          <Box 
            position="absolute" 
            top="0" 
            left="0" 
            right="0" 
            bottom="0" 
            display="flex" 
            alignItems="center" 
            justifyContent="center"
            bg="blackAlpha.50"
            zIndex="1"
          >
            <Spinner size="md" color="blue.500" />
          </Box>
        )}
        
        <Image 
          src={displayUrl} 
          alt={`Foto ${label || type}`}
          maxH={maxHeight}
          objectFit="contain"
          w="100%"
          onLoad={() => {
            setLoading(false);
            console.log(`🖼️ [ShippingImageDisplay] Loaded ${type} image successfully`);
          }}
          onError={(e) => {
            // Try to reload with new timestamp if first attempt failed (silently)
            if (!displayUrl.includes('t=')) {
              console.log(`🖼️ [ShippingImageDisplay] Retrying ${type} image with timestamp...`);
              e.target.src = `${displayUrl}?t=${Date.now()}`;
              return; // Don't set error state yet, give retry a chance
            }
            
            // Only show error after retry failed
            console.error(`🖼️ [ShippingImageDisplay] Failed to load ${type} image after retry:`, displayUrl);
            setLoading(false);
            setError(true);
            
            toast({
              title: "Gagal memuat gambar",
              description: `Tidak dapat menampilkan foto ${label || type}`,
              status: "error",
              duration: 3000,
              isClosable: true,
            });
          }}
        />
        
        {error && (
          <Box 
            position="absolute" 
            bottom="0" 
            left="0" 
            right="0" 
            p={1}
            bg="red.100"
            textAlign="center"
          >
            <Text fontSize="xs" color="red.600">
              Gagal memuat gambar
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ShippingImageDisplay;
