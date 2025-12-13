-- Migration: Remove Foreign Key Constraint from order_items table
-- This fixes the FK constraint error when creating orders in D1 database

-- Step 1: Backup existing order_items data
CREATE TABLE order_items_backup AS SELECT * FROM order_items;

-- Step 2: Drop the old order_items table with FK constraint
DROP TABLE order_items;

-- Step 3: Recreate order_items WITHOUT foreign key constraint
CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    product_price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    subtotal REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Step 4: Restore data from backup (only columns that exist in old table)
INSERT INTO order_items (id, order_id, product_name, product_price, quantity, subtotal)
SELECT id, order_id, product_name, product_price, quantity, subtotal
FROM order_items_backup;

-- Step 5: Drop backup table
DROP TABLE order_items_backup;

-- Step 6: Create index for performance
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Step 7: Verify schema
-- SELECT sql FROM sqlite_master WHERE type='table' AND name='order_items';
