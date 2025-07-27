-- Menambahkan kolom shipping_area ke tabel orders
ALTER TABLE orders ADD COLUMN shipping_area TEXT;

-- Set nilai default untuk baris yang sudah ada
UPDATE orders SET shipping_area = 'luar-kota' WHERE shipping_area IS NULL;
