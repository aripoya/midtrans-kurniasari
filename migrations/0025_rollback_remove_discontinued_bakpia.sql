-- Pembatal untuk 0025_remove_discontinued_bakpia.sql
--
-- Mengembalikan empat varian yang dihapus, persis seperti sebelum migrasi
-- (id, nama, harga diambil dari data produksi 01 November 2026).

INSERT OR IGNORE INTO products (id, name, price) VALUES
  (9,   'Bakpia Rasa Ubi Ungu',      52000),
  (309, 'Bakpia Rasa Keju Parmesan', 58000),
  (366, 'bakpia mini premium',       65000),
  (32,  'Bakpia 1 Butir',             1000);
