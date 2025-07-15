import cors from 'cors';
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

/**
 * Comprehensive Security Middleware
 * Implements production-ready security headers and CORS configuration
 */

/**
 * Enhanced CORS configuration with environment-specific settings
 */
const corsOptions: cors.CorsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    // Development - allow localhost
    if (process.env.NODE_ENV === 'development') {
      const allowedDomains = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://localhost:5173', // Vite default
        'http://localhost:4173', // Vite preview
        'http://localhost:5174', // Common dev ports
        'http://localhost:5175',
        'http://localhost:5176',
        'http://localhost:5177',
        'http://localhost:5178',
        'http://localhost:5179',
      ];

      if (allowedDomains.includes(origin)) {
        return callback(null, true);
      }
    }

    // Production - restrict to specific domains
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Log and reject unauthorized origins
    console.warn('🚨 CORS Origin Blocked', {
      origin,
      timestamp: new Date().toISOString(),
    });

    callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true, // Allow cookies for authentication
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-CSRF-Token',
  ],
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  maxAge: 86400, // 24 hours preflight cache
};

/**
 * Enhanced Helmet configuration for security headers
 */
const helmetOptions = {
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for development
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },

  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },

  // Disable X-Powered-By header
  hidePoweredBy: true,

  // X-Content-Type-Options
  noSniff: true,

  // X-Frame-Options
  frameguard: { action: 'deny' as const },

  // X-XSS-Protection
  xssFilter: true,

  // Referrer Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' as const },

  // Cross-Origin-Embedder-Policy
  crossOriginEmbedderPolicy: false, // Disable for API

  // Cross-Origin-Opener-Policy
  crossOriginOpenerPolicy: { policy: 'same-origin' as const },

  // Cross-Origin-Resource-Policy
  crossOriginResourcePolicy: { policy: 'cross-origin' as const },
};

/**
 * Request size limiting middleware
 */
export function requestSizeLimiter(req: Request, res: Response, next: NextFunction): void {
  const maxSize = 10 * 1024 * 1024; // 10MB

  // Check Content-Length header
  const contentLength = req.headers['content-length'];
  if (contentLength && parseInt(contentLength) > maxSize) {
    console.warn('🚨 Request Size Exceeded', {
      contentLength,
      maxSize,
      ip: req.ip,
      path: req.path,
      timestamp: new Date().toISOString(),
    });

    res.status(413).json({
      success: false,
      error: 'Payload too large',
      message: 'Request size exceeds maximum allowed limit',
      maxSize: '10MB',
    });
    return;
  }

  next();
}

/**
 * Security headers middleware for additional protection
 */
export function additionalSecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent caching of sensitive data
  if (req.path.includes('/auth') || req.path.includes('/api')) {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      Expires: '0',
    });
  }

  // Add custom security headers
  res.set({
    'X-API-Version': '1.0.0',
    'X-Content-Type-Options': 'nosniff',
    'X-Download-Options': 'noopen',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  });

  next();
}

/**
 * Input sanitization middleware
 */
export function inputSanitizer(req: Request, res: Response, next: NextFunction): void {
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  next();
}

/**
 * Recursively sanitize object properties
 */
function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return typeof obj === 'string' ? sanitizeString(obj) : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = sanitizeString(key);
    sanitized[sanitizedKey] = sanitizeObject(value);
  }

  return sanitized;
}

/**
 * Sanitize string input to prevent XSS
 */
function sanitizeString(str: string): string {
  if (typeof str !== 'string') return str;

  return str
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
}

/**
 * SQL injection prevention middleware (additional layer)
 */
export function sqlInjectionProtection(req: Request, res: Response, next: NextFunction): void {
  const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(UNION\s+SELECT)/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /('|\"|;|--|\|)/,
    /(\bSCRIPT\b)/i,
  ];

  const checkForSQLInjection = (value: string): boolean => {
    return suspiciousPatterns.some((pattern) => pattern.test(value));
  };

  const scanObject = (obj: any, path = ''): boolean => {
    if (typeof obj === 'string') {
      return checkForSQLInjection(obj);
    }

    if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (scanObject(value, `${path}.${key}`)) {
          return true;
        }
      }
    }

    return false;
  };

  // Check request body
  if (req.body && scanObject(req.body)) {
    console.warn('🚨 Potential SQL Injection Detected', {
      ip: req.ip,
      path: req.path,
      body: req.body,
      timestamp: new Date().toISOString(),
    });

    res.status(400).json({
      success: false,
      error: 'Invalid input detected',
      message: 'Request contains potentially harmful content',
    });
    return;
  }

  // Check query parameters
  if (req.query && scanObject(req.query)) {
    console.warn('🚨 Potential SQL Injection Detected in Query', {
      ip: req.ip,
      path: req.path,
      query: req.query,
      timestamp: new Date().toISOString(),
    });

    res.status(400).json({
      success: false,
      error: 'Invalid query parameters',
      message: 'Query contains potentially harmful content',
    });
    return;
  }

  next();
}

/**
 * Configure and export CORS middleware
 */
export const corsMiddleware = cors(corsOptions);

/**
 * Configure and export Helmet middleware
 */
export const helmetMiddleware = helmet(helmetOptions);

/**
 * API request logging middleware for security monitoring
 */
export function securityLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Log sensitive endpoints
  const sensitiveEndpoints = ['/auth', '/login', '/register', '/password'];
  const isSensitive = sensitiveEndpoints.some((endpoint) => req.path.includes(endpoint));

  if (isSensitive) {
    console.log('🔒 Security-Sensitive Request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    });
  }

  // Track response time and status
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    if (res.statusCode >= 400) {
      console.warn('⚠️ Error Response', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });
    }
  });

  next();
}
