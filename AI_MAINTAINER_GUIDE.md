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

### 9.1) CI/CD (Cloudflare Pages + Workers)

Tujuan: Semua deploy berjalan otomatis dari GitHub. Tidak perlu deploy dari lokal.

- **Frontend (Pages):**
  - Source: `midtrans-frontend/`
  - Build command: `npm ci && npm run build`
  - Output dir: `dist`
  - Project name (contoh): `kurniasari-frontend`
  - Preview deploy untuk PR; Production deploy saat merge ke `main`.
  - Workflow: `.github/workflows/cloudflare-pages.yml` (sudah ada di repo).

- **Backend (Workers):**
  - Source: root Worker sesuai `wrangler.toml`
  - Environment: `production` (bindings: D1, R2, Images, dsb.)
  - Deploy otomatis saat push ke `main` via workflow: `.github/workflows/worker.yml`
  - Manual D1 migration via workflow: `.github/workflows/d1-migrate.yml` (workflow_dispatch)

- **GitHub Secrets yang diperlukan:**
  - `CLOUDFLARE_API_TOKEN` (scopes: Account:Read, Workers Scripts:Edit, Pages:Edit)
  - `CLOUDFLARE_ACCOUNT_ID`

- **Trigger & Alur:**
  - Push ke `main` →
    - Pages build & deploy frontend (Production)
    - Workers deploy backend (Production) dengan `wrangler deploy --env production`
  - Pull Request →
    - Pages build & deploy Preview (URL unik per PR)
    - (Opsional) Tambahkan workflow deploy staging Worker jika diperlukan

- **Manual D1 Migration:**
  - Buka GitHub Actions → jalankan "Run D1 Migrations (Manual)"
  - Input `databaseName` (misal: `order-management-prod`) dan `sqlFile` (misal: `migrations/0015_new_change.sql`)
  - Workflow menjalankan: `wrangler d1 execute <DB> --file <SQL> --remote --env production`

- **Konfigurasi ENV:**
  - Frontend (Pages): set variabel (misal `VITE_API_BASE_URL`) di Project Settings untuk Production & Preview
  - Backend (Workers): gunakan `wrangler secret`/Dashboard untuk JWT, Midtrans, Cloudflare Images, dsb. Jangan commit secrets ke repo

- **Best Practices:**
  - Hanya `main` yang memicu production deploy
  - Gunakan PR + Preview untuk review UI
  - Migrasi D1 dijalankan manual/terkontrol (workflow terpisah), kecuali benar‑benar idempoten
  - Siapkan endpoint `GET /health` sederhana untuk health check
  - Pantau log di Cloudflare (Pages/Workers) setelah deploy

---

### 9.2) PR Workflow yang Direkomendasikan (Single-Branch Production)

- **Buat branch fitur** dari `main`:
  ```bash
  git checkout -b feature/<deskripsi-singkat>
  # commit perubahan
  git push -u origin feature/<deskripsi-singkat>
  ```
- **Buat Pull Request** di GitHub (base: `main`, compare: `feature/...`).
- **Review dengan Pages Preview**: PR akan memicu build Preview untuk frontend; buka URL Preview dari tab Checks/Cloudflare.
- **Cek Worker jika perlu**: Tambahkan workflow staging terpisah jika butuh preview Worker; default-nya hanya deploy ke production saat merge.
- **Merge ke `main`** jika sudah approved → otomatis deploy Pages + Worker ke production.
- **Jalankan migrasi D1 (opsional)**: gunakan workflow "Run D1 Migrations (Manual)" bila ada perubahan skema.

Catatan: aktifkan Branch Protection di `main` untuk mewajibkan checks lulus sebelum merge.

#### 9.2.1) Branch Protection (disarankan)

- **Rules** (GitHub → Settings → Branches → Add rule untuk `main`):
  - Require a pull request before merging
  - Require status checks to pass before merging
    - Pilih checks: Cloudflare Pages build (frontend) dan Worker deploy (worker.yml)
  - Optional: Require approvals (min 1 reviewer)
  - Optional: Dismiss stale approvals on new commits
  - Optional: Restrict who can push to matching branches (hanya admin/CI)

Dengan protection ini, semua perubahan harus melalui PR dan lulus build sebelum bisa di-merge ke production.

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

## 14) Pembaruan Integrasi Pembayaran Midtrans (2025-09-06)

Perubahan ini memastikan pengalaman pembayaran yang mulus, status terbarui tepat waktu, dan tidak ada UI debug yang tersisa di produksi.

- **Frontend — Snap muncul langsung saat order dibuat**
  - File: `midtrans-frontend/src/pages/NewOrderPage.tsx`
  - Menghapus toast sukses lama setelah pembuatan order.
  - Memanggil `processPayment()` (utils Midtrans) untuk membuka Snap segera.
  - Setelah Snap selesai/ditutup: memanggil `refreshOrderStatus(orderId)` dengan retry 2× (interval 1.5s), lalu navigasi ke detail pesanan.

- **Frontend — Auto-refresh status di halaman detail**
  - File: `midtrans-frontend/src/pages/OrderDetailPage.tsx`
  - Pada mount: `refreshOrderStatus(id)` sekali, lalu `fetchOrderDetails()` agar badge pembayaran segera berubah ke Lunas bila sudah settle.
  - Menambahkan toast singkat “Menyinkronkan status pembayaran…” → “Status pembayaran terbarui”.

- **Frontend — Halaman publik: tombol pembayaran saat belum lunas**
  - File: `midtrans-frontend/src/pages/PublicOrderDetailPage.tsx`
  - Menampilkan tombol "Bayar Sekarang" jika `!isPaid && paymentUrl`.
  - Menghapus semua blok/section Debug link pembayaran.

- **Frontend — Menghapus UI Debug**
  - File: `OrderDetailPage.tsx` dan `PublicOrderDetailPage.tsx`.
  - Menghapus box/section bertanda “Link Pembayaran (Debug)”.

- **Backend — Perbaikan endpoint refresh-status**
  - File: `src/handlers/orders.js`
  - Fungsi: `updateOrderStatusFromMidtrans()` dan `export async function refreshOrderStatus()`.
  - Perubahan:
    - Gunakan `btoa(`${serverKey}:`)` alih-alih `Buffer.from(...).toString('base64')` agar kompatibel dengan Cloudflare Workers.
    - Tambahkan fallback environment (prod/sandbox) jika request status Midtrans gagal di env saat ini.
  - Route sudah terdaftar: `POST /api/orders/:id/refresh-status` di `src/worker.js`.

- **Deployment & Cache Notes**
  - Untuk memaksa Pages rebuild: sentuh/ubah `midtrans-frontend/.deploy-trigger` lalu commit.
  - Jika UI lama masih muncul: lakukan hard refresh (Cmd+Shift+R) atau tambahkan query `?v=<timestamp>`; bila perlu purge cache Cloudflare.

- **Env yang perlu ada**
  - Frontend: `VITE_MIDTRANS_CLIENT_KEY`, `VITE_API_BASE_URL` (mengarah ke Worker prod).
  - Backend (Workers): `MIDTRANS_SERVER_KEY`, `MIDTRANS_IS_PRODUCTION` (`'true'` untuk produksi), JWT secret, bindings D1/R2/Images.

Checklist verifikasi pasca deploy:
- Buat order baru → Snap muncul langsung tanpa toast sukses lama.
- Selesaikan pembayaran → kembali ke detail, status berubah ke Lunas (tanpa menunggu 60 detik).
- Halaman publik untuk order BELUM BAYAR menampilkan tombol "Bayar Sekarang" dan berfungsi.
 - Tidak ada section "Link Pembayaran (Debug)" yang tampil di UI.

 ---

 ### 14.1) Troubleshooting Cepat Midtrans
 
 - Popup Snap tidak muncul setelah membuat order
   - Pastikan `processPayment()` dipanggil di `midtrans-frontend/src/pages/NewOrderPage.tsx` segera setelah create order.
   - Cek `VITE_MIDTRANS_CLIENT_KEY` di Cloudflare Pages Project Settings.
   - Periksa Network: request ke `https://app.midtrans.com/snap/v1/transactions` sukses dan mengembalikan `token`.
 
 - Status pembayaran tidak berubah ke Lunas setelah selesai bayar
   - Tes endpoint backend: `POST /api/orders/:id/refresh-status`.
   - Validasi di `src/handlers/orders.js` → `updateOrderStatusFromMidtrans()` memakai `btoa` (bukan `Buffer`) dan fallback env prod/sandbox.
   - Cek kolom `payment_response` dan fungsi `derivePaymentStatusFromData()`.
 
 - Halaman publik tidak menampilkan tombol Bayar
   - `midtrans-frontend/src/pages/PublicOrderDetailPage.tsx` menampilkan tombol jika `!isPaid && paymentUrl`.
   - Jika `paymentUrl` kosong: FE mencoba `payment_url`, `payment_link`, `payment_response.redirect_url`, atau redirection dari `snap_token`.
 
 - CORS/Origin warning saat membuka link Midtrans
   - Normal karena redirection ke domain Midtrans; selama `redirect_url` valid, alur pembayaran aman.
   - Pastikan payload Snap menyertakan `callbacks.finish` ke domain frontend publik yang benar.
 
 ### 14.2) Cuplikan Kode Penting
 
 - Backend: Auth header Midtrans kompatibel Workers (`src/handlers/orders.js`)
 
   ```js
   const authHeader = `Basic ${btoa(`${serverKey}:`)}`;
   ```
 
 - Backend: Fallback env untuk status Midtrans (`src/handlers/orders.js`)
 
   ```js
   const makeStatusUrl = (prod) => prod
     ? `https://api.midtrans.com/v2/${orderId}/status`
     : `https://api.sandbox.midtrans.com/v2/${orderId}/status`;
 
   const firstUrl = makeStatusUrl(isProduction);
   const secondUrl = makeStatusUrl(!isProduction);
   const resp1 = await fetch(firstUrl, { headers: { Accept: 'application/json', Authorization: authHeader } });
   let data1 = await resp1.json().catch(() => ({}));
   const { resp, statusData } = resp1.ok
     ? { resp: resp1, statusData: data1 }
     : (() => ({
         resp: await fetch(secondUrl, { headers: { Accept: 'application/json', Authorization: authHeader } }),
         statusData: await (await fetch(secondUrl, { headers: { Accept: 'application/json', Authorization: authHeader } })).json().catch(() => ({}))
       }))();
   ```
 
 - Frontend: Buka Snap segera setelah create order (`midtrans-frontend/src/pages/NewOrderPage.tsx`)
 
   ```ts
   const result = await processPayment(orderResponse, async () => {
     await refreshOrderStatusWithRetry(orderId, 2, 1500);
     navigate(`/orders/${orderId}`);
   });
   ```
 
 - Frontend: Tombol bayar di halaman publik (`midtrans-frontend/src/pages/PublicOrderDetailPage.tsx`)
 
   ```tsx
   {!isPaid && paymentUrl && (
     <Button as="a" href={paymentUrl} target="_blank" rel="noopener noreferrer" colorScheme="teal">
       Bayar Sekarang
     </Button>
   )}
   ```
 
 ## 15) Referensi
- `APP_DOCUMENTATION_COMPREHENSIVE.md` → deskripsi lengkap sistem.
- `MIDTRANS_GUIDE.md`, `MIDTRANS_PRODUCTION_SETUP.md` → integrasi pembayaran.
- `DEVELOPMENT_SETUP.md`, `DEPLOYMENT_GUIDE.md` → setup & deploy.
- `REAL_TIME_SYNC_TEST_GUIDE.md`, `docs/REAL_TIME_SYNC.md` → sinkronisasi.

Terakhir diperbarui: 2025-09-06
