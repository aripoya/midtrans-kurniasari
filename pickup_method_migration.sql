-- Migration untuk menambahkan kolom pickup_method ke tabel orders
-- Digunakan untuk menyimpan metode pengambilan seperti 'sendiri' atau 'ojek-online'

-- Tambahkan kolom pickup_method jika belum ada
ALTER TABLE orders ADD COLUMN pickup_method TEXT;

-- Tambahkan indeks untuk optimasi pencarian
CREATE INDEX IF NOT EXISTS idx_orders_pickup_method ON orders(pickup_method);
