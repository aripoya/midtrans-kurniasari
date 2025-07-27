-- Add shipping_status column to track order fulfillment
ALTER TABLE orders ADD COLUMN shipping_status TEXT DEFAULT 'di kemas';
