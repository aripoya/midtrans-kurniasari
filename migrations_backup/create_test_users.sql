-- Create a test outlet
INSERT OR IGNORE INTO outlets (id, name, address) 
VALUES ('outlet_test_1', 'Outlet Monjali', 'Jl. Monjali No. 1, Yogyakarta');

-- Create test admin user (password: admin123)
-- Password is bcrypt hashed version of "admin123"
INSERT OR IGNORE INTO users (id, username, password, name, role) 
VALUES ('admin_test_1', 'admin', '$2a$10$zMOHAxRRbFT.9twXJfi6D.dV4wgmuYacN1g1y0MkHzz6GGLiBdQFe', 'Admin User', 'admin');

-- Create test outlet manager (password: outlet123)
INSERT OR IGNORE INTO users (id, username, password, name, role, outlet_id) 
VALUES ('outlet_manager_1', 'outlet', '$2a$10$q9LvJJPZti8JcBzlGsk/e.lZUb5oJ/tZMSRGOQMGmFd.lcu/M6JyS', 'Outlet Manager', 'outlet_manager', 'outlet_test_1');

-- Create test deliveryman (password: delivery123)
INSERT OR IGNORE INTO users (id, username, password, name, role, outlet_id) 
VALUES ('deliveryman_1', 'delivery', '$2a$10$1kLVfg6AQZ6Iv92Zm/39CeYGUgbm3NNI9G5o1gFzpfHQo7ySXHM8a', 'Delivery Person', 'deliveryman', 'outlet_test_1');
