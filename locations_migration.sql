-- Migration to add locations table and related fields to orders
-- Create locations table
CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kode_area TEXT NOT NULL UNIQUE,
    nama_lokasi TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add location fields to orders table
ALTER TABLE orders ADD COLUMN lokasi_pengiriman TEXT REFERENCES locations(kode_area);
ALTER TABLE orders ADD COLUMN lokasi_pengambilan TEXT REFERENCES locations(kode_area);
ALTER TABLE orders ADD COLUMN tipe_pesanan TEXT; -- 'Pesan Ambil' or 'Pesan Antar'

-- Index for location lookups
CREATE INDEX IF NOT EXISTS idx_locations_kode_area ON locations(kode_area);

-- Insert predefined locations
INSERT INTO locations (kode_area, nama_lokasi) VALUES 
('AB', 'Outlet Glagahsari 91C'),
('TM', 'Outlet Glagahsari 108'),
('BO', 'Outlet Bonbin'),
('MJL', 'Outlet Monjali'),
('JKL', 'Outlet Pogung'),
('JKLU', 'Outlet Jakal KM14'),
('JW', 'Outlet Jalan Wonosari'),
('JAWA', 'Outlet Jalan Wates'),
('JAGO', 'Outlet Godean'),
('KH', 'Outlet Ahmad Dahlan');
