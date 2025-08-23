# KURNIASARI ORDER MANAGEMENT SYSTEM — AI MAINTAINER GUIDE

Dokumen ini dirancang agar AI/engineer baru dapat memahami cara kerja aplikasi secara cepat, aman, dan bisa melakukan pengembangan lanjutan tanpa merusak sistem produksi.

Gunakan dokumen ini berdampingan dengan: `APP_DOCUMENTATION_COMPREHENSIVE.md` (referensi lengkap) dan `DEPLOYMENT_GUIDE.md` (langkah deploy).

---

## 1) Ringkasan Eksekutif
- Runtime: Cloudflare Workers (Serverless)
- DB: Cloudflare D1 (SQLite)
- Storage: Cloudflare R2 + Cloudflare Images
- Frontend: React + TypeScript (Vite)
- Autentikasi: JWT (token disimpan di `sessionStorage`)
- Arsitektur data: menggunakan tabel terpadu `outlets_unified` untuk semua outlet. Semua struktur legacy (locations, locations_view) SUDAH DIHAPUS dan TIDAK BOLEH dihidupkan kembali.

Status Produksi:
- Worker prod: `order-management-app-production` → `https://order-management-app-production.wahwooh.workers.dev`
- D1 prod: `order-management-prod`
- Migrasi legacy drop sudah dijalankan: `migrations/0014_drop_legacy_locations.sql`

---

## 2) Peta Kode (Code Map)
- Backend root: `src/`
  - `worker.js`: Router utama itty-router, mendaftarkan semua endpoint.
  - `handlers/`: business logic per domain.
    - `orders.js`: CRUD dan status pesanan, sinkronisasi dashboard.
    - `assignment-options.js`: opsi outlet & deliveryman untuk dropdown admin.
    - `admin.js`, `admin-activity.js`: utilitas admin dan logging.
    - `migrate-relational-db.js`: migrasi relational (TIDAK lagi membuat `locations_view`).
    - `migrate-safe-db.js`: versi migrasi aman (drop-create) + `getSafeMigrationStatus()`.
    - `cloudflare-images.js`: upload/get foto.
    - `auth.js`, `middleware.js`: login, verifikasi token.
  - `utils/`: helper dan konstanta.
- Frontend root: `midtrans-frontend/`
  - `src/api/adminApi.ts`: API Admin (termasuk `getUnifiedOutlets` → `/api/admin/outlets` dengan fallback ke `/api/outlets`).
  - `src/pages/admin/AdminOrdersPage.tsx`: dashboard admin.
  - `src/pages/admin/AdminOrderDetailPage.tsx`: detail pesanan + dropdown Outlet & Kurir Toko.
  - `src/hooks/useRealTimeSync.ts`: polling default 60 detik (optimasi kuota).

Catatan penting:
- File legacy `src/handlers/locations.js` SUDAH DIHAPUS. Endpoint `/api/locations` tidak ada.

---

## 3) Skema Database (Aktual)
Tabel kunci:
- `outlets_unified`: sumber kebenaran outlet. Kolom: `id, name, location_alias, address, status, manager_username, ...`
- `orders`: menyimpan pesanan, kolom penting: `outlet_id`, `assigned_deliveryman_id`, `shipping_area`, `lokasi_pengiriman`, `lokasi_pengambilan`, status-status, dsb.
- `users`: memiliki `role` (`admin`, `outlet_manager`, `deliveryman`) dan `outlet_id` (nullable untuk admin).
- `shipping_images`: metadata foto pengiriman.
- `order_update_logs`, `notifications`.

Legacy yang sudah DILENYAPKAN:
- Tabel `locations`
- View `locations_view`

Lihat folder `migrations/` untuk skrip. Terakhir: `0014_drop_legacy_locations.sql` menghapus legacy secara idempoten.

---

## 4) Endpoints Kunci (Backend)
- Outlets (Admin): `GET /api/admin/outlets` → baca aktif outlets dari `outlets_unified`.
- Assignment options: `GET /api/assignment-options` → opsi outlet + deliveryman.
- Orders: `GET/POST/PUT /api/orders`, `GET /api/orders/:id`, `PUT /api/orders/:id/status`, dll.
- Shipping images: `POST /api/orders/:id/shipping-images`, `GET /api/orders/:id/shipping-images`.
- Helper (publik, baca-only): `GET /api/test-shipping-photos/:orderId` → endpoint pembacaan foto yang stabil dan bypass konflik auth; dipakai FE publik & admin untuk menampilkan 3 slot foto.
- Auth: `POST /api/auth/login`, `GET /api/auth/profile`.
- Migrasi aman:
  - `POST /api/admin/migrate-safe-db` → `migrateSafeRelationalDB()` (drop/create terkendali, idempoten).
  - `GET  /api/admin/safe-db-status` → `getSafeMigrationStatus()` (statistik cepat).

Anti-legacy rule:
- Jangan buat atau panggil `/api/locations`.
- Jangan buat `locations_view` dari migrasi apapun.

---

## 5) Alur Data Utama
- Admin membuka detail pesanan (`AdminOrderDetailPage.tsx`).
  - Memuat `assignment-options` (outlet aktif + deliveryman).
  - Dropdown Outlet + Kurir Toko. Mapping kurir ke `assigned_deliveryman_id`.
  - Simpan: `PUT /api/orders/:id` menyertakan `outlet_id` dan `assigned_deliveryman_id`.
- Dashboard Outlet/Delivery menampilkan pesanan menggunakan filter `outlet_id`/assignment.
- Polling real-time 60 detik untuk semua dashboard guna hemat kuota.

---

## 6) Praktik Terbaik & Konvensi
- SQL di D1: gunakan parameter binding (hindari SQL injection).
- Status/enum: konsisten dengan nilai yang digunakan di FE dan BE.
- Autentikasi: JWT di header `Authorization: Bearer <token>`.
- Penyimpanan token: `sessionStorage` untuk isolasi per-tab.
- Gaya kode: TypeScript di FE; Node.js compatibility di Worker (`nodejs_compat`).

---

## 7) Migrations & Maintenance
- Tambah migrasi baru: letakkan di `migrations/NNNN_description.sql`.
- Menjalankan migrasi di PROD:
  ```bash
  npx wrangler d1 execute order-management-prod --file "migrations/<file>.sql" --remote
  ```
- Migrasi aman (programatik): gunakan `migrateSafeRelationalDB()` jika perlu rekonstruksi idempoten.
- Jangan pernah menambahkan kembali pembuatan `locations_view` atau akses `locations`.

Playbook umum:
- Reset admin password: lihat `reset-admin-password.js`.
- Hash existing passwords: `hash-existing-passwords.js`.
- Debug sinkronisasi pengiriman: `src/handlers/debug-delivery.js` (jika ada).

---

## 8) Frontend Detail
- Sumber API: `midtrans-frontend/src/api/adminApi.ts`.
  - `getUnifiedOutlets()` memukul `GET /api/admin/outlets`; fallback ke `/api/outlets` jika 404.
- Halaman penting:
  - `AdminOrdersPage.tsx`: daftar orders admin, polling 60s.
  - `AdminOrderDetailPage.tsx`: assignment outlet & deliveryman, logika form, dan sinkronisasi foto kiriman.
    - Menampilkan 3 slot foto memakai `ShippingImageDisplay` (`midtrans-frontend/src/components/ShippingImageDisplay.tsx`).
    - Membaca foto via `GET /api/test-shipping-photos/:orderId` agar konsisten dengan halaman publik/outlet.
    - Pastikan `VITE_API_BASE_URL` mengarah ke origin Worker prod agar fetch berhasil.
- TypeScript Migration: seluruh halaman utama sudah dimigrasikan (lihat memori commit — tidak perlu revert ke `.jsx`).

---

## 9) Deployment
- Konfigurasi: `wrangler.toml`
  - Dev name: `order-management-app-dev`
  - Prod name: `order-management-app-production`
  - D1 prod: `order-management-prod` (binding `DB`)
- Deploy prod:
  ```bash
  npx wrangler deploy --env production
  ```
- Frontend (Cloudflare Pages): build vite dan deploy sesuai pipeline yang ada (lihat `.github/workflows/cloudflare-pages.yml` jika relevan).

---

## 10) Kinerja & Kuota
- Polling default: 60 detik di semua dashboard (hemat kuota Workers).
- Index DB: telah dibuat pada kolom lookup utama (`outlet_id`, dll.).
- Perhatikan biaya Cloudflare Images (gunakan varian/kompresi jika perlu).

---

## 11) Keamanan
- Jangan commit secrets (JWT secret, Midtrans keys, Images token). Gunakan `wrangler secret` atau env vars.
- Validasi input di backend handlers.
- Foto: validasi tipe & ukuran file sebelum upload.

---

## 12) Checklist Pengembangan Aman
- [ ] Cari referensi ke legacy (`/api/locations`, `locations_view`) sebelum merge → harus 0.
- [ ] Tambah migrasi → bersifat idempoten dan reversible.
- [ ] Endpoint baru → dilindungi `verifyToken` bila sensitif.
- [ ] Uji smoke: Admin dashboard, Detail Pesanan (assign outlet/kurir), Outlet dashboard, Delivery dashboard.
- [ ] Cek analitik/log error pasca deploy.

---

## 13) FAQ (Cepat)
- Q: Mengapa tidak ada `/api/locations`?  
  A: Sudah dihapus. Gunakan `outlets_unified` dan `/api/admin/outlets`.
- Q: Bagaimana cek status migrasi aman?  
  A: `GET /api/admin/safe-db-status` → ringkasan tabel & statistik linkages.
- Q: Bagaimana menambah outlet baru?  
  A: Insert ke `outlets_unified` (pastikan `status='active'` agar muncul di dropdown admin).
- Q: Foto outlet tidak muncul di halaman admin?  
  A: Periksa `GET /api/test-shipping-photos/:orderId` mengembalikan `ready_for_pickup/picked_up/delivered.url`. Pastikan `VITE_API_BASE_URL` benar dan lakukan hard refresh untuk menghindari cache.

---

## 14) Referensi
- `APP_DOCUMENTATION_COMPREHENSIVE.md` → deskripsi lengkap sistem.
- `MIDTRANS_GUIDE.md`, `MIDTRANS_PRODUCTION_SETUP.md` → integrasi pembayaran.
- `DEVELOPMENT_SETUP.md`, `DEPLOYMENT_GUIDE.md` → setup & deploy.
- `REAL_TIME_SYNC_TEST_GUIDE.md`, `docs/REAL_TIME_SYNC.md` → sinkronisasi.

Terakhir diperbarui: 2025-08-24
