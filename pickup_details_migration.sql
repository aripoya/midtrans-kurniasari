-- Add pickup detail fields to orders table for pickup statuses
-- These fields are used when order status is "siap di ambil" or "sudah di ambil"

ALTER TABLE orders ADD COLUMN pickup_outlet TEXT;
ALTER TABLE orders ADD COLUMN picked_up_by TEXT;
ALTER TABLE orders ADD COLUMN pickup_date TEXT;
ALTER TABLE orders ADD COLUMN pickup_time TEXT;

-- Index for pickup queries
CREATE INDEX IF NOT EXISTS idx_orders_pickup_outlet ON orders(pickup_outlet);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_date ON orders(pickup_date);
