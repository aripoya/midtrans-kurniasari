-- Cleanup old admin sessions
-- Mark sessions older than 24 hours as inactive

UPDATE admin_sessions
SET is_active = 0,
    logout_at = datetime('now')
WHERE is_active = 1
  AND datetime(last_activity) < datetime('now', '-24 hours');

-- Verify active sessions (should only show recent ones)
SELECT 
  session_id,
  admin_name,
  ip_address,
  login_at,
  last_activity,
  ROUND((julianday('now') - julianday(last_activity)) * 24, 2) as hours_since_activity
FROM admin_sessions
WHERE is_active = 1
ORDER BY last_activity DESC;
