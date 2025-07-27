-- ================================================
-- PROPER RELATIONAL DATABASE SCHEMA DESIGN
-- Orders-Outlets Relationship Implementation
-- ================================================

-- ================================================
-- 1. OUTLETS TABLE (Master Data)
-- ================================================
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

-- ================================================
-- 2. ORDERS TABLE (Enhanced with Proper FK Relations)
-- ================================================
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    
    -- Customer Information
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    
    -- Order Details
    payment_method TEXT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    
    -- PROPER RELATIONAL FIELDS
    -- Primary outlet assignment (where order belongs)
    outlet_id TEXT,
    
    -- Delivery/Pickup outlets (can be different from primary outlet)
    delivery_outlet_id TEXT,
    pickup_outlet_id TEXT,
    
    -- Order Type and Area
    area_pengiriman TEXT CHECK (area_pengiriman IN ('Dalam Kota', 'Luar Kota')),
    tipe_pesanan TEXT CHECK (tipe_pesanan IN ('Pesan Antar', 'Pesan Ambil')),
    
    -- Delivery Information
    shipping_area TEXT,
    delivery_address TEXT,
    pickup_method TEXT,
    courier_service TEXT,
    tracking_number TEXT,
    
    -- Status Fields
    order_status TEXT DEFAULT 'pending',
    payment_status TEXT DEFAULT 'pending', 
    shipping_status TEXT DEFAULT 'menunggu-diproses',
    
    -- Admin Fields
    admin_note TEXT,
    assigned_deliveryman_id TEXT,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- FOREIGN KEY CONSTRAINTS (Proper Relational Design)
    FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE SET NULL,
    FOREIGN KEY (delivery_outlet_id) REFERENCES outlets(id) ON DELETE SET NULL,
    FOREIGN KEY (pickup_outlet_id) REFERENCES outlets(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_deliveryman_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ================================================
-- 3. USERS TABLE (Enhanced with Outlet Relations)
-- ================================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'outlet_manager', 'deliveryman')),
    
    -- PROPER OUTLET ASSIGNMENT
    outlet_id TEXT,
    
    -- User Details
    full_name TEXT,
    phone TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- FOREIGN KEY CONSTRAINT
    FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE SET NULL
);

-- ================================================
-- 4. INDEXES FOR PERFORMANCE (Relational Optimization)
-- ================================================

-- Primary relationship indexes
CREATE INDEX IF NOT EXISTS idx_orders_outlet_id ON orders(outlet_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_outlet_id ON orders(delivery_outlet_id);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_outlet_id ON orders(pickup_outlet_id);
CREATE INDEX IF NOT EXISTS idx_users_outlet_id ON users(outlet_id);

-- Query optimization indexes
CREATE INDEX IF NOT EXISTS idx_orders_area_pengiriman ON orders(area_pengiriman);
CREATE INDEX IF NOT EXISTS idx_orders_tipe_pesanan ON orders(tipe_pesanan);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status, payment_status, shipping_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- Combined indexes for common queries
CREATE INDEX IF NOT EXISTS idx_orders_outlet_status ON orders(outlet_id, order_status);
CREATE INDEX IF NOT EXISTS idx_orders_outlet_area ON orders(outlet_id, area_pengiriman);

-- ================================================
-- 5. SAMPLE DATA INSERT (Master Data)
-- ================================================

-- Insert Outlets (Master Data)
INSERT OR REPLACE INTO outlets (id, name, location, address, phone) VALUES
('outlet-bonbin', 'Outlet Bonbin', 'Bonbin', 'Jl. Bonbin No. 123, Yogyakarta', '081234567890'),
('outlet-monjali', 'Outlet Monjali', 'Monjali', 'Jl. Monjali No. 456, Yogyakarta', '081234567891'),
('outlet-jakal', 'Outlet Jakal', 'Jakal', 'Jl. Kaliurang KM 10, Yogyakarta', '081234567892'),
('outlet-glagahsari', 'Outlet Glagahsari', 'Glagahsari', 'Jl. Glagahsari No. 789, Yogyakarta', '081234567893');

-- ================================================
-- 6. DATA MIGRATION STRATEGY
-- ================================================

-- Step 1: Add new columns to existing orders table
ALTER TABLE orders ADD COLUMN delivery_outlet_id TEXT;
ALTER TABLE orders ADD COLUMN pickup_outlet_id TEXT;

-- Step 2: Migrate existing data using intelligent mapping
-- Map orders to outlets based on lokasi_pengiriman string matching
UPDATE orders SET 
    outlet_id = (
        SELECT o.id 
        FROM outlets o 
        WHERE LOWER(orders.lokasi_pengiriman) LIKE LOWER('%' || o.name || '%')
           OR LOWER(orders.lokasi_pengiriman) LIKE LOWER('%' || o.location || '%')
        LIMIT 1
    )
WHERE outlet_id IS NULL;

-- Map delivery outlet based on area and type
UPDATE orders SET 
    delivery_outlet_id = outlet_id
WHERE area_pengiriman = 'Dalam Kota' 
  AND tipe_pesanan = 'Pesan Antar'
  AND delivery_outlet_id IS NULL;

-- Map pickup outlet based on area and type  
UPDATE orders SET 
    pickup_outlet_id = outlet_id
WHERE area_pengiriman = 'Dalam Kota' 
  AND tipe_pesanan = 'Pesan Ambil'
  AND pickup_outlet_id IS NULL;

-- Step 3: Update users outlet assignment
UPDATE users SET 
    outlet_id = (
        SELECT o.id 
        FROM outlets o 
        WHERE LOWER(users.username) LIKE LOWER('%' || o.location || '%')
        LIMIT 1
    )
WHERE role = 'outlet_manager' 
  AND outlet_id IS NULL;

-- ================================================
-- 7. PROPER RELATIONAL QUERIES
-- ================================================

/*
-- Query 1: Get orders for specific outlet (Proper JOIN)
SELECT 
    o.id,
    o.customer_name,
    o.total_amount,
    o.order_status,
    outlet.name as outlet_name,
    delivery_outlet.name as delivery_outlet_name,
    pickup_outlet.name as pickup_outlet_name
FROM orders o
LEFT JOIN outlets outlet ON o.outlet_id = outlet.id
LEFT JOIN outlets delivery_outlet ON o.delivery_outlet_id = delivery_outlet.id  
LEFT JOIN outlets pickup_outlet ON o.pickup_outlet_id = pickup_outlet.id
WHERE o.outlet_id = 'outlet-bonbin';

-- Query 2: Get orders by user's outlet (Proper RBAC)
SELECT 
    o.id,
    o.customer_name,
    o.total_amount,
    o.order_status,
    outlet.name as outlet_name
FROM orders o
JOIN outlets outlet ON o.outlet_id = outlet.id
JOIN users u ON u.outlet_id = outlet.id
WHERE u.id = ? -- User ID parameter
  AND u.role = 'outlet_manager';

-- Query 3: Complex filtering with proper relations
SELECT 
    o.id,
    o.customer_name,
    o.order_status,
    outlet.name as outlet_name,
    COUNT(*) as order_count
FROM orders o
JOIN outlets outlet ON o.outlet_id = outlet.id
WHERE outlet.is_active = true
  AND o.area_pengiriman = 'Dalam Kota'
  AND o.created_at >= date('now', '-30 days')
GROUP BY outlet.id, outlet.name
ORDER BY order_count DESC;
*/
