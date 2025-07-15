import {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  extractTokenFromHeader,
  getTokenExpirationTime,
  isTokenExpired,
  decodeTokenUnsafe,
  JWTError,
} from '../../../src/utils/jwt.utils';
import { JWTPayload } from '../../../src/types/auth.types';
import { generateTestEmail } from '../../factories/user.factory';

describe('JWT Utils', () => {
  const testUserId = 'test-user-id';
  const testEmail = generateTestEmail();

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = generateAccessToken(testUserId, testEmail);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should generate different tokens for different users', () => {
      const token1 = generateAccessToken('user1', 'user1@example.com');
      const token2 = generateAccessToken('user2', 'user2@example.com');

      expect(token1).not.toBe(token2);
    });

    it('should create tokens with correct payload', () => {
      const token = generateAccessToken(testUserId, testEmail);
      const decoded = decodeTokenUnsafe(token);

      expect(decoded?.userId).toBe(testUserId);
      expect(decoded?.email).toBe(testEmail);
      expect(decoded?.type).toBe('access');
    });

    it('should handle special characters in email', () => {
      const specialEmail = 'user+tag@domain.co.uk';
      const token = generateAccessToken(testUserId, specialEmail);
      const decoded = decodeTokenUnsafe(token);

      expect(decoded?.email).toBe(specialEmail);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = generateRefreshToken(testUserId, testEmail);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should create tokens with correct payload', () => {
      const token = generateRefreshToken(testUserId, testEmail);
      const decoded = decodeTokenUnsafe(token);

      expect(decoded?.userId).toBe(testUserId);
      expect(decoded?.email).toBe(testEmail);
      expect(decoded?.type).toBe('refresh');
    });

    it('should generate different tokens than access tokens', () => {
      const accessToken = generateAccessToken(testUserId, testEmail);
      const refreshToken = generateRefreshToken(testUserId, testEmail);

      expect(accessToken).not.toBe(refreshToken);
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', () => {
      const tokens = generateTokenPair(testUserId, testEmail);

      expect(tokens.accessToken).toBeTruthy();
      expect(tokens.refreshToken).toBeTruthy();
      expect(tokens.expiresIn).toBeTruthy();
    });

    it('should generate different access and refresh tokens', () => {
      const tokens = generateTokenPair(testUserId, testEmail);

      expect(tokens.accessToken).not.toBe(tokens.refreshToken);
    });

    it('should have correct token types', () => {
      const tokens = generateTokenPair(testUserId, testEmail);

      const accessDecoded = decodeTokenUnsafe(tokens.accessToken);
      const refreshDecoded = decodeTokenUnsafe(tokens.refreshToken);

      expect(accessDecoded?.type).toBe('access');
      expect(refreshDecoded?.type).toBe('refresh');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const token = generateAccessToken(testUserId, testEmail);

      const decoded = verifyAccessToken(token);

      expect(decoded.userId).toBe(testUserId);
      expect(decoded.email).toBe(testEmail);
      expect(decoded.type).toBe('access');
    });

    it('should throw error for invalid token', () => {
      expect(() => verifyAccessToken('invalid-token')).toThrow(JWTError);
    });

    it('should throw error for malformed token', () => {
      expect(() => verifyAccessToken('malformed.token')).toThrow(JWTError);
    });

    it('should throw error for empty token', () => {
      expect(() => verifyAccessToken('')).toThrow(JWTError);
    });

    it('should throw error for refresh token used as access token', () => {
      const refreshToken = generateRefreshToken(testUserId, testEmail);

      expect(() => verifyAccessToken(refreshToken)).toThrow(JWTError);
    });

    it('should throw error for tampered token', () => {
      const token = generateAccessToken(testUserId, testEmail);
      const parts = token.split('.');
      parts[2] = 'tamperedsignature';
      const tamperedToken = parts.join('.');

      expect(() => verifyAccessToken(tamperedToken)).toThrow(JWTError);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const token = generateRefreshToken(testUserId, testEmail);

      const decoded = verifyRefreshToken(token);

      expect(decoded.userId).toBe(testUserId);
      expect(decoded.email).toBe(testEmail);
      expect(decoded.type).toBe('refresh');
    });

    it('should throw error for invalid token', () => {
      expect(() => verifyRefreshToken('invalid-token')).toThrow(JWTError);
    });

    it('should throw error for access token used as refresh token', () => {
      const accessToken = generateAccessToken(testUserId, testEmail);

      expect(() => verifyRefreshToken(accessToken)).toThrow(JWTError);
    });

    it('should throw error for tampered token', () => {
      const token = generateRefreshToken(testUserId, testEmail);
      const parts = token.split('.');
      parts[2] = 'tamperedsignature';
      const tamperedToken = parts.join('.');

      expect(() => verifyRefreshToken(tamperedToken)).toThrow(JWTError);
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Authorization header', () => {
      const token = 'valid-token';
      const header = `Bearer ${token}`;

      const extracted = extractTokenFromHeader(header);

      expect(extracted).toBe(token);
    });

    it('should return null for missing header', () => {
      const extracted = extractTokenFromHeader(undefined);

      expect(extracted).toBeNull();
    });

    it('should return null for empty header', () => {
      const extracted = extractTokenFromHeader('');

      expect(extracted).toBeNull();
    });

    it('should return null for invalid format', () => {
      const extracted = extractTokenFromHeader('InvalidFormat token');

      expect(extracted).toBeNull();
    });

    it('should return null for missing Bearer prefix', () => {
      const extracted = extractTokenFromHeader('token-without-bearer');

      expect(extracted).toBeNull();
    });

    it('should return null for missing token', () => {
      const extracted = extractTokenFromHeader('Bearer');

      expect(extracted).toBeNull();
    });

    it('should handle extra spaces correctly', () => {
      const token = 'valid-token';
      const header = `Bearer  ${token}`;

      const extracted = extractTokenFromHeader(header);

      expect(extracted).toBe(token);
    });
  });

  describe('getTokenExpirationTime', () => {
    it('should return expiration time for valid token', () => {
      const token = generateAccessToken(testUserId, testEmail);

      const exp = getTokenExpirationTime(token);

      expect(exp).toBeTruthy();
      expect(typeof exp).toBe('number');
      expect(exp).toBeGreaterThan(Date.now() / 1000);
    });

    it('should return null for invalid token', () => {
      const exp = getTokenExpirationTime('invalid-token');

      expect(exp).toBeNull();
    });

    it('should return null for malformed token', () => {
      const exp = getTokenExpirationTime('malformed.token');

      expect(exp).toBeNull();
    });

    it('should return null for empty token', () => {
      const exp = getTokenExpirationTime('');

      expect(exp).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid unexpired token', () => {
      const token = generateAccessToken(testUserId, testEmail);

      const expired = isTokenExpired(token);

      expect(expired).toBe(false);
    });

    it('should return true for invalid token', () => {
      const expired = isTokenExpired('invalid-token');

      expect(expired).toBe(true);
    });

    it('should return true for malformed token', () => {
      const expired = isTokenExpired('malformed.token');

      expect(expired).toBe(true);
    });

    it('should return true for empty token', () => {
      const expired = isTokenExpired('');

      expect(expired).toBe(true);
    });
  });

  describe('decodeTokenUnsafe', () => {
    it('should decode a valid token', () => {
      const token = generateAccessToken(testUserId, testEmail);

      const decoded = decodeTokenUnsafe(token);

      expect(decoded?.userId).toBe(testUserId);
      expect(decoded?.email).toBe(testEmail);
      expect(decoded?.type).toBe('access');
    });

    it('should return null for invalid token', () => {
      const decoded = decodeTokenUnsafe('invalid-token');

      expect(decoded).toBeNull();
    });

    it('should return null for malformed token', () => {
      const decoded = decodeTokenUnsafe('malformed.token');

      expect(decoded).toBeNull();
    });

    it('should return null for empty token', () => {
      const decoded = decodeTokenUnsafe('');

      expect(decoded).toBeNull();
    });

    it('should decode without verification', () => {
      const token = generateAccessToken(testUserId, testEmail);
      const parts = token.split('.');
      parts[2] = 'tamperedsignature';
      const tamperedToken = parts.join('.');

      // Should still decode payload even with invalid signature
      const decoded = decodeTokenUnsafe(tamperedToken);

      expect(decoded?.userId).toBe(testUserId);
      expect(decoded?.email).toBe(testEmail);
    });
  });

  describe('JWTError', () => {
    it('should create error with message and code', () => {
      const error = new JWTError('Test error', 'TEST_ERROR');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.name).toBe('JWTError');
    });

    it('should be instance of Error', () => {
      const error = new JWTError('Test error', 'TEST_ERROR');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof JWTError).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should generate, verify, and decode token correctly', () => {
      const tokens = generateTokenPair(testUserId, testEmail);

      // Verify access token
      const accessDecoded = verifyAccessToken(tokens.accessToken);
      expect(accessDecoded.userId).toBe(testUserId);
      expect(accessDecoded.email).toBe(testEmail);
      expect(accessDecoded.type).toBe('access');

      // Verify refresh token
      const refreshDecoded = verifyRefreshToken(tokens.refreshToken);
      expect(refreshDecoded.userId).toBe(testUserId);
      expect(refreshDecoded.email).toBe(testEmail);
      expect(refreshDecoded.type).toBe('refresh');
    });

    it('should handle complete authorization flow', () => {
      const authHeader = `Bearer ${generateAccessToken(testUserId, testEmail)}`;

      const extractedToken = extractTokenFromHeader(authHeader);
      expect(extractedToken).toBeTruthy();

      const decoded = verifyAccessToken(extractedToken!);
      expect(decoded.userId).toBe(testUserId);
      expect(decoded.email).toBe(testEmail);
    });

    it('should handle token expiration checking', () => {
      const token = generateAccessToken(testUserId, testEmail);

      expect(isTokenExpired(token)).toBe(false);

      const exp = getTokenExpirationTime(token);
      expect(exp).toBeGreaterThan(Date.now() / 1000);

      const decoded = decodeTokenUnsafe(token);
      expect(decoded?.exp).toBe(exp);
    });
  });

  describe('Error Handling', () => {
    it('should handle various error types in access token verification', () => {
      // Invalid token
      expect(() => verifyAccessToken('invalid')).toThrow(JWTError);

      // Malformed token
      expect(() => verifyAccessToken('malformed.token')).toThrow(JWTError);

      // Empty token
      expect(() => verifyAccessToken('')).toThrow(JWTError);

      // Wrong token type
      const refreshToken = generateRefreshToken(testUserId, testEmail);
      expect(() => verifyAccessToken(refreshToken)).toThrow(JWTError);
    });

    it('should handle various error types in refresh token verification', () => {
      // Invalid token
      expect(() => verifyRefreshToken('invalid')).toThrow(JWTError);

      // Malformed token
      expect(() => verifyRefreshToken('malformed.token')).toThrow(JWTError);

      // Empty token
      expect(() => verifyRefreshToken('')).toThrow(JWTError);

      // Wrong token type
      const accessToken = generateAccessToken(testUserId, testEmail);
      expect(() => verifyRefreshToken(accessToken)).toThrow(JWTError);
    });
  });

  describe('Security Tests', () => {
    it('should not accept tokens with tampered payloads', () => {
      const token = generateAccessToken(testUserId, testEmail);
      const parts = token.split('.');

      // Tamper with payload
      const tamperedPayload = Buffer.from(
        JSON.stringify({
          userId: 'tampered-user-id',
          email: 'tampered@example.com',
          type: 'access',
        })
      ).toString('base64');

      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      expect(() => verifyAccessToken(tamperedToken)).toThrow(JWTError);
    });

    it('should not accept tokens with no signature', () => {
      const token = generateAccessToken(testUserId, testEmail);
      const parts = token.split('.');

      const tokenWithoutSignature = `${parts[0]}.${parts[1]}.`;

      expect(() => verifyAccessToken(tokenWithoutSignature)).toThrow(JWTError);
    });

    it('should enforce token type restrictions', () => {
      const accessToken = generateAccessToken(testUserId, testEmail);
      const refreshToken = generateRefreshToken(testUserId, testEmail);

      // Access token should not work for refresh verification
      expect(() => verifyRefreshToken(accessToken)).toThrow(JWTError);

      // Refresh token should not work for access verification
      expect(() => verifyAccessToken(refreshToken)).toThrow(JWTError);
    });
  });
});
