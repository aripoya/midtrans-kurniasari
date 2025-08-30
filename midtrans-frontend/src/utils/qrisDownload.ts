// Utility to download a combined QRIS image + order details as PNG using Canvas
// This runs in the browser and should be called from a click handler

export interface QrisOrderInfo {
  orderId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  totalAmount: number;
  items: Array<{ name: string; price: number; quantity: number }>; 
}

export async function downloadQrisPng(order: QrisOrderInfo, qrisImageUrl: string) {
  // Load QR image
  const qrImg = await loadImage(qrisImageUrl);

  // Canvas size
  const width = 900;
  const padding = 32;

  // Dynamic height based on items
  const lineHeight = 28;
  const itemsHeight = Math.max(order.items.length, 1) * lineHeight + 10;
  const headerHeight = 140;
  const qrSize = 360;
  const footerHeight = 90;
  const detailsHeight = 220 + itemsHeight; // customer + items
  const height = padding * 2 + headerHeight + Math.max(qrSize, detailsHeight) + footerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Header bar
  ctx.fillStyle = '#23B26D';
  ctx.fillRect(0, 0, width, headerHeight);

  // Header text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Arial, Helvetica, sans-serif';
  ctx.fillText('QRIS Pembayaran', padding, 60);
  ctx.font = '500 20px Arial, Helvetica, sans-serif';
  ctx.fillText(`Order ID: ${order.orderId}`, padding, 95);

  // QR Image on left
  const qrX = padding;
  const qrY = headerHeight + padding;
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // Details on right
  const detailsX = qrX + qrSize + padding;
  let y = qrY;

  ctx.fillStyle = '#111827';
  ctx.font = 'bold 24px Arial, Helvetica, sans-serif';
  ctx.fillText('Informasi Pelanggan', detailsX, y);
  y += 32;
  ctx.font = '16px Arial, Helvetica, sans-serif';
  drawTextLine(ctx, `Nama: ${order.customerName || '-'}`, detailsX, y, width - detailsX - padding);
  y += 24;
  drawTextLine(ctx, `Telepon: ${order.customerPhone || '-'}`, detailsX, y, width - detailsX - padding);
  y += 24;
  drawTextLine(ctx, `Email: ${order.customerEmail || '-'}`, detailsX, y, width - detailsX - padding);
  y += 24;
  drawMultiline(ctx, `Alamat: ${order.customerAddress || '-'}`, detailsX, y, width - detailsX - padding, 20);
  y += 70;

  ctx.font = 'bold 22px Arial, Helvetica, sans-serif';
  ctx.fillText('Rincian Pesanan', detailsX, y);
  y += 28;
  ctx.font = '16px Arial, Helvetica, sans-serif';
  if (order.items.length === 0) {
    drawTextLine(ctx, '- (kosong) -', detailsX, y, width - detailsX - padding);
    y += 24;
  } else {
    order.items.forEach((it) => {
      const subtotal = it.price * it.quantity;
      drawTextLine(ctx, `${it.name} x${it.quantity} — Rp ${subtotal.toLocaleString('id-ID')}`, detailsX, y, width - detailsX - padding);
      y += 24;
    });
  }

  y += 8;
  ctx.font = 'bold 20px Arial, Helvetica, sans-serif';
  ctx.fillStyle = '#111827';
  drawTextLine(ctx, `Total: Rp ${order.totalAmount.toLocaleString('id-ID')}`, detailsX, y, width - detailsX - padding);

  // Footer
  const footerY = height - footerHeight + 20;
  ctx.fillStyle = '#6B7280';
  ctx.font = '14px Arial, Helvetica, sans-serif';
  drawTextLine(ctx, 'Pindai QRIS ini dengan aplikasi pembayaran Anda sebelum waktu kedaluwarsa.', padding, footerY, width - padding * 2);
  drawTextLine(ctx, 'Bacipia Kurniasari • nota.kurniasari.co.id', padding, footerY + 22, width - padding * 2);

  // Download
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `qris-${order.orderId}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  // Fetch as blob to avoid cross-origin tainting when drawing to canvas
  const res = await fetch(src, { mode: 'cors' }).catch(() => fetch(src));
  if (!res || !res.ok) throw new Error('Failed to fetch QR image');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function drawTextLine(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
  const truncated = truncateText(ctx, text, maxWidth);
  ctx.fillText(truncated, x, y);
}

function drawMultiline(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ');
  let line = '';
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (ctx.measureText(truncated + '…').width > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '…';
}
