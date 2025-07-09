-- Add shipping_status column to orders table

-- Check if the column already exists
SELECT COUNT(*) AS column_exists
FROM pragma_table_info('orders') 
WHERE name = 'shipping_status';

-- Add the column if it doesn't exist
ALTER TABLE orders 
ADD COLUMN shipping_status TEXT;

-- Update existing orders to have a default value
UPDATE orders
SET shipping_status = 'pending'
WHERE shipping_status IS NULL;

-- Verify the schema after migration
SELECT name FROM pragma_table_info('orders');
