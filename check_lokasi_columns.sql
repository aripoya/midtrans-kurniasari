-- Check if lokasi_pengiriman and related columns exist
SELECT COUNT(*) as total_orders FROM orders;

-- Try to select lokasi columns - will fail if columns don't exist
SELECT id, lokasi_pengiriman, lokasi_pengambilan FROM orders LIMIT 1;
