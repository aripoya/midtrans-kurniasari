-- Minimal D1 Database Schema Fix
-- Only add the most critical missing column that's causing the 500 error

-- Add admin_note column (this was the specific error we saw)
ALTER TABLE orders ADD COLUMN admin_note TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_orders_admin_note ON orders(admin_note);
