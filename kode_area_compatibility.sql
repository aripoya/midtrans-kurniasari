-- Migration untuk menambahkan kolom kode_area dummy untuk kompatibilitas
-- dengan kode yang mungkin masih mereferensikannya

-- Tambahkan kolom kode_area ke tabel locations jika belum ada
ALTER TABLE locations ADD COLUMN kode_area TEXT;

-- Update kolom kode_area dengan nilai yang sama dengan nama_lokasi
-- untuk memastikan tidak ada nilai NULL yang bisa menyebabkan error JOIN
UPDATE locations SET kode_area = nama_lokasi WHERE kode_area IS NULL;
