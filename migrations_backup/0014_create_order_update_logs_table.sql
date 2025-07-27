-- Create order_update_logs table for audit trail
CREATE TABLE IF NOT EXISTS order_update_logs (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    user_id TEXT,
    update_type TEXT NOT NULL, -- status, shipping, payment, etc.
    old_value TEXT,
    new_value TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_role TEXT, -- admin, outlet_manager, deliveryman
    notes TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
