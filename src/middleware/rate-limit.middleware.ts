import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Enhanced Rate Limiting Middleware
 * Implements tiered rate limiting with different rules for different endpoint types
 */

// Store for tracking failed attempts (in production, use Redis)
const failedAttempts = new Map<string, { count: number; resetTime: number }>();
const suspiciousIPs = new Set<string>();

/**
 * Get client IP address with proxy support
 */
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];

  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || req.ip || '127.0.0.1';
  }

  if (realIP && typeof realIP === 'string') {
    return realIP;
  }

  return req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip || 'unknown';
}

/**
 * Custom rate limit handler with security logging
 */
function rateLimitHandler(req: Request, res: Response) {
  const ip = getClientIP(req);
  const userAgent = (req.headers['user-agent'] as string) || 'unknown';

  // Log rate limit violation
  console.warn('🚨 Rate Limit Exceeded', {
    ip,
    userAgent,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Track suspicious IPs
  suspiciousIPs.add(ip);

  // Send security-conscious error response
  res.status(429).json({
    success: false,
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: Math.ceil(60000 / 1000), // 60 seconds
  });
}

/**
 * Skip rate limiting for certain conditions
 */
function skipRateLimit(req: Request): boolean {
  const ip = getClientIP(req);

  // Skip for health checks
  if (req.path.startsWith('/health')) {
    return true;
  }

  // Skip for localhost in development
  if (process.env.NODE_ENV === 'development' && (ip === '127.0.0.1' || ip === '::1')) {
    return true;
  }

  return false;
}

/**
 * Strict rate limiting for authentication endpoints
 * More restrictive due to security sensitivity
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts',
    message: 'Too many login attempts from this IP. Please try again in 15 minutes.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: rateLimitHandler,
  skip: skipRateLimit,
  keyGenerator: getClientIP,
});

/**
 * Standard rate limiting for general API endpoints
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests',
    message: 'API rate limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipRateLimit,
  keyGenerator: getClientIP,
});

/**
 * Aggressive rate limiting for password reset endpoints
 */
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  message: {
    success: false,
    error: 'Too many password reset attempts',
    message: 'Too many password reset attempts. Please try again in 1 hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipRateLimit,
  keyGenerator: getClientIP,
});

/**
 * Lenient rate limiting for read-only endpoints
 */
export const readOnlyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Higher limit for read operations
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Read API rate limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipRateLimit,
  keyGenerator: getClientIP,
});

/**
 * Track failed authentication attempts for account lockout
 */
export function trackFailedAttempt(identifier: string): {
  isLocked: boolean;
  attemptsLeft: number;
} {
  const now = Date.now();
  const lockoutDuration = 30 * 60 * 1000; // 30 minutes
  const maxAttempts = 5;

  const attempts = failedAttempts.get(identifier) || { count: 0, resetTime: now + lockoutDuration };

  // Reset if lockout period has passed
  if (now > attempts.resetTime) {
    attempts.count = 0;
    attempts.resetTime = now + lockoutDuration;
  }

  attempts.count++;
  failedAttempts.set(identifier, attempts);

  const isLocked = attempts.count >= maxAttempts;
  const attemptsLeft = Math.max(0, maxAttempts - attempts.count);

  if (isLocked) {
    console.warn('🔒 Account Lockout Triggered', {
      identifier,
      attempts: attempts.count,
      lockoutUntil: new Date(attempts.resetTime).toISOString(),
      timestamp: new Date().toISOString(),
    });
  }

  return { isLocked, attemptsLeft };
}

/**
 * Clear failed attempts on successful authentication
 */
export function clearFailedAttempts(identifier: string): void {
  failedAttempts.delete(identifier);
}

/**
 * Check if an identifier is currently locked out
 */
export function isLockedOut(identifier: string): boolean {
  const attempts = failedAttempts.get(identifier);
  if (!attempts) return false;

  const now = Date.now();

  // Reset if lockout period has passed
  if (now > attempts.resetTime) {
    failedAttempts.delete(identifier);
    return false;
  }

  return attempts.count >= 5;
}

/**
 * Get suspicious IPs for monitoring
 */
export function getSuspiciousIPs(): string[] {
  return Array.from(suspiciousIPs);
}

/**
 * Clear suspicious IP tracking (for maintenance)
 */
export function clearSuspiciousIPs(): void {
  suspiciousIPs.clear();
}

/**
 * Get failed attempts statistics
 */
export function getFailedAttemptsStats(): {
  totalActiveAttempts: number;
  lockedAccounts: number;
  suspiciousIPs: number;
} {
  const now = Date.now();
  let totalActiveAttempts = 0;
  let lockedAccounts = 0;

  for (const [, attempts] of failedAttempts.entries()) {
    if (now <= attempts.resetTime) {
      totalActiveAttempts++;
      if (attempts.count >= 5) {
        lockedAccounts++;
      }
    }
  }

  return {
    totalActiveAttempts,
    lockedAccounts,
    suspiciousIPs: suspiciousIPs.size,
  };
}
