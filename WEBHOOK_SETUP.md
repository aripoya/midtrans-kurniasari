# Setup Webhook Midtrans untuk Update Status Pembayaran Otomatis

## Masalah
Virtual Account (VA) tidak update status secepat QRIS karena **webhook Midtrans belum dikonfigurasi** atau **webhook URL salah**.

## Webhook URL yang Benar
```
https://order-management-app-production.wahwooh.workers.dev/api/webhook/midtrans
```

## Cara Setup Webhook di Midtrans Dashboard

### 1. Login ke Midtrans Dashboard
- **Production**: https://dashboard.midtrans.com
- **Sandbox**: https://dashboard.sandbox.midtrans.com

### 2. Konfigurasi Webhook URL

#### Di Production Dashboard:
1. Login ke https://dashboard.midtrans.com
2. Pilih menu **Settings** → **Configuration**
3. Scroll ke bagian **Payment Notification URL**
4. Masukkan URL: 
   ```
   https://order-management-app-production.wahwooh.workers.dev/api/webhook/midtrans
   ```
5. Klik **Update Settings**

#### Di Sandbox Dashboard (untuk testing):
1. Login ke https://dashboard.sandbox.midtrans.com
2. Pilih menu **Settings** → **Configuration**
3. Scroll ke bagian **Payment Notification URL**
4. Masukkan URL yang sama
5. Klik **Update Settings**

### 3. Test Webhook

#### Cara 1: Menggunakan Midtrans Dashboard
1. Buka **Settings** → **Configuration**
2. Scroll ke bagian **HTTP(S) Notification / Webhooks**
3. Klik tombol **"Test"** atau **"Send Test Notification"**
4. Pilih payment method yang ingin ditest (VA, QRIS, dll)

#### Cara 2: Manual Test dengan Order Real
1. Buat order baru
2. Bayar menggunakan Virtual Account atau QRIS
3. Cek logs di Cloudflare Workers untuk melihat webhook notification

## Perbedaan QRIS vs Virtual Account

### QRIS
- **Update speed**: Instant (< 5 detik)
- **Webhook dikirim**: Segera setelah customer scan QR
- **Status**: `settlement`

### Virtual Account
- **Update speed**: Bisa 1-5 menit tergantung bank
- **Webhook dikirim**: Setelah bank konfirmasi pembayaran
- **Status**: `settlement`
- **Catatan**: Beberapa bank lebih lambat dalam mengirim konfirmasi ke Midtrans

## Troubleshooting

### Webhook Tidak Sampai
1. **Cek Webhook URL di Midtrans Dashboard**
   - Pastikan URL benar: `https://order-management-app-production.wahwooh.workers.dev/api/webhook/midtrans`
   - Pastikan tidak ada spasi atau typo

2. **Cek Cloudflare Workers Logs**
   ```bash
   wrangler tail --env production
   ```
   - Jalankan command ini, lalu lakukan pembayaran
   - Lihat apakah ada log `[WEBHOOK] Received webhook notification`

3. **Cek Midtrans Logs**
   - Login ke Midtrans Dashboard
   - Menu **Transactions** → pilih transaksi
   - Scroll ke bawah, lihat **Notification History**
   - Cek apakah webhook berhasil dikirim (status 200) atau gagal (4xx/5xx)

### Signature Verification Failed
Jika ada error `Invalid signature`:
- Pastikan `MIDTRANS_SERVER_KEY` di Cloudflare Workers sesuai dengan yang di dashboard
- Cek di **Settings** → **Access Keys** → **Server Key**

### Order Status Tidak Update
1. Cek apakah webhook sampai (lihat logs)
2. Cek apakah signature valid
3. Cek apakah `order_id` di webhook match dengan order di database
4. Gunakan endpoint manual sync:
   ```
   GET https://order-management-app-production.wahwooh.workers.dev/api/debug/sync-order-payment/{ORDER_ID}
   ```

## Notification Payload Examples

### QRIS Payment
```json
{
  "transaction_time": "2025-11-16 09:30:00",
  "transaction_status": "settlement",
  "transaction_id": "abc123...",
  "status_message": "midtrans payment notification",
  "status_code": "200",
  "signature_key": "...",
  "payment_type": "qris",
  "order_id": "ORDER-1234567890-ABC",
  "merchant_id": "G530664620",
  "gross_amount": "100000.00",
  "fraud_status": "accept",
  "currency": "IDR"
}
```

### Virtual Account Payment
```json
{
  "transaction_time": "2025-11-16 09:30:00",
  "transaction_status": "settlement",
  "transaction_id": "xyz789...",
  "status_message": "midtrans payment notification",
  "status_code": "200",
  "signature_key": "...",
  "payment_type": "bank_transfer",
  "order_id": "ORDER-1234567890-DEF",
  "merchant_id": "G530664620",
  "gross_amount": "100000.00",
  "fraud_status": "accept",
  "currency": "IDR",
  "permata_va_number": "1234567890",
  "va_numbers": [
    {
      "va_number": "1234567890",
      "bank": "permata"
    }
  ]
}
```

## Monitoring Webhook

### Lihat Real-time Logs
```bash
cd /Users/ipoy/Documents/Kurniasari\ web/Kurniasari-Midtrans/midtrans-kurniasari
wrangler tail --env production
```

### Filter Hanya Webhook Logs
```bash
wrangler tail --env production | grep WEBHOOK
```

## Manual Sync Status (Temporary Workaround)

Jika webhook tidak berfungsi, gunakan endpoint manual sync:

```bash
# Untuk specific order
curl https://order-management-app-production.wahwooh.workers.dev/api/debug/sync-order-payment/ORDER-1234567890-ABC
```

Atau dari browser admin panel, tambahkan tombol "Sync Payment Status" di order detail page.

## Kesimpulan

**Root cause** kenapa VA lebih lambat dari QRIS:
1. ❌ **Webhook belum dikonfigurasi** di Midtrans Dashboard (kemungkinan besar ini)
2. ⏱️ **Bank processing time** - VA memang inherently lebih lambat (1-5 menit)
3. 🔧 **Network issues** - webhook dari Midtrans ke Cloudflare Workers terblock

**Solusi**:
1. ✅ Setup webhook URL di Midtrans Dashboard
2. ✅ Monitor logs untuk memastikan webhook sampai
3. ✅ Gunakan manual sync sebagai fallback
