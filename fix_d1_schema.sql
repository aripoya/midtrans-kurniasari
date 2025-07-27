-- Comprehensive D1 Database Schema Fix (SQLite Compatible)
-- This script adds all missing columns that the backend expects
-- D1 uses SQLite, so we use simple ALTER TABLE statements

-- ================================================
-- RELATIONAL STRUCTURE ENHANCEMENT
-- ================================================

-- Add relational outlet columns for proper foreign key relationships
ALTER TABLE orders ADD COLUMN delivery_outlet_id TEXT;
ALTER TABLE orders ADD COLUMN pickup_outlet_id TEXT;

-- Create outlets table if not exists
CREATE TABLE IF NOT EXISTS outlets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    location TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample outlets for testing
INSERT OR REPLACE INTO outlets (id, name, location, address, phone) VALUES
('outlet-bonbin', 'Outlet Bonbin', 'Bonbin', 'Jl. Bonbin No. 123, Yogyakarta', '081234567890'),
('outlet-monjali', 'Outlet Monjali', 'Monjali', 'Jl. Monjali No. 456, Yogyakarta', '081234567891'),
('outlet-jakal', 'Outlet Jakal', 'Jakal', 'Jl. Kaliurang KM 10, Yogyakarta', '081234567892'),
('outlet-glagahsari', 'Outlet Glagahsari', 'Glagahsari', 'Jl. Glagahsari No. 789, Yogyakarta', '081234567893');

-- Add admin_note column for admin notes/comments
ALTER TABLE orders ADD COLUMN admin_note TEXT;

-- Add shipping_area column (may already exist)
-- ALTER TABLE orders ADD COLUMN shipping_area TEXT DEFAULT 'dalam-kota';

-- Add pickup_method column (may already exist) 
-- ALTER TABLE orders ADD COLUMN pickup_method TEXT;
OKAS
-- Add tracking_number and courier_service for luar kota orders
ALTER TABLE orders ADD COLUMN tracking_number TEXT;
ALTER TABLE orders ADD COLUMN courier_service TEXT;

-- Add tipe_pesanan column
ALTER TABLE orders ADD COLUMN tipe_pesanan TEXT;

-- Add lokasi_pengiriman and lokasi_pengambilan
ALTER TABLE orders ADD COLUMN lokasi_pengiriman TEXT;
ALTER TABLE orders ADD COLUMN lokasi_pengambilan TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_admin_note ON orders(admin_note);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_area ON orders(shipping_area);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_method ON orders(pickup_method);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number);
CREATE INDEX IF NOT EXISTS idx_orders_tipe_pesanan ON orders(tipe_pesanan);

-- Update existing records with default values
UPDATE orders SET 
    shipping_area = 'dalam-kota' 
WHERE shipping_area IS NULL;

UPDATE orders SET 
    tipe_pesanan = 'Pesan Antar' 
WHERE tipe_pesanan IS NULL;

-- Set updated_at for all modified records
UPDATE orders SET updated_at = CURRENT_TIMESTAMP;

-- ================================================
-- RELATIONAL DATA MIGRATION
-- ================================================

-- Step 1: Map existing orders to outlets based on lokasi_pengiriman
UPDATE orders SET 
    outlet_id = (
        SELECT o.id 
        FROM outlets o 
        WHERE LOWER(orders.lokasi_pengiriman) LIKE LOWER('%' || o.name || '%')
           OR LOWER(orders.lokasi_pengiriman) LIKE LOWER('%' || o.location || '%')
        LIMIT 1
    )
WHERE outlet_id IS NULL
  AND lokasi_pengiriman IS NOT NULL;

-- Step 2: Set delivery_outlet_id for delivery orders
UPDATE orders SET 
    delivery_outlet_id = outlet_id
WHERE area_pengiriman = 'Dalam Kota' 
  AND tipe_pesanan = 'Pesan Antar'
  AND delivery_outlet_id IS NULL
  AND outlet_id IS NOT NULL;

-- Step 3: Set pickup_outlet_id for pickup orders
UPDATE orders SET 
    pickup_outlet_id = outlet_id
WHERE area_pengiriman = 'Dalam Kota' 
  AND tipe_pesanan = 'Pesan Ambil'
  AND pickup_outlet_id IS NULL
  AND outlet_id IS NOT NULL;

-- Step 4: Update users outlet assignment
UPDATE users SET 
    outlet_id = (
        SELECT o.id 
        FROM outlets o 
        WHERE LOWER(users.username) LIKE LOWER('%' || o.location || '%')
        LIMIT 1
    )
WHERE role = 'outlet_manager' 
  AND outlet_id IS NULL;

-- Create indexes for relational performance
CREATE INDEX IF NOT EXISTS idx_orders_delivery_outlet_id ON orders(delivery_outlet_id);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_outlet_id ON orders(pickup_outlet_id);
CREATE INDEX IF NOT EXISTS idx_orders_outlet_status ON orders(outlet_id, order_status);
CREATE INDEX IF NOT EXISTS idx_orders_outlet_area ON orders(outlet_id, area_pengiriman);
