-- Migration untuk menambahkan kolom assigned_deliveryman_id ke tabel orders
ALTER TABLE orders ADD COLUMN assigned_deliveryman_id TEXT;

-- Update beberapa pesanan untuk ditetapkan ke kurir 'delivery'
UPDATE orders 
SET assigned_deliveryman_id = 'user_delivery' 
WHERE id IN (
  SELECT id FROM orders ORDER BY created_at DESC LIMIT 3
);

-- Informasi debug tentang tabel orders
PRAGMA table_info(orders);

-- Tampilkan pesanan yang telah ditetapkan ke kurir
SELECT id, customer_name, shipping_status, assigned_deliveryman_id 
FROM orders 
WHERE assigned_deliveryman_id IS NOT NULL;
