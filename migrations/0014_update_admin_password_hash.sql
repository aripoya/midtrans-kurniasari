-- Update admin password to a securely hashed value
UPDATE users SET password_hash = '$2a$10$FyoAOnsSdVlejFGeVlqfTepiIEv./VDBhYkbiPIW4uA0wV7AIQGtS' WHERE username = 'admin';
