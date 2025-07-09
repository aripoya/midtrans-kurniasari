-- Drop existing table if it exists (to avoid schema conflicts)
DROP TABLE IF EXISTS locations;

-- Create new locations table with minimal schema
CREATE TABLE locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama_lokasi TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert predefined locations
INSERT INTO locations (nama_lokasi) VALUES 
('Outlet Glagahsari 91C'),
('Outlet Glagahsari 108'),
('Outlet Bonbin'),
('Outlet Monjali'),
('Outlet Pogung'),
('Outlet Jakal KM14'),
('Outlet Jalan Wonosari'),
('Outlet Jalan Wates'),
('Outlet Godean'),
('Outlet Ahmad Dahlan');
