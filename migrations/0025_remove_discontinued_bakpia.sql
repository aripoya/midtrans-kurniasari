-- Hapus varian bakpia yang sudah tidak dijual (dikonfirmasi pemilik, 01 Nov 2026).
--
-- Keempatnya tidak ada di daftar harga 01 November 2026 dan harganya masih harga
-- lama, sehingga kalau tetap di dropdown justru berisiko terjual dengan harga
-- yang sudah tidak berlaku.
--
-- Pesanan lama tetap utuh: order_items menyimpan salinan nama dan harga saat
-- transaksi, bukan referensi ke products.

DELETE FROM products WHERE id IN (
  9,   -- Bakpia Rasa Ubi Ungu       52000
  309, -- Bakpia Rasa Keju Parmesan  58000
  366, -- bakpia mini premium        65000
  32   -- Bakpia 1 Butir              1000
);

-- Sengaja TIDAK dihapus:
--   id 155 'kekurangan bakpia' 16000 - item penyesuaian pembayaran, sejenis
--   'kekurangan pembayaran 4000' dan 'kekurangan ongkir', bukan produk jualan.
