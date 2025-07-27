-- Create outlets table
CREATE TABLE IF NOT EXISTS outlets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default outlet (for existing orders)
INSERT INTO outlets (id, name, location, is_active) 
VALUES ('outlet-monjali', 'Outlet Monjali', 'Monjali', 1);
