-- Shipping images table
CREATE TABLE IF NOT EXISTS shipping_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL REFERENCES orders(id),
    image_type TEXT NOT NULL, -- 'ready_for_pickup', 'picked_up', 'delivered'
    image_url TEXT NOT NULL, -- URL to the image in R2
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for finding images by order
CREATE INDEX IF NOT EXISTS idx_shipping_images_order_id ON shipping_images(order_id);
