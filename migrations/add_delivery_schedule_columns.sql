-- Add delivery scheduling fields to orders table
-- These fields store planned delivery schedule for courier/deliveryman flow

ALTER TABLE orders ADD COLUMN delivery_date TEXT;
ALTER TABLE orders ADD COLUMN delivery_time TEXT;

-- Helpful indexes for filtering/scheduling
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON orders(delivery_date);
