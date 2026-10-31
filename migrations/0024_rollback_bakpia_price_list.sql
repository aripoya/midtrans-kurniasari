-- Pembatal untuk 0024_bakpia_price_list_2026_11_01.sql
--
-- Mengembalikan 23 entri bakpia lama persis seperti sebelum migrasi (id, nama,
-- harga diambil dari data produksi 01 November 2026). Entri baru dan harga baru
-- TIDAK dicabut: jalankan ini hanya bila dropdown perlu dikembalikan apa adanya,
-- lalu sesuaikan harga secara manual.

INSERT OR IGNORE INTO products (id, name, price) VALUES
  (1, 'Bakpia Rasa Kacang Hijau', 52000),
  (17, 'Bakpia Rasa Kumbu Hitam', 52000),
  (2, 'Bakpia Rasa Keju ', 52000),
  (3, 'Bakpia Rasa Coklat', 52000),
  (4, 'Bakpia Rasa Susu', 52000),
  (5, 'Bakpia Rasa Green Tea', 52000),
  (6, 'Bakpia Rasa Tiramisu', 52000),
  (7, 'Bakpia Rasa Kopi', 52000),
  (8, 'Bakpia Mini 3 Rasa', 54000),
  (10, 'Bakpia Keju Edam', 58000),
  (11, 'Bakpia Rasa Premium Ori', 57000),
  (12, 'Bakpia Premium Coklat Keju', 60000),
  (13, 'Bakpia Mix 4 Rasa', 58000),
  (14, 'Bakpia Premium Mix 4 Rasa', 65000),
  (15, 'Bakpia Rasa Coklat Mete', 67000),
  (16, 'Bakpia Rasa Susu Durian', 64000),
  (94, 'bakpia keju edam', 58000),
  (95, 'bakpia kacang hijau', 52000),
  (96, 'bakpia coklat', 52000),
  (97, 'bakpia keju', 52000),
  (98, 'bakpia mix4rasa', 58000),
  (132, 'bakpia premium ori', 57000),
  (136, 'bakpia matcha', 52000);
