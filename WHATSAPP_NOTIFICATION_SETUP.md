# WhatsApp Notification Setup Guide

## 📱 Fitur WhatsApp Notification untuk Outlet

Sistem ini secara otomatis mengirim notifikasi WhatsApp ke outlet ketika ada pesanan baru masuk ke dashboard mereka.

## 🎯 Cara Kerja

1. **Order Creation**: Ketika admin atau customer membuat pesanan baru
2. **Outlet Assignment**: Sistem mendeteksi outlet yang dituju berdasarkan lokasi pengiriman
3. **Phone Number Lookup**: Sistem mengambil nomor WhatsApp outlet dari database
4. **Send Notification**: Notifikasi WhatsApp dikirim secara asynchronous (non-blocking)
5. **Dashboard Update**: Pesanan muncul di dashboard outlet

## 📋 Format Notifikasi

Notifikasi WhatsApp yang dikirim berisi:
- 📦 Order ID
- 🏪 Nama Outlet
- 👤 Informasi Pelanggan (Nama, Telepon)
- 📍 Detail Pengiriman (Tipe, Area, Lokasi)
- 🛒 Daftar Produk dengan harga
- 💰 Total Pembayaran
- ⏰ Waktu Pesanan

## 🔧 Konfigurasi WhatsApp API

### Environment Variables Required

Tambahkan ke Cloudflare Workers secrets:

```bash
# WhatsApp API Configuration
WHATSAPP_API_URL=https://your-whatsapp-api-endpoint.com/send
WHATSAPP_API_TOKEN=your_api_token_here
```

### Cara Set Environment Variables

#### Via Wrangler CLI:
```bash
cd /path/to/midtrans-kurniasari
wrangler secret put WHATSAPP_API_URL
wrangler secret put WHATSAPP_API_TOKEN
```

#### Via Cloudflare Dashboard:
1. Login ke Cloudflare Dashboard
2. Pilih Workers & Pages
3. Pilih worker: `order-management-app-production`
4. Masuk ke Settings → Variables
5. Tambahkan Environment Variables:
   - `WHATSAPP_API_URL`
   - `WHATSAPP_API_TOKEN`

## 📞 Setup Nomor WhatsApp Outlet

Nomor WhatsApp outlet disimpan di database `outlets_unified` table.

### Update Nomor WhatsApp via SQL:

```sql
-- Update nomor WhatsApp untuk outlet tertentu
UPDATE outlets_unified 
SET phone = '628123456789'  -- Format: 628xxx (tanpa +, tanpa -)
WHERE id = 'outlet_bonbin';

-- Update semua outlet sekaligus
UPDATE outlets_unified SET phone = '628123456789' WHERE id = 'outlet_bonbin';
UPDATE outlets_unified SET phone = '628234567890' WHERE id = 'outlet_monjali';
UPDATE outlets_unified SET phone = '628345678901' WHERE id = 'outlet_glagahsari';
```

### Format Nomor Telepon:
- ✅ Benar: `628123456789` (62 + nomor tanpa 0 di depan)
- ❌ Salah: `+628123456789` (jangan pakai +)
- ❌ Salah: `08123456789` (jangan pakai 0 di depan)
- ❌ Salah: `62-812-3456-789` (jangan pakai tanda -)

## 🔌 WhatsApp API Provider Options

Anda bisa menggunakan salah satu provider berikut:

### 1. Fonnte (Recommended)
- Website: https://fonnte.com
- Mudah setup, support Indonesia
- Harga terjangkau

**API Format:**
```javascript
WHATSAPP_API_URL=https://api.fonnte.com/send
WHATSAPP_API_TOKEN=your_fonnte_token

// Request body format:
{
  "target": "628123456789",
  "message": "Your message here",
  "countryCode": "62"
}
```

### 2. Wablas
- Website: https://wablas.com
- Provider lokal Indonesia

**API Format:**
```javascript
WHATSAPP_API_URL=https://console.wablas.com/api/send-message
WHATSAPP_API_TOKEN=your_wablas_token

// Request body format:
{
  "phone": "628123456789",
  "message": "Your message here"
}
```

### 3. WhatsApp Business API (Official)
- Untuk enterprise/bisnis besar
- Memerlukan verifikasi Facebook Business

## 🧪 Testing

### Test Tanpa WhatsApp API (Development):
Jika `WHATSAPP_API_URL` dan `WHATSAPP_API_TOKEN` tidak diset, sistem akan:
- ✅ Tetap membuat order dengan sukses
- ⚠️ Skip pengiriman WhatsApp
- 📝 Log message yang akan dikirim ke console

### Test Dengan WhatsApp API:
1. Set environment variables
2. Buat order baru via admin dashboard
3. Check console logs untuk status pengiriman
4. Verifikasi WhatsApp diterima di nomor outlet

## 📊 Monitoring

### Console Logs:
```
📱 Attempting to send WhatsApp notification to outlet: outlet_bonbin
✅ WhatsApp notification sent successfully to outlet: outlet_bonbin
```

### Error Logs:
```
⚠️ No phone number found for outlet: outlet_bonbin
⚠️ WhatsApp API not configured. Skipping notification.
❌ WhatsApp API error: Invalid token
```

## 🔒 Security Notes

1. **API Token**: Simpan sebagai secret, jangan commit ke git
2. **Phone Numbers**: Validasi format sebelum disimpan
3. **Rate Limiting**: WhatsApp API biasanya punya rate limit, pastikan tidak spam
4. **Non-Blocking**: Notifikasi dikirim async, tidak akan block order creation

## 🚀 Deployment Checklist

- [ ] Set `WHATSAPP_API_URL` di Cloudflare Workers
- [ ] Set `WHATSAPP_API_TOKEN` di Cloudflare Workers
- [ ] Update nomor WhatsApp di `outlets_unified` table
- [ ] Deploy backend code ke production
- [ ] Test dengan membuat order baru
- [ ] Verifikasi notifikasi diterima di WhatsApp outlet

## 📝 Customization

### Mengubah Format Message:

Edit file: `/src/handlers/whatsapp-notification.js`

Function: `formatOrderNotificationMessage(orderData)`

```javascript
function formatOrderNotificationMessage(orderData) {
  // Customize message format here
  const message = `
🔔 *PESANAN BARU MASUK*
... your custom format ...
  `.trim();
  
  return message;
}
```

## 🆘 Troubleshooting

### Notifikasi tidak terkirim?
1. Check console logs untuk error message
2. Verifikasi environment variables sudah diset
3. Pastikan nomor WhatsApp outlet sudah diisi di database
4. Test API endpoint dengan Postman/curl
5. Check quota/balance WhatsApp API provider

### Nomor tidak valid?
- Pastikan format: `628xxx` (62 + nomor tanpa 0)
- Cek di database: `SELECT id, name, phone FROM outlets_unified;`
- Update jika perlu: `UPDATE outlets_unified SET phone = '628xxx' WHERE id = 'outlet_id';`

## 📞 Support

Jika ada masalah dengan WhatsApp notification:
1. Check logs di Cloudflare Workers dashboard
2. Verifikasi konfigurasi WhatsApp API provider
3. Test manual via API provider dashboard
