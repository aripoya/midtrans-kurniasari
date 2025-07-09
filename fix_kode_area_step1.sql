-- Step 1: Mematikan foreign key checks dan menambahkan kolom kode_area
PRAGMA foreign_keys = OFF;

-- Tambahkan kolom kode_area ke tabel locations jika belum ada
ALTER TABLE locations ADD COLUMN kode_area TEXT;

-- Perbarui kolom kode_area dengan nilai yang sama dengan nama_lokasi
UPDATE locations SET kode_area = nama_lokasi WHERE kode_area IS NULL;
