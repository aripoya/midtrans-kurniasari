-- Buat beberapa pesanan test untuk testing

-- Hapus pesanan lama jika ada
DELETE FROM orders;

-- Masukkan pesanan baru
INSERT INTO orders (
  id, 
  customer_name, 
  customer_email, 
  customer_phone, 
  shipping_address, 
  order_status, 
  payment_status, 
  shipping_status, 
  shipping_area, 
  shipping_method, 
  shipping_location_id, 
  total_amount, 
  outlet_id, 
  created_at
) VALUES
(
  'ord-test-001', 
  'Pelanggan Test 1', 
  'test1@example.com', 
  '081234567891', 
  'Jl. Kaliurang No. 10', 
  'completed', 
  'paid', 
  'siap kirim', 
  'Dalam Kota', 
  'Pesan Antar', 
  '1', 
  150000, 
  'outlet_bonbin', 
  datetime('now', '-2 days')
),
(
  'ord-test-002', 
  'Pelanggan Test 2', 
  'test2@example.com', 
  '081234567892', 
  'Jl. Palagan No. 20', 
  'completed', 
  'paid', 
  'dalam pengiriman', 
  'Dalam Kota', 
  'Pesan Antar', 
  '2', 
  200000, 
  'outlet_glagahsari', 
  datetime('now', '-1 days')
),
(
  'ord-test-003', 
  'Pelanggan Test 3', 
  'test3@example.com', 
  '081234567893', 
  'Jl. Malioboro No. 30', 
  'completed', 
  'paid', 
  'dikemas', 
  'Luar Kota', 
  'Pesan Antar', 
  '3', 
  250000, 
  'outlet_jakal_km14', 
  datetime('now', '-12 hours')
);

-- Assign pesanan ke kurir test
UPDATE orders 
SET assigned_deliveryman_id = 'deliveryman_1' 
WHERE id IN ('ord-test-001', 'ord-test-002', 'ord-test-003');

-- Lihat pesanan yang sudah dibuat
SELECT id, customer_name, shipping_status, assigned_deliveryman_id FROM orders;
