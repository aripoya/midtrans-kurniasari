-- Insert a test notification for admin
INSERT INTO notifications (
  id, 
  user_id, 
  order_id,
  outlet_id,
  title,
  message,
  type,
  is_read,
  created_at
) VALUES (
  'notif_test_1', 
  'admin_test_1', 
  NULL,
  NULL,
  'Test Notification',
  'This is a test notification to verify the notification system works properly',
  'test',
  0,
  datetime('now')
);

-- Insert a test notification for outlet manager
INSERT INTO notifications (
  id, 
  user_id, 
  order_id,
  outlet_id,
  title,
  message,
  type,
  is_read,
  created_at
) VALUES (
  'notif_test_2', 
  'outlet_manager_1', 
  NULL,
  'outlet_test_1',
  'New Order Assigned',
  'A new order has been assigned to your outlet',
  'order_assignment',
  0,
  datetime('now')
);

-- Insert a test notification for deliveryman
INSERT INTO notifications (
  id, 
  user_id, 
  order_id,
  outlet_id,
  title,
  message,
  type,
  is_read,
  created_at
) VALUES (
  'notif_test_3', 
  'deliveryman_1', 
  NULL,
  'outlet_test_1',
  'New Delivery Assignment',
  'You have been assigned a new delivery',
  'delivery_assignment',
  0,
  datetime('now')
);
