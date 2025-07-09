-- Langkah 1: Matikan foreign key constraints
PRAGMA foreign_keys = OFF;

-- Langkah 2: Hapus semua data order_items untuk sementara (akan dikembalikan nanti)
CREATE TABLE order_items_backup AS SELECT * FROM order_items;
DELETE FROM order_items;

-- Langkah 3: Simpan data orders ke tabel sementara
CREATE TABLE orders_backup AS SELECT * FROM orders;

-- Langkah 4: Hapus tabel orders lama
DROP TABLE orders;

-- Langkah 5: Buat ulang tabel orders tanpa foreign key constraints
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

-- Langkah 6: Kembalikan data dari tabel backup
INSERT INTO orders SELECT * FROM orders_backup;

-- Langkah 7: Kembalikan data order_items
INSERT INTO order_items SELECT * FROM order_items_backup;

-- Langkah 8: Hapus tabel backup
DROP TABLE orders_backup;
DROP TABLE order_items_backup;

-- Langkah 9: Tambahkan indeks untuk performa
CREATE INDEX IF NOT EXISTS idx_orders_lokasi_pengiriman ON orders(lokasi_pengiriman);
CREATE INDEX IF NOT EXISTS idx_orders_lokasi_pengambilan ON orders(lokasi_pengambilan);

-- Langkah 10: Nyalakan kembali foreign key constraints
PRAGMA foreign_keys = ON;
