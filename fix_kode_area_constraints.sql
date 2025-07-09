-- Migration untuk memperbaiki masalah foreign key constraints ke kode_area

-- 1. Aktifkan foreign keys untuk memeriksa constraints
PRAGMA foreign_keys = ON;

-- 2. Simpan data orders ke tabel sementara
CREATE TABLE orders_backup AS SELECT * FROM orders;

-- 3. Hapus tabel orders lama dengan foreign key constraintsnya
DROP TABLE orders;

-- 4. Buat ulang tabel orders tanpa foreign key constraints
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

-- 5. Tambahkan kolom kode_area ke tabel locations (jika belum ada)
ALTER TABLE locations ADD COLUMN kode_area TEXT;

-- 6. Perbarui kolom kode_area dengan nilai yang sama dengan nama_lokasi
UPDATE locations SET kode_area = nama_lokasi WHERE kode_area IS NULL;

-- 7. Kembalikan data dari tabel backup
INSERT INTO orders SELECT * FROM orders_backup;

-- 8. Hapus tabel backup
DROP TABLE orders_backup;

-- 9. Tambahkan indeks untuk performa
CREATE INDEX IF NOT EXISTS idx_orders_lokasi_pengiriman ON orders(lokasi_pengiriman);
CREATE INDEX IF NOT EXISTS idx_orders_lokasi_pengambilan ON orders(lokasi_pengambilan);
