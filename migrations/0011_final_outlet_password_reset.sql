-- FINAL PASSWORD RESET FOR OUTLET MANAGER
-- This script updates the password for the user with username 'outlet' to 'outlet123'.
-- The bcrypt hash provided here was generated with bcryptjs version 2.4.3.
UPDATE users SET password = '$2a$10$q9LvJJPZti8JcBzlGsk/e.lZUb5oJ/tZMSRGOQMGmFd.lcu/M6JyS' WHERE username = 'outlet';
