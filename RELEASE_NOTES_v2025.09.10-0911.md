# Release Notes — v2025.09.10-0911

Tanggal Rilis: 2025-09-10 09:11 (+07)

## Ringkasan
Rilis ini memfinalisasi integrasi Midtrans Snap dengan pengalaman bayar yang mulus, sinkronisasi status pasca pembayaran yang andal, serta pembersihan UI dan dokumentasi.

## Perubahan Utama
- Snap muncul langsung setelah order dibuat (tanpa toast sukses lama)
  - File: `midtrans-frontend/src/pages/NewOrderPage.tsx`
  - Memanggil `processPayment()` segera setelah create order, lalu refresh-status dengan retry dan navigasi ke detail.
- Auto-refresh status di halaman detail
  - File: `midtrans-frontend/src/pages/OrderDetailPage.tsx`
  - Memanggil `refreshOrderStatus` sekali saat mount, kemudian fetch ulang detail; tambah toast feedback.
- Halaman publik: tombol "Bayar Sekarang" saat belum lunas
  - File: `midtrans-frontend/src/pages/PublicOrderDetailPage.tsx`
  - Menampilkan tombol ke `paymentUrl` bila `!isPaid`.
- Menghapus semua blok Debug "Link Pembayaran"
  - File: `OrderDetailPage.tsx`, `PublicOrderDetailPage.tsx`
- Backend refresh-status diperbaiki
  - File: `src/handlers/orders.js`
  - `updateOrderStatusFromMidtrans()` memakai `btoa` (kompatibel Workers) dan fallback env prod/sandbox.
  - Route: `POST /api/orders/:id/refresh-status` terdaftar di `src/worker.js`.
- Dokumentasi ditingkatkan
  - File: `AI_MAINTAINER_GUIDE.md`
  - Tambah: Pembaruan Midtrans, Troubleshooting cepat, Cuplikan kode penting, Diagram arsitektur (teks), First-time maintainer checklist.

## Dampak Bisnis
- Mengurangi friction pembayaran (Snap langsung) dan menghindari status "pending" yang berlarut-larut.
- Memberi tombol lanjutan pembayaran di halaman publik untuk pelanggan yang belum menyelesaikan transaksi.
- Memudahkan tim operasional menelusuri dan memelihara sistem melalui dokumentasi yang lebih lengkap.

## Cara Verifikasi Pasca Deploy
1. Buat order baru → Snap muncul langsung.
2. Selesaikan pembayaran → detail pesanan menampilkan status "LUNAS" sesaat setelah kembali.
3. Buka halaman publik untuk order yang belum lunas → tombol "Bayar Sekarang" muncul dan berfungsi.
4. Pastikan tidak ada section "Link Pembayaran (Debug)" di UI.

## Catatan Teknis
- Pastikan ENV:
  - Frontend: `VITE_API_BASE_URL`, `VITE_MIDTRANS_CLIENT_KEY`
  - Backend: `MIDTRANS_SERVER_KEY`, `MIDTRANS_IS_PRODUCTION`, JWT secret, D1/R2/Images bindings
- Jika cache Pages menahan bundle lama, lakukan hard refresh atau purge cache.

## Komit Penting (ringkas)
- Backend: perbaikan `refresh-status` (btoa + env fallback)
- Frontend: NewOrderPage (auto-Snap), OrderDetailPage (auto-refresh), PublicOrderDetailPage (Bayar Sekarang), hapus UI debug
- Docs: AI_MAINTAINER_GUIDE diperbarui menyeluruh

