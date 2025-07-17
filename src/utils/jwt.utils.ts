import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/app.config';
import type { JWTPayload } from '../types/auth.types';

export class JWTError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'JWTError';
  }
}

/**
 * Generate an access token for a user
 */
export function generateAccessToken(userId: string, email: string): string {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId,
    email,
    type: 'access',
  };

  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
    issuer: 'bloomtech-work-tracker',
    audience: 'bloomtech-work-tracker-api',
  } as jwt.SignOptions);
}

/**
 * Generate a refresh token for a user
 */
export function generateRefreshToken(userId: string, email: string): string {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId,
    email,
    type: 'refresh',
  };

  return jwt.sign(payload, jwtConfig.refreshSecret, {
    expiresIn: jwtConfig.refreshExpiresIn,
    issuer: 'bloomtech-work-tracker',
    audience: 'bloomtech-work-tracker-api',
  } as jwt.SignOptions);
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokenPair(
  userId: string,
  email: string
): {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
} {
  return {
    accessToken: generateAccessToken(userId, email),
    refreshToken: generateRefreshToken(userId, email),
    expiresIn: jwtConfig.expiresIn,
  };
}

/**
 * Verify and decode an access token
 */
export function verifyAccessToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, jwtConfig.secret, {
      issuer: 'bloomtech-work-tracker',
      audience: 'bloomtech-work-tracker-api',
    }) as JWTPayload;

    if (decoded.type !== 'access') {
      throw new JWTError('Invalid token type', 'INVALID_TOKEN_TYPE');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new JWTError('Invalid token', 'INVALID_TOKEN');
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new JWTError('Token expired', 'TOKEN_EXPIRED');
    }
    if (error instanceof jwt.NotBeforeError) {
      throw new JWTError('Token not active', 'TOKEN_NOT_ACTIVE');
    }
    throw error;
  }
}

/**
 * Verify and decode a refresh token
 */
export function verifyRefreshToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, jwtConfig.refreshSecret, {
      issuer: 'bloomtech-work-tracker',
      audience: 'bloomtech-work-tracker-api',
    }) as JWTPayload;

    if (decoded.type !== 'refresh') {
      throw new JWTError('Invalid token type', 'INVALID_TOKEN_TYPE');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new JWTError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new JWTError('Refresh token expired', 'REFRESH_TOKEN_EXPIRED');
    }
    if (error instanceof jwt.NotBeforeError) {
      throw new JWTError('Refresh token not active', 'REFRESH_TOKEN_NOT_ACTIVE');
    }
    throw error;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authorizationHeader?: string): string | null {
  if (!authorizationHeader) {
    return null;
  }

  // Split by one or more spaces and filter out empty strings
  const parts = authorizationHeader.split(/\s+/).filter((part) => part.length > 0);
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1] || null;
}

/**
 * Get token expiration time in seconds
 */
export function getTokenExpirationTime(token: string): number | null {
  try {
    const decoded = jwt.decode(token) as JWTPayload | null;
    return decoded?.exp || null;
  } catch {
    return null;
  }
}

/**
 * Check if token is expired (without verifying signature)
 */
export function isTokenExpired(token: string): boolean {
  const exp = getTokenExpirationTime(token);
  if (!exp) return true;

  return Date.now() >= exp * 1000;
}

/**
 * Decode token without verification (for debugging/logging)
 */
export function decodeTokenUnsafe(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}
