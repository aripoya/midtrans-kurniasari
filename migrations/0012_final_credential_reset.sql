-- FINAL CREDENTIAL RESET
-- This script resets passwords for 'admin' and 'outlet' users.
-- The bcrypt hashes were generated with bcryptjs version 2.4.3.

-- Reset admin password to 'admin123'
UPDATE users SET password = '$2a$10$Y1/a4T32oV9bB2D5d.Nn.u/9NnZ3gXzYy.C8X.zB4G.9fKz.O1w/q' WHERE username = 'admin';

-- Reset outlet password to 'outlet123'
UPDATE users SET password = '$2a$10$q9LvJJPZti8JcBzlGsk/e.lZUb5oJ/tZMSRGOQMGmFd.lcu/M6JyS' WHERE username = 'outlet';
