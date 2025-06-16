# Kurniasari Order Management Frontend

Frontend aplikasi untuk sistem manajemen pemesanan dengan integrasi pembayaran Midtrans. Aplikasi ini dibangun menggunakan React dan Vite, serta terintegrasi dengan backend Cloudflare Worker.

## Fitur Utama

- Dashboard status sistem
- Manajemen pesanan (lihat, buat, detail)
- Integrasi pembayaran dengan Midtrans
- Pelacakan status transaksi

## Persyaratan Sistem

- Node.js 18.0.0 atau lebih baru
- npm 7.0.0 atau lebih baru

## Instalasi & Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd midtrans-frontend
```

### 2. Instalasi Dependensi

```bash
npm install
```

### 3. Konfigurasi Environment

Salin file `.env.example` ke `.env.local` dan sesuaikan konfigurasi:

```bash
cp .env.example .env.local
```

Edit file `.env.local` dan tambahkan konfigurasi berikut:
- `VITE_API_URL`: URL API backend Cloudflare Worker
- `VITE_MIDTRANS_CLIENT_KEY`: Client key dari Midtrans
- `VITE_MIDTRANS_IS_PRODUCTION`: `true` untuk production, `false` untuk sandbox

### 4. Development Server

```bash
npm run dev
```

Aplikasi akan berjalan di `http://localhost:5173`

## Build & Deployment

### Build untuk Production

```bash
npm run build
```

File hasil build akan berada di direktori `dist/`.

### Deploy ke Cloudflare Pages

1. Buat project baru di Cloudflare Pages
2. Hubungkan dengan repository Git
3. Konfigurasi build:
   - Framework preset: Vite
   - Build command: `npm run build`
   - Output directory: `dist`
4. Tambahkan environment variables yang diperlukan

## Integrasi dengan Backend

Aplikasi ini berkomunikasi dengan backend Cloudflare Worker melalui API endpoints berikut:

- `GET /api/config` - Informasi konfigurasi aplikasi
- `GET /api/orders` - Daftar pesanan
- `POST /api/orders` - Buat pesanan baru
- `GET /api/orders/:id` - Detail pesanan
- `GET /api/transaction/:id/status` - Status transaksi
