# Rate Limiting Implementation

## Overview

This application now includes comprehensive rate limiting to protect against brute force attacks, API abuse, and DDoS attempts. The rate limiting system is database-backed, persistent across worker instances, and highly configurable.

## Security Issue Addressed

**Issue**: Missing Rate Limiting (Severity: 7/10)
- **Problem**: All API endpoints were vulnerable to brute force attacks and API abuse
- **Impact**: Attackers could attempt unlimited login attempts, spam user creation, or abuse public endpoints
- **Solution**: Implemented database-backed rate limiting with configurable limits per endpoint type

## Architecture

### Components

1. **Database Tables** (`rate_limit_migration.sql`)
   - `rate_limit_attempts`: Tracks all API attempts with time windows
   - `rate_limit_violations`: Logs rate limit violations for monitoring

2. **Middleware** (`src/handlers/rate-limit.js`)
   - Main rate limiting logic
   - Configurable per endpoint type
   - Automatic cleanup of old records
   - Violation logging

3. **Integration Points**
   - Authentication (`src/handlers/auth.js`)
   - User Management (`src/handlers/user-management.js`)
   - Order Creation (`src/handlers/orders.js`)

## Rate Limit Configuration

### Current Limits

| Endpoint Type | Window | Max Attempts | Block Duration | Description |
|--------------|--------|--------------|----------------|-------------|
| **auth_login** | 15 min | 5 | 30 min | Login attempts (tracked by IP + username) |
| **auth_register** | 1 hour | 3 | 1 hour | User registration |
| **password_reset** | 1 hour | 3 | 2 hours | Password reset requests |
| **user_create** | 1 hour | 10 | 30 min | Admin user creation |
| **order_create** | 1 hour | 50 | 30 min | Order creation |
| **api_general** | 1 min | 100 | 5 min | General authenticated API calls |
| **public** | 1 min | 30 | 2 min | Public endpoints |

### Configuration Location

All rate limits are configured in `src/handlers/rate-limit.js` in the `RATE_LIMIT_CONFIG` object.

## Protected Endpoints

### Authentication (Highest Priority)
```
POST /api/auth/login        - 5 attempts per 15 min
POST /auth/login            - 5 attempts per 15 min
POST /api/auth/register     - 3 attempts per hour
```

### User Management
```
POST /api/admin/users                    - 10 attempts per hour
POST /api/admin/users/:id/reset-password - 3 attempts per hour
```

### Order Creation
```
POST /api/orders - 50 attempts per hour
```

## How It Works

### 1. Request Flow

```
Client Request
    ↓
Rate Limit Check (by IP or IP+username)
    ↓
Blocked? → Return 429 Too Many Requests
    ↓
Within Limit? → Allow Request
    ↓
Record Attempt in Database
    ↓
Process Request
    ↓
Mark Success/Failure
```

### 2. Identifier Types

- **Login Attempts**: Tracked by `IP:username` to prevent brute force on specific accounts
- **Other Requests**: Tracked by `IP` address only

### 3. Client IP Detection

The system detects client IP using Cloudflare headers (in priority order):
1. `CF-Connecting-IP` (Cloudflare's real IP)
2. `X-Forwarded-For`
3. `X-Real-IP`

### 4. Blocking Mechanism

When rate limit is exceeded:
- Request is blocked with HTTP 429 status
- Response includes:
  - `blocked_until`: ISO timestamp when block expires
  - `minutes_remaining`: Minutes until unblocked
  - `attempt_count`: Number of attempts made
- Violation is logged in `rate_limit_violations` table

### Example Response (429)

```json
{
  "success": false,
  "error": "Too many login attempts. Please try again in 30 minutes.",
  "blocked_until": "2025-11-09T15:30:00.000Z",
  "minutes_remaining": 28,
  "attempt_count": 6
}
```

## Database Schema

### rate_limit_attempts

```sql
CREATE TABLE rate_limit_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT NOT NULL,        -- IP or IP:username
    endpoint TEXT NOT NULL,           -- API endpoint path
    attempt_type TEXT NOT NULL,       -- 'success', 'failed', 'attempt'
    window_start DATETIME NOT NULL,   -- Time window start
    attempt_count INTEGER DEFAULT 1,  -- Count in this window
    last_attempt DATETIME,
    ip_address TEXT,
    user_agent TEXT,
    blocked_until DATETIME,           -- Block expiry time
    created_at DATETIME,
    updated_at DATETIME
);
```

### rate_limit_violations

```sql
CREATE TABLE rate_limit_violations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    violation_type TEXT NOT NULL,     -- 'rate_exceeded', 'brute_force_detected'
    attempt_count INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    blocked_duration_minutes INTEGER,
    created_at DATETIME
);
```

## Setup Instructions

### 1. Apply Database Migration

```bash
# For development (local)
wrangler d1 execute order-management-local-db --local --file=rate_limit_migration.sql

# For production
wrangler d1 execute order-management-prod --file=rate_limit_migration.sql --env production
```

### 2. Verify Migration

```bash
# Check tables exist
wrangler d1 execute order-management-local-db --local --command="SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'rate_limit%';"
```

### 3. Deploy Updated Code

```bash
# Deploy to production
wrangler deploy --env production
```

## Monitoring & Maintenance

### View Recent Violations

```sql
SELECT
    identifier,
    endpoint,
    violation_type,
    attempt_count,
    ip_address,
    created_at
FROM rate_limit_violations
WHERE created_at > datetime('now', '-24 hours')
ORDER BY created_at DESC
LIMIT 50;
```

### Check Active Blocks

```sql
SELECT
    identifier,
    endpoint,
    attempt_count,
    blocked_until,
    ip_address,
    user_agent
FROM rate_limit_attempts
WHERE blocked_until IS NOT NULL
  AND blocked_until > datetime('now')
ORDER BY blocked_until DESC;
```

### Cleanup Old Records

The system automatically cleans up old records with 1% probability per request:
- `rate_limit_attempts`: Removed after 24 hours
- `rate_limit_violations`: Removed after 7 days

Manual cleanup:
```sql
-- Delete old attempts (older than 24 hours)
DELETE FROM rate_limit_attempts
WHERE created_at < datetime('now', '-24 hours')
  AND (blocked_until IS NULL OR blocked_until < datetime('now'));

-- Delete old violations (older than 7 days)
DELETE FROM rate_limit_violations
WHERE created_at < datetime('now', '-7 days');
```

### Unblock a Specific IP (Emergency)

```sql
-- Unblock all endpoints for an IP
DELETE FROM rate_limit_attempts
WHERE identifier LIKE '123.456.789.0%';

-- Or update to remove block
UPDATE rate_limit_attempts
SET blocked_until = NULL
WHERE identifier LIKE '123.456.789.0%';
```

## Testing

### Test Rate Limiting (Development)

```bash
# Test login rate limiting (should block after 5 attempts)
for i in {1..7}; do
  echo "Attempt $i"
  curl -X POST http://localhost:8787/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong"}'
  echo ""
done
```

### Expected Behavior

1. **Attempts 1-5**: Return 401 Unauthorized (wrong password)
2. **Attempts 6+**: Return 429 Too Many Requests (rate limited)

## Customization

### Adjust Rate Limits

Edit `src/handlers/rate-limit.js`:

```javascript
export const RATE_LIMIT_CONFIG = {
  'auth_login': {
    windowMs: 15 * 60 * 1000,      // Change window size
    maxAttempts: 5,                // Change max attempts
    blockDurationMs: 30 * 60 * 1000, // Change block duration
    message: 'Custom error message'  // Change error message
  }
};
```

### Add Rate Limiting to New Endpoint

```javascript
import { rateLimitMiddleware } from './rate-limit.js';

export async function myNewHandler(request, env) {
  // Add rate limiting
  const rateLimitResponse = await rateLimitMiddleware(
    request,
    env,
    'api_general'  // or create custom config
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Your handler logic...
}
```

## API Functions

### rateLimitMiddleware(request, env, limitType, options)

Main middleware function.

**Parameters:**
- `request`: Incoming HTTP request
- `env`: Cloudflare Workers environment
- `limitType`: Key from `RATE_LIMIT_CONFIG`
- `options`: Optional object
  - `username`: For tracking by IP+username (login attempts)

**Returns:**
- `Response` object if blocked (429)
- `null` if allowed

### markFailedAttempt(env, identifier, endpoint, request)

Mark a failed attempt (e.g., wrong password).

### markSuccessfulAttempt(env, identifier, endpoint, request)

Mark a successful attempt (e.g., successful login).

### cleanupOldRateLimitRecords(env)

Manually trigger cleanup of old records.

### getRateLimitStatus(env, identifier, endpoint)

Get current rate limit status for monitoring.

## Security Considerations

### Strengths
✅ Database-backed (persistent across worker instances)
✅ Configurable per endpoint type
✅ Tracks both IP and username for login attempts
✅ Automatic cleanup prevents database bloat
✅ Violation logging for monitoring
✅ Graceful failure (fails open on errors)

### Potential Improvements
- [ ] Add CAPTCHA after multiple failed attempts
- [ ] Implement progressive delays (exponential backoff)
- [ ] Add allowlist/blocklist for IPs
- [ ] Integrate with abuse detection systems
- [ ] Add email/Slack alerts for violations
- [ ] Implement account lockout after repeated violations
- [ ] Add support for API key-based rate limiting

## Troubleshooting

### Rate Limiting Not Working

1. **Check tables exist**:
   ```bash
   wrangler d1 execute order-management-local-db --local --command="SELECT * FROM rate_limit_attempts LIMIT 1;"
   ```

2. **Check middleware is imported**:
   ```bash
   grep -r "rateLimitMiddleware" src/handlers/
   ```

3. **Check for errors in logs**:
   ```bash
   wrangler tail --env production
   ```

### False Positives (Legitimate Users Blocked)

- Review violations table to identify patterns
- Increase `maxAttempts` or `windowMs` for affected endpoints
- Add IP to allowlist (future enhancement)

### Performance Issues

- Monitor database query performance
- Ensure indexes are created (automatically done in migration)
- Adjust cleanup frequency if needed

## References

- **Migration File**: `rate_limit_migration.sql`
- **Middleware**: `src/handlers/rate-limit.js`
- **Auth Integration**: `src/handlers/auth.js`
- **User Management Integration**: `src/handlers/user-management.js`
- **Orders Integration**: `src/handlers/orders.js`

## Change Log

### 2025-11-09 - Initial Implementation
- Created database schema for rate limiting
- Implemented core middleware with configurable limits
- Applied to authentication, user management, and order endpoints
- Added violation logging and monitoring
- Implemented automatic cleanup
