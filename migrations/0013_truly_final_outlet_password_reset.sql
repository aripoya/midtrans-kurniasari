-- TRULY FINAL OUTLET PASSWORD RESET
-- This script updates the password for the user with username 'outlet' to 'outlet123'.
-- This hash has been generated with a different, verified method to ensure compatibility.

-- Update password_hash column which is used by loginUser function
UPDATE users SET password_hash = '$2a$10$2ut3juksq5yZE6mS0jj2/.j01UI1CUcG8dno9xjEy6W76qkIT.wyK' WHERE username = 'outlet';

-- Reset password column to NULL to avoid confusion
UPDATE users SET password = NULL WHERE username = 'outlet';
