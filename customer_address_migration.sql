-- Add customer_address column to orders table

-- Check if the column already exists
SELECT COUNT(*) AS column_exists
FROM pragma_table_info('orders') 
WHERE name = 'customer_address';

-- Add the column if it doesn't exist
ALTER TABLE orders 
ADD COLUMN customer_address TEXT;

-- Verify the schema after migration
SELECT name FROM pragma_table_info('orders');
