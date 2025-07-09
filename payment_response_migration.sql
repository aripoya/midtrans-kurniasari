-- Add payment_response column to orders table

-- Check if the column already exists
SELECT COUNT(*) AS column_exists
FROM pragma_table_info('orders') 
WHERE name = 'payment_response';

-- Add the column if it doesn't exist
ALTER TABLE orders 
ADD COLUMN payment_response TEXT;

-- Verify the schema after migration
SELECT name FROM pragma_table_info('orders');
