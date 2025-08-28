-- Migration: Fix FKs referencing legacy tables and drop backup table
-- Safe to run multiple times (uses CREATE TABLE ..._new and IF EXISTS semantics)
-- Steps:
-- 1) Recreate order_update_logs with FKs to users and orders
-- 2) Recreate notifications with FKs to users, orders, outlets_unified
-- 3) Drop legacy backup table orders_with_pickup_outlet_backup_0021

BEGIN TRANSACTION;

-- 1) order_update_logs: rebuild with correct foreign keys
CREATE TABLE IF NOT EXISTS order_update_logs_new (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  user_id TEXT,
  old_status TEXT,
  new_status TEXT,
  old_value TEXT,
  new_value TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_role TEXT, -- admin, outlet_manager, deliveryman
  notes TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Populate, ensuring referential integrity:
-- - Keep only rows whose order_id exists in orders
-- - Keep user_id when exists in users; otherwise set to NULL
INSERT INTO order_update_logs_new (
  id, order_id, user_id, old_status, new_status, old_value, new_value, timestamp, user_role, notes
)
SELECT
  l.id,
  l.order_id,
  CASE WHEN l.user_id IS NOT NULL AND l.user_id IN (SELECT u.id FROM users u) THEN l.user_id ELSE NULL END AS user_id,
  l.old_status,
  l.new_status,
  l.old_value,
  l.new_value,
  l.timestamp,
  l.user_role,
  l.notes
FROM order_update_logs l
WHERE l.order_id IN (SELECT o.id FROM orders o);

DROP TABLE order_update_logs;
ALTER TABLE order_update_logs_new RENAME TO order_update_logs;

-- 2) notifications: rebuild with correct foreign keys
CREATE TABLE IF NOT EXISTS notifications_new (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  order_id TEXT,
  outlet_id TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (outlet_id) REFERENCES outlets_unified(id) ON DELETE CASCADE
);

-- Populate with safe mappings:
-- - user_id set to NULL if not present in users
-- - order_id set to NULL if not present in orders (column allows NULL)
INSERT INTO notifications_new (
  id, user_id, order_id, outlet_id, title, message, type, is_read, created_at
)
SELECT
  n.id,
  CASE WHEN n.user_id IS NOT NULL AND n.user_id IN (SELECT u.id FROM users u) THEN n.user_id ELSE NULL END AS user_id,
  CASE WHEN n.order_id IS NOT NULL AND n.order_id IN (SELECT o.id FROM orders o) THEN n.order_id ELSE NULL END AS order_id,
  n.outlet_id,
  n.title,
  n.message,
  n.type,
  n.is_read,
  n.created_at
FROM notifications n;

DROP TABLE notifications;
ALTER TABLE notifications_new RENAME TO notifications;

-- 3) Drop legacy backup table
DROP TABLE IF EXISTS orders_with_pickup_outlet_backup_0021;

COMMIT;

-- Optional performance indexes for orders (uncomment to enable)
-- CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
-- CREATE INDEX IF NOT EXISTS idx_orders_outlet_id ON orders(outlet_id);
-- CREATE INDEX IF NOT EXISTS idx_orders_assigned_deliveryman_id ON orders(assigned_deliveryman_id);
-- CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
