-- Fix duplicate outlet_id names
-- Remove "outlet_" prefix duplication

-- Update users table
UPDATE users 
SET outlet_id = 'outlet_pogung' 
WHERE outlet_id = 'outlet_outlet_pogung';

UPDATE users 
SET outlet_id = 'outlet_ahmad_dahlan' 
WHERE outlet_id = 'outlet_outlet_ahmad_dahlan';

UPDATE users 
SET outlet_id = 'outlet_godean' 
WHERE outlet_id = 'outlet_outlet_godean';

UPDATE users 
SET outlet_id = 'outlet_monjali' 
WHERE outlet_id = 'outlet_outlet_monjali';

-- Check if orders table has outlet_id column and update if exists
-- Note: This assumes orders might reference outlet_id
-- You may need to adjust based on your actual schema

-- Verify the changes
SELECT username, outlet_id, role 
FROM users 
WHERE outlet_id LIKE 'outlet_%' 
ORDER BY outlet_id;
