-- Debug: Check what lokasi values are currently in orders table
SELECT DISTINCT lokasi_pengiriman, COUNT(*) as count 
FROM orders 
WHERE lokasi_pengiriman IS NOT NULL 
GROUP BY lokasi_pengiriman;

-- Check all available locations
SELECT 'Available locations:' as debug;
SELECT id, nama_lokasi FROM locations ORDER BY nama_lokasi;
