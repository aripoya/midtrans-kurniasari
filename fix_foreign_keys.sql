-- Script untuk memperbaiki masalah foreign key constraints dengan kode_area

-- Langkah 1: Matikan foreign key constraints
PRAGMA foreign_keys = OFF;

-- Langkah 2: Simpan data yang ada
CREATE TABLE orders_backup AS SELECT * FROM orders;
CREATE TABLE order_items_backup AS SELECT * FROM order_items;

-- Langkah 3: Hapus tabel yang bergantung pada orders
DELETE FROM order_items;

-- Langkah 4: Hapus tabel orders lama
DROP TABLE orders;

-- Langkah 5: Buat ulang tabel orders dengan kolom yang sama, tapi tanpa foreign key constraints
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
    pickup_method TEXT
);

-- Langkah 6: Kembalikan data dari backup
INSERT INTO orders SELECT * FROM orders_backup;
INSERT INTO order_items SELECT * FROM order_items_backup;

-- Langkah 7: Hapus tabel backup
DROP TABLE orders_backup;
DROP TABLE order_items_backup;

-- Langkah 8: Tambahkan indeks untuk performa
CREATE INDEX IF NOT EXISTS idx_orders_lokasi_pengiriman ON orders(lokasi_pengiriman);
CREATE INDEX IF NOT EXISTS idx_orders_lokasi_pengambilan ON orders(lokasi_pengambilan);

-- Langkah 9: Nyalakan kembali foreign key constraints
PRAGMA foreign_keys = ON;

-- Langkah 10: Verifikasi tidak ada foreign key constraints yang tersisa
PRAGMA foreign_key_list(orders);
