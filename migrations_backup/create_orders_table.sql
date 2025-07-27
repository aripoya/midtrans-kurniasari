-- Create orders table if it doesn't exist
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  shipping_address TEXT,
  order_status TEXT NOT NULL DEFAULT 'pending',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  shipping_status TEXT DEFAULT NULL,
  shipping_area TEXT DEFAULT NULL,
  shipping_method TEXT DEFAULT NULL,
  shipping_location_id TEXT DEFAULT NULL,
  total_amount REAL NOT NULL,
  payment_token TEXT,
  payment_redirect_url TEXT,
  outlet_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (outlet_id) REFERENCES outlets(id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_outlet_id ON orders(outlet_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
