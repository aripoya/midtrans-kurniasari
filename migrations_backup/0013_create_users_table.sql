-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    outlet_id TEXT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'outlet_manager', 'deliveryman')),
    email TEXT,
    phone TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    FOREIGN KEY (outlet_id) REFERENCES outlets(id) ON DELETE SET NULL
);

-- Insert default admin user
-- Password is hashed and should be changed after first login
-- This is just a placeholder - in production we'd use a proper password hash
INSERT INTO users (id, username, password_hash, name, role) 
VALUES ('admin-default', 'admin', '$2a$12$dYgJM6NCVU6PEilC5DA1UuC8JUn9Lg46cg5L4rIDm6m/b7FdZ/cfG', 'Admin', 'admin');
