import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button, VStack } from '@chakra-ui/react';
import { DownloadIcon } from '@chakra-ui/icons';

interface QRCodeGeneratorProps {
  value: string;
  size?: number;
  bgColor?: string;
  fgColor?: string;
  includeMargin?: boolean;
  showDownload?: boolean;
  downloadFilename?: string;
}

const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({
  value,
  size = 128,
  bgColor = '#ffffff',
  fgColor = '#000000',
  includeMargin = false,
  showDownload = false,
  downloadFilename = 'qrcode',
}) => {
  const qrRef = useRef<HTMLDivElement>(null);

  const downloadQRCode = async () => {
    try {
      if (!qrRef.current) return;

      const svg = qrRef.current.querySelector('svg');
      if (!svg) return;

      // Create canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size with padding
      const padding = 40;
      canvas.width = size + padding * 2;
      canvas.height = size + padding * 2;

      // Fill white background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Convert SVG to image
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        // Draw QR code centered with padding
        ctx.drawImage(img, padding, padding, size, size);

        // Convert to PNG and download
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${downloadFilename}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
        }, 'image/png');

        URL.revokeObjectURL(svgUrl);
      };
      img.src = svgUrl;
    } catch (error) {
      console.error('Error downloading QR code:', error);
    }
  };

  return (
    <VStack spacing={4}>
      <div ref={qrRef}>
        <QRCodeSVG
          value={value}
          size={size}
          bgColor={bgColor}
          fgColor={fgColor}
          includeMargin={includeMargin}
        />
      </div>
      {showDownload && (
        <Button
          leftIcon={<DownloadIcon />}
          colorScheme="teal"
          variant="outline"
          onClick={downloadQRCode}
          size="sm"
        >
          Download QR Code
        </Button>
      )}
    </VStack>
  );
};

export default QRCodeGenerator;
