import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, extractTokenFromHeader, JWTError } from '../utils/jwt.utils';
import { AuthService } from '../services/auth.service';
import type { AuthenticatedRequest, User } from '../types/auth.types';

/**
 * Extend Express Request type to include user data
 */
declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: string;
    }
  }
}

/**
 * Authentication middleware that verifies JWT tokens and adds user to request
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Extract token from Authorization header
    const token = extractTokenFromHeader(req.get('authorization'));

    if (!token) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'Access token is missing',
        code: 'TOKEN_MISSING',
      });
      return;
    }

    try {
      // Verify the token
      const decoded = verifyAccessToken(token);

      // Get user from database to ensure they still exist
      const user = await AuthService.getUserById(decoded.userId);

      if (!user) {
        res.status(401).json({
          error: 'Authentication failed',
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
        return;
      }

      // Add user data to request object
      req.user = user;
      req.userId = user.id;

      next();
    } catch (error) {
      if (error instanceof JWTError) {
        let message = 'Invalid token';
        const code = error.code;

        switch (error.code) {
          case 'TOKEN_EXPIRED':
            message = 'Token has expired';
            break;
          case 'INVALID_TOKEN':
            message = 'Token is invalid';
            break;
          case 'TOKEN_NOT_ACTIVE':
            message = 'Token is not yet active';
            break;
          default:
            message = error.message;
        }

        res.status(401).json({
          error: 'Authentication failed',
          message,
          code,
        });
        return;
      }

      throw error;
    }
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR',
    });
  }
}

/**
 * Optional authentication middleware that doesn't fail if no token is provided
 * But still verifies the token if present
 */
export async function optionalAuthenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      // No token provided, continue without authentication
      next();
      return;
    }

    try {
      const decoded = verifyAccessToken(token);
      const user = await AuthService.getUserById(decoded.userId);

      if (user) {
        req.user = user;
        req.userId = user.id;
      }

      next();
    } catch (error) {
      if (error instanceof JWTError) {
        // Token is invalid, but we don't fail the request
        // Just continue without setting user
        next();
        return;
      }

      throw error;
    }
  } catch (error) {
    console.error('Optional authentication middleware error:', error);
    // Don't fail the request for optional auth
    next();
  }
}

/**
 * Middleware to ensure the authenticated user can only access their own resources
 */
export function requireOwnership(userIdParam = 'userId') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !req.userId) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    const resourceUserId = req.params[userIdParam];

    if (!resourceUserId) {
      res.status(400).json({
        error: 'Bad request',
        message: `Missing ${userIdParam} parameter`,
        code: 'MISSING_USER_ID',
      });
      return;
    }

    if (req.userId !== resourceUserId) {
      res.status(403).json({
        error: 'Access denied',
        message: 'You can only access your own resources',
        code: 'ACCESS_DENIED',
      });
      return;
    }

    next();
  };
}

/**
 * Rate limiting middleware for authentication endpoints
 */
export function authRateLimit(req: Request, res: Response, next: NextFunction): void {
  // This is a placeholder for additional rate limiting on auth endpoints
  // In a production app, you might want stricter limits on login attempts

  // For now, just continue to the next middleware
  next();
}

/**
 * Middleware to log authentication events
 */
export function logAuthEvent(eventType: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    console.log(`Auth Event: ${eventType}`, {
      ip: clientIp,
      userAgent,
      timestamp: new Date().toISOString(),
      path: req.path,
    });

    next();
  };
}

/**
 * Middleware to add security headers for authentication responses
 */
export function authSecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Add security headers specific to auth endpoints
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  next();
}
