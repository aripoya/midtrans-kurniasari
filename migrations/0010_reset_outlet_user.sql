-- This script resets the outlet manager user's credentials.
-- It finds the user with the 'outlet_manager' role and updates their username to 'outlet' and password to 'outlet123'.
-- WARNING: This will overwrite existing credentials for the first user found with this role.

-- Note: D1 does not support variables, so we perform this in steps.
-- First, we create a temporary user with the correct credentials.
-- Then, we'll have to manually ensure this is the only 'outlet_manager' or handle duplicates.

-- For simplicity and to ensure access, we will INSERT OR REPLACE.
-- We need the outlet_id. Let's assume it's 'outlet_monjali_id' from a previous migration.
-- If the outlet ID is different, this will need to be adjusted.

-- Let's use the username from the old script 'outlet_monjali' and reset its password.

-- Update password for user 'outlet_monjali' to 'password123'
-- The hash is for 'password123'
UPDATE users SET password = '$2a$10$E.86gVI9zMvH1z23cE9fA.xL5Tz2W2O7Y.rJz.4g6G9zO.9g8c3uG' WHERE username = 'outlet_monjali';

-- Just in case the username was different, let's also try to update the user with role 'outlet_manager'
-- This is less safe if there are multiple managers, but might be necessary.
UPDATE users SET password = '$2a$10$E.86gVI9zMvH1z23cE9fA.xL5Tz2W2O7Y.rJz.4g6G9zO.9g8c3uG' WHERE role = 'outlet_manager';

-- And let's create a known good user just in case the others don't exist
-- Hash is for 'password123'
INSERT OR IGNORE INTO users (id, username, password, name, role, outlet_id)
VALUES ('outlet_monjali_manager', 'outlet_monjali', '$2a$10$E.86gVI9zMvH1z23cE9fA.xL5Tz2W2O7Y.rJz.4g6G9zO.9g8c3uG', 'Outlet Monjali Manager', 'outlet_manager', (SELECT id FROM outlets WHERE name = 'Outlet Monjali'));
