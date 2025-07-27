-- Add missing lokasi columns to D1 orders table
-- These are required for lokasi_pengiriman and lokasi_pengambilan updates

-- Add lokasi_pengiriman column
ALTER TABLE orders ADD COLUMN lokasi_pengiriman TEXT;

-- Add lokasi_pengambilan column  
ALTER TABLE orders ADD COLUMN lokasi_pengambilan TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_lokasi_pengiriman ON orders(lokasi_pengiriman);
CREATE INDEX IF NOT EXISTS idx_orders_lokasi_pengambilan ON orders(lokasi_pengambilan);
