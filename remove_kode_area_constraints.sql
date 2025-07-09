-- Migration untuk menghapus foreign key constraints ke kode_area
-- dan menyederhanakan struktur database

-- 1. Simpan data orders ke tabel sementara
CREATE TABLE orders_backup AS SELECT * FROM orders;

-- 2. Hapus tabel orders lama dengan foreign key constraintsnya
DROP TABLE orders;

-- 3. Buat ulang tabel orders tanpa foreign key constraints
CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    total_amount INTEGER NOT NULL,
    payment_status TEXT DEFAULT 'pending',
    payment_link TEXT,
    snap_token TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    tracking_number TEXT,
    courier_service TEXT,
    lokasi_pengiriman TEXT,
    lokasi_pengambilan TEXT,
    tipe_pesanan TEXT,
    pickup_method TEXT,
    shipping_status TEXT,
    payment_response TEXT,
    admin_note TEXT,
    metode_pengiriman TEXT,
    customer_address TEXT
);

-- 4. Kembalikan data dari tabel backup
INSERT INTO orders SELECT * FROM orders_backup;

-- 5. Hapus tabel backup
DROP TABLE orders_backup;

-- 6. Tambahkan indeks untuk performa
CREATE INDEX IF NOT EXISTS idx_orders_lokasi_pengiriman ON orders(lokasi_pengiriman);
CREATE INDEX IF NOT EXISTS idx_orders_lokasi_pengambilan ON orders(lokasi_pengambilan);

-- 7. Verifikasi constraints baru sudah dihapus
PRAGMA foreign_key_list(orders);
