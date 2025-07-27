-- Add order_status column if it doesn't exist
ALTER TABLE orders 
ADD COLUMN order_status TEXT NOT NULL DEFAULT 'pending';

-- Add other missing columns if needed
ALTER TABLE orders
ADD COLUMN outlet_id TEXT NULL;
