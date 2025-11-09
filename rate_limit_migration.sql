-- Rate Limiting Migration
-- This table tracks API request attempts for rate limiting and brute force protection

CREATE TABLE IF NOT EXISTS rate_limit_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT NOT NULL,        -- IP address or IP+username combination
    endpoint TEXT NOT NULL,           -- API endpoint being accessed (e.g., '/api/auth/login')
    attempt_type TEXT NOT NULL,       -- 'success' or 'failed'
    window_start DATETIME NOT NULL,   -- Start of the rate limit time window
    attempt_count INTEGER DEFAULT 1,  -- Number of attempts in this window
    last_attempt DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,                  -- Client IP for logging
    user_agent TEXT,                  -- User agent for logging
    blocked_until DATETIME,           -- If blocked, when the block expires
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups by identifier and endpoint
CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier_endpoint
ON rate_limit_attempts(identifier, endpoint, window_start);

-- Index for cleanup of old records
CREATE INDEX IF NOT EXISTS idx_rate_limit_created_at
ON rate_limit_attempts(created_at);

-- Index for blocked entries
CREATE INDEX IF NOT EXISTS idx_rate_limit_blocked
ON rate_limit_attempts(blocked_until);

-- Rate limit violations log table (for monitoring and alerting)
CREATE TABLE IF NOT EXISTS rate_limit_violations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    violation_type TEXT NOT NULL,     -- 'rate_exceeded', 'brute_force_detected'
    attempt_count INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    blocked_duration_minutes INTEGER, -- How long the block lasts
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for violation monitoring
CREATE INDEX IF NOT EXISTS idx_rate_violations_created
ON rate_limit_violations(created_at);

CREATE INDEX IF NOT EXISTS idx_rate_violations_identifier
ON rate_limit_violations(identifier, endpoint);
