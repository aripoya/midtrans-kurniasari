-- Migration to add tracking_number field to orders table
ALTER TABLE orders ADD COLUMN tracking_number TEXT;
ALTER TABLE orders ADD COLUMN courier_service TEXT;
-- Index for tracking number lookups
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number);
