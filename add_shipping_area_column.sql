-- Migration untuk menambahkan kolom shipping_area ke tabel orders

-- 1. Tambahkan kolom shipping_area ke tabel orders
ALTER TABLE orders ADD COLUMN shipping_area TEXT DEFAULT 'dalam-kota';

-- 2. Update semua data yang ada berdasarkan nilai dari tipe_pesanan jika ada
-- UPDATE orders SET shipping_area = 'dalam-kota' WHERE shipping_area IS NULL;

-- 3. Tambahkan indeks untuk optimasi performa query
CREATE INDEX IF NOT EXISTS idx_orders_shipping_area ON orders(shipping_area);

-- 4. Update timestamps untuk menandai perubahan
UPDATE orders SET updated_at = CURRENT_TIMESTAMP WHERE 1=1;
