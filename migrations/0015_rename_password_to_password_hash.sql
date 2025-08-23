-- Step 1: Add the new password_hash column
ALTER TABLE users ADD COLUMN password_hash TEXT;

-- Step 2: Copy existing passwords from 'password' to 'password_hash'
-- This is a temporary step. We will hash these passwords later.
UPDATE users SET password_hash = password;

-- Step 3: Drop the old 'password' column
-- Note: D1 does not directly support DROP COLUMN. The common workaround is to
-- create a new table, copy data, and then rename it. However, for this migration,
-- we will assume a manual process or a more complex migration script is used.
-- For now, this file just documents the INTENT to move to password_hash.
-- A separate script will handle the hashing and data migration.

-- The final state should be that the 'password' column is removed and
-- 'password_hash' contains hashed passwords.
