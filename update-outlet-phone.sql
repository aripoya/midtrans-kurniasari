-- Update nomor WhatsApp untuk Outlet Glagahsari 91
-- Nomor: 6281393133841

-- Cek outlet yang ada terlebih dahulu
SELECT id, name, phone FROM outlets_unified WHERE id LIKE '%glagahsari%';

-- Update nomor untuk outlet_glagahsari_91
UPDATE outlets_unified 
SET phone = '6281393133841'
WHERE id = 'outlet_glagahsari_91';

-- Verifikasi update berhasil
SELECT id, name, phone FROM outlets_unified WHERE id = 'outlet_glagahsari_91';
