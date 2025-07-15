import {
  hashPassword,
  verifyPassword,
  generateSecurePassword,
  checkPasswordStrength,
  generateResetToken,
} from '../../../src/utils/password.utils';

describe('Password Utils', () => {
  describe('hashPassword', () => {
    it('should hash a password successfully', async () => {
      const password = 'TestPassword123!';

      const hashedPassword = await hashPassword(password);

      expect(hashedPassword).toBeTruthy();
      expect(typeof hashedPassword).toBe('string');
      expect(hashedPassword).not.toBe(password);
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'TestPassword123!';

      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should produce consistent hash length', async () => {
      const password = 'TestPassword123!';

      const hashedPassword = await hashPassword(password);

      expect(hashedPassword.length).toBe(60); // bcrypt hash length
    });

    it('should handle empty password', async () => {
      const password = '';

      const hashedPassword = await hashPassword(password);

      expect(hashedPassword).toBeTruthy();
      expect(typeof hashedPassword).toBe('string');
    });

    it('should handle special characters', async () => {
      const password = '!@#$%^&*()_+-=Test123';

      const hashedPassword = await hashPassword(password);

      expect(hashedPassword).toBeTruthy();
      expect(typeof hashedPassword).toBe('string');
    });

    it('should handle long passwords', async () => {
      const password = 'A'.repeat(100) + 'Test123!';

      const hashedPassword = await hashPassword(password);

      expect(hashedPassword).toBeTruthy();
      expect(typeof hashedPassword).toBe('string');
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await hashPassword(password);

      const isMatch = await verifyPassword(password, hashedPassword);

      expect(isMatch).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const correctPassword = 'TestPassword123!';
      const incorrectPassword = 'WrongPassword123!';
      const hashedPassword = await hashPassword(correctPassword);

      const isMatch = await verifyPassword(incorrectPassword, hashedPassword);

      expect(isMatch).toBe(false);
    });

    it('should return false for empty password', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await hashPassword(password);

      const isMatch = await verifyPassword('', hashedPassword);

      expect(isMatch).toBe(false);
    });

    it('should handle case sensitivity', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await hashPassword(password);

      const isMatch = await verifyPassword('testpassword123!', hashedPassword);

      expect(isMatch).toBe(false);
    });

    it('should handle special characters correctly', async () => {
      const password = '!@#$%^&*()Test123';
      const hashedPassword = await hashPassword(password);

      const isMatch = await verifyPassword(password, hashedPassword);

      expect(isMatch).toBe(true);
    });

    it('should return false for malformed hash', async () => {
      const password = 'TestPassword123!';
      const malformedHash = 'not-a-valid-hash';

      const isMatch = await verifyPassword(password, malformedHash);

      expect(isMatch).toBe(false);
    });

    it('should handle empty hash', async () => {
      const password = 'TestPassword123!';

      const isMatch = await verifyPassword(password, '');

      expect(isMatch).toBe(false);
    });
  });

  describe('generateSecurePassword', () => {
    it('should generate password with default length', () => {
      const password = generateSecurePassword();

      expect(password).toBeTruthy();
      expect(typeof password).toBe('string');
      expect(password.length).toBe(16);
    });

    it('should generate password with custom length', () => {
      const length = 24;
      const password = generateSecurePassword(length);

      expect(password.length).toBe(length);
    });

    it('should generate different passwords each time', () => {
      const password1 = generateSecurePassword();
      const password2 = generateSecurePassword();

      expect(password1).not.toBe(password2);
    });

    it('should contain required character types', () => {
      const password = generateSecurePassword(20);

      expect(password).toMatch(/[a-z]/); // lowercase
      expect(password).toMatch(/[A-Z]/); // uppercase
      expect(password).toMatch(/[0-9]/); // numbers
      expect(password).toMatch(/[!@#$%^&*]/); // special characters
    });

    it('should handle minimum length', () => {
      const password = generateSecurePassword(8);

      expect(password.length).toBe(8);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!@#$%^&*]/);
    });

    it('should handle large length', () => {
      const password = generateSecurePassword(50);

      expect(password.length).toBe(50);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!@#$%^&*]/);
    });
  });

  describe('checkPasswordStrength', () => {
    it('should validate a strong password', () => {
      const password = 'StrongPassword19!';

      const result = checkPasswordStrength(password);

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(5);
      expect(result.feedback).toHaveLength(0);
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        'weak',
        'password',
        '12345678',
        'PASSWORD',
        'password123',
        'Password123',
      ];

      weakPasswords.forEach((password) => {
        const result = checkPasswordStrength(password);
        expect(result.isValid).toBe(false);
        expect(result.feedback.length).toBeGreaterThan(0);
      });
    });

    it('should provide feedback for missing requirements', () => {
      const password = 'weakpassword';

      const result = checkPasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain('Password must contain uppercase letters');
      expect(result.feedback).toContain('Password must contain numbers');
      expect(result.feedback).toContain('Password must contain special characters');
    });

    it('should reject passwords with repeated characters', () => {
      const password = 'Passsssword123!';

      const result = checkPasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain('Password should not contain repeated characters');
    });

    it('should reject passwords with sequential characters', () => {
      const passwords = ['Password123!abc', 'Password123!xyz', 'Password123!456'];

      passwords.forEach((password) => {
        const result = checkPasswordStrength(password);
        expect(result.isValid).toBe(false);
        expect(result.feedback).toContain('Password should not contain sequential characters');
      });
    });

    it('should give higher scores to longer passwords', () => {
      const shortPassword = 'Pass123!';
      const longPassword = 'VeryLongPassword123!';

      const shortResult = checkPasswordStrength(shortPassword);
      const longResult = checkPasswordStrength(longPassword);

      expect(longResult.score).toBeGreaterThan(shortResult.score);
    });
  });

  describe('generateResetToken', () => {
    it('should generate token with correct length', () => {
      const token = generateResetToken();

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(32);
    });

    it('should generate different tokens each time', () => {
      const token1 = generateResetToken();
      const token2 = generateResetToken();

      expect(token1).not.toBe(token2);
    });

    it('should contain only alphanumeric characters', () => {
      const token = generateResetToken();

      expect(token).toMatch(/^[A-Za-z0-9]+$/);
    });

    it('should generate multiple unique tokens', () => {
      const tokens = Array.from({ length: 10 }, () => generateResetToken());
      const uniqueTokens = new Set(tokens);

      expect(uniqueTokens.size).toBe(10);
    });
  });

  describe('Integration Tests', () => {
    it('should work with complete password flow', async () => {
      const password = 'TestIntegration19!';

      // Check strength
      const strength = checkPasswordStrength(password);
      expect(strength.isValid).toBe(true);

      // Hash password
      const hashedPassword = await hashPassword(password);
      expect(hashedPassword).toBeTruthy();

      // Verify password
      const isMatch = await verifyPassword(password, hashedPassword);
      expect(isMatch).toBe(true);

      // Verify wrong password fails
      const wrongMatch = await verifyPassword('WrongPassword123!', hashedPassword);
      expect(wrongMatch).toBe(false);
    });

    it('should handle generated secure password', async () => {
      const password = generateSecurePassword();

      // Check strength
      const strength = checkPasswordStrength(password);
      expect(strength.isValid).toBe(true);

      // Hash and verify
      const hashedPassword = await hashPassword(password);
      const isMatch = await verifyPassword(password, hashedPassword);
      expect(isMatch).toBe(true);
    });

    it('should handle password reset token generation', () => {
      const token = generateResetToken();

      expect(token).toBeTruthy();
      expect(token.length).toBe(32);
      expect(token).toMatch(/^[A-Za-z0-9]+$/);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid inputs gracefully', async () => {
      // Test with null/undefined
      await expect(hashPassword(null as any)).rejects.toThrow();
      await expect(hashPassword(undefined as any)).rejects.toThrow();

      // Test verification with null/undefined - verifyPassword throws on invalid inputs
      const validHash = await hashPassword('test19!');
      await expect(verifyPassword(null as any, validHash)).rejects.toThrow();
      await expect(verifyPassword(undefined as any, validHash)).rejects.toThrow();
      await expect(verifyPassword('test19!', null as any)).rejects.toThrow();
      await expect(verifyPassword('test19!', undefined as any)).rejects.toThrow();
    });

    it('should handle malformed hash gracefully', async () => {
      const password = 'TestPassword123!';
      const malformedHashes = [
        'invalid-hash',
        '$2a$10$invalid',
        '$2a$invalid$hash',
        'plaintext',
        '',
        '$1$invalid$hash',
      ];

      for (const hash of malformedHashes) {
        const isMatch = await verifyPassword(password, hash);
        expect(isMatch).toBe(false);
      }
    });

    it('should handle edge cases in password strength checking', () => {
      const edgeCases = ['', ' ', null as any, undefined as any];

      edgeCases.forEach((password) => {
        const result = checkPasswordStrength(password);
        expect(result.isValid).toBe(false);
        expect(result.feedback.length).toBeGreaterThan(0);
        expect(result.score).toBe(0);
      });
    });
  });
});
