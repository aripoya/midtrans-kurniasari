-- Create outlets table if it doesn't exist
CREATE TABLE IF NOT EXISTS outlets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL CHECK(role IN ('admin', 'outlet_manager', 'deliveryman')),
  outlet_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (outlet_id) REFERENCES outlets(id)
);

-- Create indices for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_outlet_id ON users(outlet_id);
