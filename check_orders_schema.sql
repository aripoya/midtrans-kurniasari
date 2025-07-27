-- Debug: Check orders table schema to see all columns
PRAGMA table_info(orders);

-- Debug: Check if lokasi_pengiriman column exists and has data
SELECT id, lokasi_pengiriman, lokasi_pengambilan, admin_note, shipping_area 
FROM orders 
LIMIT 5;
