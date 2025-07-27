-- Add outlet_id and assigned_deliveryman_id to orders table
ALTER TABLE orders ADD COLUMN outlet_id TEXT;
ALTER TABLE orders ADD COLUMN assigned_deliveryman_id TEXT;

-- Set foreign key constraints
PRAGMA foreign_keys = OFF;

-- Update existing orders to use default outlet
UPDATE orders SET outlet_id = 'outlet-monjali' WHERE lokasi_pengiriman = 'Outlet Monjali';

-- Add foreign key constraints
ALTER TABLE orders ADD CONSTRAINT fk_outlet_id
FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE SET NULL;

ALTER TABLE orders ADD CONSTRAINT fk_assigned_deliveryman_id
FOREIGN KEY (assigned_deliveryman_id) REFERENCES users(id) ON DELETE SET NULL;

PRAGMA foreign_keys = ON;
