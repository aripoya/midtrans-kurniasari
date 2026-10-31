-- Daftar Harga Bakpia Kurnia Sari, berlaku 01 November 2026.
--
-- Sebelum ini tabel products memuat tiga generasi penamaan untuk bakpia yang sama
-- (misal "Bakpia Rasa Kacang Hijau", "bakpia kacang hijau", dan "Bakpia Kacang
-- Hijau Isi 15"), dua di antaranya masih berharga lama, sehingga staf bisa memilih
-- harga yang salah dari dropdown. Migrasi ini menyisakan satu entri per varian,
-- memakai penamaan "... Isi N" yang menyebutkan jumlah isi di nota pelanggan.
--
-- Pesanan lama tidak terpengaruh: order_items menyimpan salinan nama dan harga
-- saat pesanan dibuat, bukan referensi ke products.

-- 1. Samakan penamaan yang hanya beda huruf besar/kecil
UPDATE products SET name = 'Bakpia Mix 4 Rasa Isi 16', updated_at = CURRENT_TIMESTAMP
WHERE name = 'Bakpia Mix 4 Rasa isi 16';

-- 2. Harga resmi per 01 November 2026.
--    Upsert: entri yang sudah ada diperbarui harganya, yang belum ada dibuat.
--    Semua isi 15, kecuali yang disebutkan pada namanya.
INSERT INTO products (name, price) VALUES
  ('Bakpia Kacang Hijau Isi 15',        55000),
  ('Bakpia Kumbu Hitam Isi 15',         55000),
  ('Bakpia Keju Isi 15',                55000),
  ('Bakpia Coklat Isi 15',              55000),
  ('Bakpia Susu Isi 15',                55000),
  ('Bakpia Green Tea Isi 15',           55000),
  ('Bakpia Matcha Isi 15',              55000),
  ('Bakpia Tiramisu Isi 15',            55000),
  ('Bakpia Kopi Isi 15',                55000),
  ('Bakpia Mini 3 Rasa Isi 20',         57000),
  ('Bakpia Mini 3 Rasa Isi 40',         57000),
  ('Bakpia Premium Ori Isi 15',         60000),
  ('Bakpia Keju Edam Isi 15',           61000),
  ('Bakpia Mix 4 Rasa Isi 16',          61000),
  ('Bakpia Premium Coklat Keju Isi 15', 63000),
  ('Bakpia Susu Durian Isi 15',         67000),
  ('Bakpia Premium Mix 4 Rasa Isi 16',  68000),
  ('Bakpia Coklat Mete Isi 15',         70000)
ON CONFLICT(name) DO UPDATE SET
  price = excluded.price,
  updated_at = CURRENT_TIMESTAMP;

-- 3. Hapus entri lama yang sudah terwakili di atas. Dihapus per id supaya
--    'Bakpia Rasa Keju ' (ada spasi di belakang) ikut terhapus dengan pasti.
DELETE FROM products WHERE id IN (
  1,   -- Bakpia Rasa Kacang Hijau      -> Bakpia Kacang Hijau Isi 15
  17,  -- Bakpia Rasa Kumbu Hitam       -> Bakpia Kumbu Hitam Isi 15
  2,   -- 'Bakpia Rasa Keju '           -> Bakpia Keju Isi 15
  3,   -- Bakpia Rasa Coklat            -> Bakpia Coklat Isi 15
  4,   -- Bakpia Rasa Susu              -> Bakpia Susu Isi 15
  5,   -- Bakpia Rasa Green Tea         -> Bakpia Green Tea Isi 15
  6,   -- Bakpia Rasa Tiramisu          -> Bakpia Tiramisu Isi 15
  7,   -- Bakpia Rasa Kopi              -> Bakpia Kopi Isi 15
  8,   -- Bakpia Mini 3 Rasa            -> Isi 20 / Isi 40
  10,  -- Bakpia Keju Edam              -> Bakpia Keju Edam Isi 15
  11,  -- Bakpia Rasa Premium Ori       -> Bakpia Premium Ori Isi 15
  12,  -- Bakpia Premium Coklat Keju    -> Bakpia Premium Coklat Keju Isi 15
  13,  -- Bakpia Mix 4 Rasa             -> Bakpia Mix 4 Rasa Isi 16
  14,  -- Bakpia Premium Mix 4 Rasa     -> Bakpia Premium Mix 4 Rasa Isi 16
  15,  -- Bakpia Rasa Coklat Mete       -> Bakpia Coklat Mete Isi 15
  16,  -- Bakpia Rasa Susu Durian       -> Bakpia Susu Durian Isi 15
  94,  -- bakpia keju edam              -> Bakpia Keju Edam Isi 15
  95,  -- bakpia kacang hijau           -> Bakpia Kacang Hijau Isi 15
  96,  -- bakpia coklat                 -> Bakpia Coklat Isi 15
  97,  -- bakpia keju                   -> Bakpia Keju Isi 15
  98,  -- bakpia mix4rasa               -> Bakpia Mix 4 Rasa Isi 16
  132, -- bakpia premium ori            -> Bakpia Premium Ori Isi 15
  136  -- bakpia matcha                 -> Bakpia Matcha Isi 15
);

-- Sengaja TIDAK disentuh karena bukan duplikat dan tidak ada di daftar harga baru:
--   id 9   Bakpia Rasa Ubi Ungu       52000
--   id 309 Bakpia Rasa Keju Parmesan  58000
--   id 366 bakpia mini premium        65000
--   id 32  Bakpia 1 Butir              1000
--   id 155 kekurangan bakpia          16000  (item penyesuaian, bukan produk)
