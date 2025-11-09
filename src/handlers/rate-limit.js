/**
 * Rate Limiting Middleware for Cloudflare Workers
 *
 * Implements rate limiting to protect against:
 * - Brute force attacks (login, password reset)
 * - API abuse
 * - DDoS attempts
 *
 * Features:
 * - Database-backed for persistence across worker instances
 * - Configurable limits per endpoint
 * - IP-based and username-based tracking
 * - Automatic cleanup of old records
 * - Violation logging for monitoring
 */

import { getClientInfo } from '../utils/admin-activity-logger.js';

/**
 * Rate limit configurations for different endpoint types
 *
 * Each configuration has:
 * - windowMs: Time window in milliseconds
 * - maxAttempts: Maximum attempts allowed in the window
 * - blockDurationMs: How long to block after exceeding limit
 */
export const RATE_LIMIT_CONFIG = {
  // Authentication endpoints - strictest limits
  'auth_login': {
    windowMs: 15 * 60 * 1000,      // 15 minutes
    maxAttempts: 5,                // 5 attempts
    blockDurationMs: 30 * 60 * 1000, // Block for 30 minutes
    message: 'Too many login attempts. Please try again in 30 minutes.'
  },

  'auth_register': {
    windowMs: 60 * 60 * 1000,      // 1 hour
    maxAttempts: 3,                // 3 attempts
    blockDurationMs: 60 * 60 * 1000, // Block for 1 hour
    message: 'Too many registration attempts. Please try again later.'
  },

  'password_reset': {
    windowMs: 60 * 60 * 1000,      // 1 hour
    maxAttempts: 3,                // 3 attempts
    blockDurationMs: 2 * 60 * 60 * 1000, // Block for 2 hours
    message: 'Too many password reset attempts. Please try again in 2 hours.'
  },

  // User management endpoints
  'user_create': {
    windowMs: 60 * 60 * 1000,      // 1 hour
    maxAttempts: 10,               // 10 attempts
    blockDurationMs: 30 * 60 * 1000, // Block for 30 minutes
    message: 'Too many user creation attempts. Please try again later.'
  },

  // Order creation endpoints
  'order_create': {
    windowMs: 60 * 60 * 1000,      // 1 hour
    maxAttempts: 50,               // 50 attempts
    blockDurationMs: 30 * 60 * 1000, // Block for 30 minutes
    message: 'Too many order creation attempts. Please slow down.'
  },

  // General API endpoints - moderate limits
  'api_general': {
    windowMs: 60 * 1000,           // 1 minute
    maxAttempts: 100,              // 100 requests per minute
    blockDurationMs: 5 * 60 * 1000,  // Block for 5 minutes
    message: 'Rate limit exceeded. Please slow down your requests.'
  },

  // Public endpoints - most lenient
  'public': {
    windowMs: 60 * 1000,           // 1 minute
    maxAttempts: 30,               // 30 requests per minute
    blockDurationMs: 2 * 60 * 1000,  // Block for 2 minutes
    message: 'Too many requests. Please try again shortly.'
  }
};

/**
 * Get client identifier for rate limiting
 * For login attempts, use IP + username
 * For other requests, use IP address only
 *
 * @param {Request} request - The incoming request
 * @param {Object} options - Additional options
 * @param {string} options.username - Username for login attempts
 * @returns {string} - Unique identifier for rate limiting
 */
function getIdentifier(request, options = {}) {
  const { ipAddress } = getClientInfo(request);

  if (options.username) {
    // For login attempts, track by IP + username to prevent brute force
    return `${ipAddress}:${options.username}`;
  }

  // For other requests, track by IP only
  return ipAddress;
}

/**
 * Check if a request is currently blocked
 *
 * @param {Object} env - Cloudflare Workers environment bindings
 * @param {string} identifier - Client identifier
 * @param {string} endpoint - API endpoint
 * @returns {Promise<Object|null>} - Block info if blocked, null otherwise
 */
async function checkIfBlocked(env, identifier, endpoint) {
  const now = new Date().toISOString();

  const blocked = await env.DB.prepare(`
    SELECT blocked_until, attempt_count
    FROM rate_limit_attempts
    WHERE identifier = ?
      AND endpoint = ?
      AND blocked_until IS NOT NULL
      AND blocked_until > ?
    ORDER BY blocked_until DESC
    LIMIT 1
  `).bind(identifier, endpoint, now).first();

  return blocked;
}

/**
 * Get current attempt count for a window
 *
 * @param {Object} env - Cloudflare Workers environment bindings
 * @param {string} identifier - Client identifier
 * @param {string} endpoint - API endpoint
 * @param {Date} windowStart - Start of the time window
 * @returns {Promise<number>} - Number of attempts in the window
 */
async function getCurrentAttempts(env, identifier, endpoint, windowStart) {
  const windowStartISO = windowStart.toISOString();

  const result = await env.DB.prepare(`
    SELECT COALESCE(SUM(attempt_count), 0) as total
    FROM rate_limit_attempts
    WHERE identifier = ?
      AND endpoint = ?
      AND window_start >= ?
  `).bind(identifier, endpoint, windowStartISO).first();

  return result?.total || 0;
}

/**
 * Record a rate limit attempt
 *
 * @param {Object} env - Cloudflare Workers environment bindings
 * @param {string} identifier - Client identifier
 * @param {string} endpoint - API endpoint
 * @param {string} attemptType - 'success' or 'failed'
 * @param {Request} request - The incoming request
 * @param {Date} windowStart - Start of the time window
 * @param {Date} blockedUntil - If blocked, when the block expires
 */
async function recordAttempt(env, identifier, endpoint, attemptType, request, windowStart, blockedUntil = null) {
  const { ipAddress, userAgent } = getClientInfo(request);
  const now = new Date().toISOString();
  const windowStartISO = windowStart.toISOString();
  const blockedUntilISO = blockedUntil ? blockedUntil.toISOString() : null;

  // Try to update existing record for this window
  const updated = await env.DB.prepare(`
    UPDATE rate_limit_attempts
    SET attempt_count = attempt_count + 1,
        last_attempt = ?,
        blocked_until = ?,
        updated_at = ?
    WHERE identifier = ?
      AND endpoint = ?
      AND window_start = ?
      AND attempt_type = ?
  `).bind(now, blockedUntilISO, now, identifier, endpoint, windowStartISO, attemptType).run();

  // If no record was updated, insert a new one
  if (!updated.meta.changes || updated.meta.changes === 0) {
    await env.DB.prepare(`
      INSERT INTO rate_limit_attempts
      (identifier, endpoint, attempt_type, window_start, attempt_count, last_attempt, ip_address, user_agent, blocked_until)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
    `).bind(identifier, endpoint, attemptType, windowStartISO, now, ipAddress, userAgent, blockedUntilISO).run();
  }
}

/**
 * Log a rate limit violation
 *
 * @param {Object} env - Cloudflare Workers environment bindings
 * @param {string} identifier - Client identifier
 * @param {string} endpoint - API endpoint
 * @param {string} violationType - Type of violation
 * @param {number} attemptCount - Number of attempts
 * @param {Request} request - The incoming request
 * @param {number} blockDurationMs - Block duration in milliseconds
 */
async function logViolation(env, identifier, endpoint, violationType, attemptCount, request, blockDurationMs) {
  const { ipAddress, userAgent } = getClientInfo(request);
  const blockDurationMinutes = Math.floor(blockDurationMs / 60000);

  await env.DB.prepare(`
    INSERT INTO rate_limit_violations
    (identifier, endpoint, violation_type, attempt_count, ip_address, user_agent, blocked_duration_minutes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(identifier, endpoint, violationType, attemptCount, ipAddress, userAgent, blockDurationMinutes).run();
}

/**
 * Clean up old rate limit records (older than 24 hours)
 * This should be called periodically to prevent database bloat
 *
 * @param {Object} env - Cloudflare Workers environment bindings
 */
export async function cleanupOldRateLimitRecords(env) {
  const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    await env.DB.prepare(`
      DELETE FROM rate_limit_attempts
      WHERE created_at < ?
        AND (blocked_until IS NULL OR blocked_until < ?)
    `).bind(cutoffDate, new Date().toISOString()).run();

    // Keep violations for 7 days for monitoring
    const violationsCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare(`
      DELETE FROM rate_limit_violations
      WHERE created_at < ?
    `).bind(violationsCutoff).run();
  } catch (error) {
    console.error('Failed to cleanup rate limit records:', error);
  }
}

/**
 * Main rate limiting middleware
 *
 * @param {Request} request - The incoming request
 * @param {Object} env - Cloudflare Workers environment bindings
 * @param {string} limitType - Type of rate limit to apply (key from RATE_LIMIT_CONFIG)
 * @param {Object} options - Additional options
 * @param {string} options.username - Username for login attempts
 * @returns {Promise<Response|null>} - Error response if rate limited, null if allowed
 */
export async function rateLimitMiddleware(request, env, limitType = 'api_general', options = {}) {
  try {
    const config = RATE_LIMIT_CONFIG[limitType];
    if (!config) {
      console.error(`Unknown rate limit type: ${limitType}`);
      return null; // Allow request if config not found
    }

    const identifier = getIdentifier(request, options);
    const endpoint = new URL(request.url).pathname;

    // Check if currently blocked
    const blockInfo = await checkIfBlocked(env, identifier, endpoint);
    if (blockInfo) {
      const blockedUntil = new Date(blockInfo.blocked_until);
      const minutesLeft = Math.ceil((blockedUntil - new Date()) / 60000);

      return new Response(JSON.stringify({
        success: false,
        error: config.message,
        blocked_until: blockInfo.blocked_until,
        minutes_remaining: minutesLeft,
        attempt_count: blockInfo.attempt_count
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((blockedUntil - new Date()) / 1000).toString()
        }
      });
    }

    // Calculate current window start
    const now = new Date();
    const windowStart = new Date(now.getTime() - config.windowMs);

    // Get current attempt count in this window
    const currentAttempts = await getCurrentAttempts(env, identifier, endpoint, windowStart);

    // Check if limit exceeded
    if (currentAttempts >= config.maxAttempts) {
      // Block the user
      const blockedUntil = new Date(now.getTime() + config.blockDurationMs);

      await recordAttempt(env, identifier, endpoint, 'failed', request, now, blockedUntil);
      await logViolation(env, identifier, endpoint, 'rate_exceeded', currentAttempts + 1, request, config.blockDurationMs);

      const minutesBlocked = Math.ceil(config.blockDurationMs / 60000);

      return new Response(JSON.stringify({
        success: false,
        error: config.message,
        blocked_until: blockedUntil.toISOString(),
        minutes_remaining: minutesBlocked,
        attempt_count: currentAttempts + 1
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil(config.blockDurationMs / 1000).toString()
        }
      });
    }

    // Record this attempt (will be marked as success/failed by the actual handler)
    await recordAttempt(env, identifier, endpoint, 'attempt', request, now);

    // Periodically cleanup old records (1% chance per request)
    if (Math.random() < 0.01) {
      // Run cleanup in background, don't await
      cleanupOldRateLimitRecords(env).catch(err =>
        console.error('Cleanup failed:', err)
      );
    }

    // Allow request
    return null;

  } catch (error) {
    console.error('Rate limit middleware error:', error);
    // On error, allow the request to proceed (fail open)
    return null;
  }
}

/**
 * Mark a failed attempt (e.g., wrong password)
 * Call this after a failed login attempt
 *
 * @param {Object} env - Cloudflare Workers environment bindings
 * @param {string} identifier - Client identifier
 * @param {string} endpoint - API endpoint
 * @param {Request} request - The incoming request
 */
export async function markFailedAttempt(env, identifier, endpoint, request) {
  try {
    const now = new Date();
    await recordAttempt(env, identifier, endpoint, 'failed', request, now);
  } catch (error) {
    console.error('Failed to mark failed attempt:', error);
  }
}

/**
 * Mark a successful attempt (e.g., successful login)
 * This can be used to reset counters or track successful authentications
 *
 * @param {Object} env - Cloudflare Workers environment bindings
 * @param {string} identifier - Client identifier
 * @param {string} endpoint - API endpoint
 * @param {Request} request - The incoming request
 */
export async function markSuccessfulAttempt(env, identifier, endpoint, request) {
  try {
    const now = new Date();
    await recordAttempt(env, identifier, endpoint, 'success', request, now);
  } catch (error) {
    console.error('Failed to mark successful attempt:', error);
  }
}

/**
 * Get rate limit status for monitoring
 *
 * @param {Object} env - Cloudflare Workers environment bindings
 * @param {string} identifier - Client identifier
 * @param {string} endpoint - API endpoint
 * @returns {Promise<Object>} - Current rate limit status
 */
export async function getRateLimitStatus(env, identifier, endpoint) {
  try {
    const blockInfo = await checkIfBlocked(env, identifier, endpoint);

    if (blockInfo) {
      return {
        blocked: true,
        blocked_until: blockInfo.blocked_until,
        attempt_count: blockInfo.attempt_count
      };
    }

    const windowStart = new Date(Date.now() - 15 * 60 * 1000); // Last 15 minutes
    const attempts = await getCurrentAttempts(env, identifier, endpoint, windowStart);

    return {
      blocked: false,
      recent_attempts: attempts
    };
  } catch (error) {
    console.error('Failed to get rate limit status:', error);
    return { error: 'Failed to get status' };
  }
}
