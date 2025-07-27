-- Add payment_response column to store the full JSON response from Midtrans
ALTER TABLE orders ADD COLUMN payment_response TEXT;
