import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../src/app';
import { createUserFactory, generateTestEmail } from '../factories/user.factory';
import { cacheService } from '../../src/services/cache.service';

const prisma = new PrismaClient();

describe('Security Features Integration Tests', () => {
  let testUser: any;
  let accessToken: string;

  beforeEach(async () => {
    // Clean up database and cache before each test
    await prisma.workEntry.deleteMany({});
    await prisma.user.deleteMany({});
    cacheService.clear();

    // Create test user
    const userData = {
      email: generateTestEmail('security'),
      password: 'SecurePassword123!',
      firstName: 'Test',
      lastName: 'User',
    };

    testUser = await createUserFactory({
      withHashedPassword: true,
      override: userData,
    });

    const dbUser = await prisma.user.create({
      data: {
        email: testUser.email,
        password: testUser.password,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
      },
    });

    // Login to get access token
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: 'SecurePassword123!',
    });

    accessToken = loginResponse.body.data.accessToken;
  });

  afterAll(async () => {
    // Clean up after all tests
    await prisma.workEntry.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('Rate Limiting Security', () => {
    it('should enforce rate limiting on authentication endpoints', async () => {
      const loginData = {
        email: testUser.email,
        password: 'WrongPassword123!',
      };

      // Make rapid login attempts
      const promises = Array.from({ length: 20 }, () =>
        request(app).post('/api/auth/login').send(loginData)
      );

      const results = await Promise.allSettled(promises);

      // Some requests should be rate limited (429 status)
      const rateLimited = results.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 429
      );

      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should enforce rate limiting on registration endpoints', async () => {
      const registrationData = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User',
      };

      // Make rapid registration attempts
      const promises = Array.from({ length: 20 }, (_, i) =>
        request(app)
          .post('/api/auth/register')
          .send({
            ...registrationData,
            email: `test${i}@example.com`,
          })
      );

      const results = await Promise.allSettled(promises);

      // Some requests should be rate limited
      const rateLimited = results.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 429
      );

      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should enforce rate limiting on API endpoints', async () => {
      // Make rapid API requests
      const promises = Array.from({ length: 150 }, () =>
        request(app).get('/api/work-entries').set('Authorization', `Bearer ${accessToken}`)
      );

      const results = await Promise.allSettled(promises);

      // Some requests should be rate limited
      const rateLimited = results.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 429
      );

      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should have different rate limits for different endpoint types', async () => {
      // Test auth endpoints (stricter limits)
      const authPromises = Array.from({ length: 10 }, () =>
        request(app).post('/api/auth/login').send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
      );

      const authResults = await Promise.allSettled(authPromises);

      // Wait a bit to reset rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Test API endpoints (more lenient limits)
      const apiPromises = Array.from({ length: 10 }, () =>
        request(app).get('/api/work-entries').set('Authorization', `Bearer ${accessToken}`)
      );

      const apiResults = await Promise.allSettled(apiPromises);

      // Auth endpoints should have stricter rate limiting
      const authRateLimited = authResults.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 429
      );

      const apiRateLimited = apiResults.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 429
      );

      expect(authRateLimited.length).toBeGreaterThan(apiRateLimited.length);
    });

    it('should include rate limit headers in responses', async () => {
      const response = await request(app)
        .get('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });
  });

  describe('Account Lockout Security', () => {
    it('should lockout account after multiple failed login attempts', async () => {
      const loginData = {
        email: testUser.email,
        password: 'WrongPassword123!',
      };

      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/auth/login').send(loginData).expect(401);
      }

      // 6th attempt should result in account lockout
      const response = await request(app).post('/api/auth/login').send(loginData).expect(423);

      expect(response.body).toEqual({
        success: false,
        error: 'Account locked. Too many failed login attempts.',
      });
    });

    it('should lockout by IP address after multiple failed attempts', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'WrongPassword123!',
      };

      // Make 5 failed login attempts from same IP
      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/auth/login').send(loginData).expect(401);
      }

      // 6th attempt should result in IP lockout
      const response = await request(app).post('/api/auth/login').send(loginData).expect(423);

      expect(response.body).toEqual({
        success: false,
        error: 'IP address locked. Too many failed login attempts.',
      });
    });

    it('should prevent login even with correct credentials when locked', async () => {
      const wrongLoginData = {
        email: testUser.email,
        password: 'WrongPassword123!',
      };

      // Make 5 failed login attempts to trigger lockout
      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/auth/login').send(wrongLoginData).expect(401);
      }

      // Try with correct credentials - should still be locked
      const correctLoginData = {
        email: testUser.email,
        password: 'SecurePassword123!',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(correctLoginData)
        .expect(423);

      expect(response.body).toEqual({
        success: false,
        error: 'Account locked. Too many failed login attempts.',
      });
    });

    it('should track failed attempts across different sessions', async () => {
      const loginData = {
        email: testUser.email,
        password: 'WrongPassword123!',
      };

      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await request(app).post('/api/auth/login').send(loginData).expect(401);
      }

      // Wait a bit (simulate different session)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Make 2 more failed attempts
      for (let i = 0; i < 2; i++) {
        await request(app).post('/api/auth/login').send(loginData).expect(401);
      }

      // Next attempt should trigger lockout
      const response = await request(app).post('/api/auth/login').send(loginData).expect(423);

      expect(response.body.error).toContain('Account locked');
    });

    it('should reset failed attempts counter after successful login', async () => {
      const wrongLoginData = {
        email: testUser.email,
        password: 'WrongPassword123!',
      };

      const correctLoginData = {
        email: testUser.email,
        password: 'SecurePassword123!',
      };

      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await request(app).post('/api/auth/login').send(wrongLoginData).expect(401);
      }

      // Successful login should reset counter
      await request(app).post('/api/auth/login').send(correctLoginData).expect(200);

      // Should be able to make failed attempts again without immediate lockout
      for (let i = 0; i < 4; i++) {
        await request(app).post('/api/auth/login').send(wrongLoginData).expect(401);
      }

      // 5th attempt should still work (counter was reset)
      const response = await request(app).post('/api/auth/login').send(wrongLoginData).expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });
  });

  describe('Input Validation Security', () => {
    it('should prevent XSS in user registration', async () => {
      const maliciousData = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        firstName: '<script>alert("xss")</script>',
        lastName: 'javascript:alert(1)',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(maliciousData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });

    it('should prevent XSS in work entry creation', async () => {
      const maliciousData = {
        date: '2024-01-15',
        hours: 8.0,
        description: '<script>alert("xss")</script>',
      };

      const response = await request(app)
        .post('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(maliciousData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });

    it('should prevent SQL injection attempts in login', async () => {
      const sqlInjectionData = {
        email: "admin@example.com' OR '1'='1",
        password: "password' OR '1'='1",
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(sqlInjectionData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });

    it('should validate email format strictly', async () => {
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@example.com',
        'test..test@example.com',
        'test@example',
        'test@.com',
        'test@com.',
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email,
            password: 'SecurePassword123!',
            firstName: 'Test',
            lastName: 'User',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('validation');
      }
    });

    it('should enforce password complexity requirements', async () => {
      const weakPasswords = [
        'short',
        'password123',
        'PASSWORD123',
        'Password',
        'Password123',
        'password123!',
        'PASSWORD123!',
        'Pass123!',
        'password',
        '123456789',
        'Password123123123', // Too long
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: generateTestEmail('weak'),
            password,
            firstName: 'Test',
            lastName: 'User',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Password contains common weak patterns');
      }
    });

    it('should validate work entry data strictly', async () => {
      const invalidData = [
        {
          date: 'invalid-date',
          hours: 8.0,
          description: 'Valid description',
        },
        {
          date: '2024-01-15',
          hours: -1,
          description: 'Valid description',
        },
        {
          date: '2024-01-15',
          hours: 25,
          description: 'Valid description',
        },
        {
          date: '2024-01-15',
          hours: 8.0,
          description: '', // Empty description
        },
        {
          date: '2024-01-15',
          hours: 8.0,
          description: 'A'.repeat(1001), // Too long
        },
      ];

      for (const data of invalidData) {
        const response = await request(app)
          .post('/api/work-entries')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(data)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('validation');
      }
    });

    it('should sanitize and normalize valid input', async () => {
      const userData = {
        email: '  TEST@EXAMPLE.COM  ',
        password: 'SecurePassword123!',
        firstName: '  John  ',
        lastName: '  Doe  ',
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(201);

      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.user.firstName).toBe('John');
      expect(response.body.data.user.lastName).toBe('Doe');
    });
  });

  describe('Authentication Security', () => {
    it('should reject requests with invalid JWT tokens', async () => {
      const invalidTokens = [
        'invalid-token',
        'Bearer invalid-token',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        '',
        null,
        undefined,
      ];

      for (const token of invalidTokens) {
        const response = await request(app)
          .get('/api/work-entries')
          .set('Authorization', token || '')
          .expect(401);

        expect(response.body.success).toBe(false);
      }
    });

    it('should reject expired JWT tokens', async () => {
      // This would require mocking or generating an expired token
      // For now, we'll test with a malformed token that represents expiration
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZXhwIjoxNTE2MjM5MDIyfQ.invalid';

      const response = await request(app)
        .get('/api/work-entries')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid token');
    });

    it('should validate JWT token format', async () => {
      const malformedTokens = [
        'Bearer',
        'Bearer ',
        'NotBearer token',
        'Bearer token.with.only.two.parts',
        'Bearer token-with-only-one-part',
      ];

      for (const token of malformedTokens) {
        const response = await request(app)
          .get('/api/work-entries')
          .set('Authorization', token)
          .expect(401);

        expect(response.body.success).toBe(false);
      }
    });

    it('should prevent token reuse after user deletion', async () => {
      // Create another user to avoid conflicts
      const newUserData = {
        email: generateTestEmail('delete'),
        password: 'SecurePassword123!',
        firstName: 'Delete',
        lastName: 'Test',
      };

      // Register new user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(newUserData)
        .expect(201);

      const newAccessToken = registerResponse.body.data.accessToken;

      // Delete user from database
      await prisma.user.delete({
        where: { email: newUserData.email },
      });

      // Try to use token of deleted user
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(401);

      expect(response.body.error).toBe('User not found');
    });

    it('should enforce proper authorization on protected routes', async () => {
      const protectedRoutes = [
        { method: 'GET', path: '/api/auth/profile' },
        { method: 'GET', path: '/api/work-entries' },
        { method: 'POST', path: '/api/work-entries' },
        { method: 'PUT', path: '/api/work-entries/123' },
        { method: 'DELETE', path: '/api/work-entries/123' },
      ];

      for (const route of protectedRoutes) {
        const response = await request(app)
          [route.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete'](route.path)
          .send({})
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Authentication required');
      }
    });
  });

  describe('Headers Security', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app).get('/health').expect(200);

      // Check for security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
      expect(response.headers).toHaveProperty('strict-transport-security');
      expect(response.headers).toHaveProperty('content-security-policy');
    });

    it('should not expose sensitive information in headers', async () => {
      const response = await request(app).get('/health').expect(200);

      // Should not expose server/framework information
      expect(response.headers).not.toHaveProperty('x-powered-by');
      expect(response.headers).not.toHaveProperty('server');
    });

    it('should set appropriate CORS headers', async () => {
      const response = await request(app)
        .options('/api/work-entries')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });
  });

  describe('Data Protection Security', () => {
    it('should not expose sensitive data in error responses', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
      expect(response.body.error).not.toContain('user not found');
      expect(response.body.error).not.toContain('password');
      expect(response.body.error).not.toContain('hash');
    });

    it('should not expose user IDs in unauthorized requests', async () => {
      // Create a work entry
      const workEntryResponse = await request(app)
        .post('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          date: '2024-01-15',
          hours: 8.0,
          description: 'Test entry',
        });

      const workEntryId = workEntryResponse.body.data.workEntry.id;

      // Try to access with different user
      const newUserData = {
        email: generateTestEmail('unauthorized'),
        password: 'SecurePassword123!',
        firstName: 'Unauthorized',
        lastName: 'User',
      };

      const registerResponse = await request(app).post('/api/auth/register').send(newUserData);

      const unauthorizedToken = registerResponse.body.data.accessToken;

      const response = await request(app)
        .get(`/api/work-entries/${workEntryId}`)
        .set('Authorization', `Bearer ${unauthorizedToken}`)
        .expect(404);

      expect(response.body.error).toBe('Work entry not found');
      expect(response.body.error).not.toContain('user');
      expect(response.body.error).not.toContain('unauthorized');
    });

    it('should hash passwords securely', async () => {
      const password = 'SecurePassword123!';

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: generateTestEmail('hash'),
          password,
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201);

      // Check database for hashed password
      const user = await prisma.user.findUnique({
        where: { email: response.body.data.user.email },
      });

      expect(user?.password).not.toBe(password);
      expect(user?.password).toMatch(/^\$2[aby]\$\d{1,2}\$.{53}$/); // bcrypt format
    });
  });

  describe('Session Security', () => {
    it('should invalidate refresh tokens properly', async () => {
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: 'SecurePassword123!',
      });

      const refreshToken = loginResponse.body.data.refreshToken;

      // Use refresh token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(refreshResponse.body.data.accessToken).toBeTruthy();
      expect(refreshResponse.body.data.refreshToken).toBeTruthy();

      // Old refresh token should be invalidated
      const oldRefreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(oldRefreshResponse.body.error).toBe('Invalid refresh token');
    });

    it('should prevent concurrent session abuse', async () => {
      // Login multiple times rapidly
      const loginPromises = Array.from({ length: 10 }, () =>
        request(app).post('/api/auth/login').send({
          email: testUser.email,
          password: 'SecurePassword123!',
        })
      );

      const results = await Promise.allSettled(loginPromises);

      // All should succeed but with different tokens
      const successful = results.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 200
      );

      expect(successful.length).toBe(10);

      // All tokens should be different
      const tokens = successful.map((result) =>
        result.status === 'fulfilled' ? result.value.body.data.accessToken : null
      );

      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(10);
    });
  });

  describe('API Security Boundaries', () => {
    it('should enforce resource ownership', async () => {
      // Create work entry with first user
      const workEntryResponse = await request(app)
        .post('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          date: '2024-01-15',
          hours: 8.0,
          description: 'Test entry',
        });

      const workEntryId = workEntryResponse.body.data.workEntry.id;

      // Create second user
      const otherUserData = {
        email: generateTestEmail('other'),
        password: 'SecurePassword123!',
        firstName: 'Other',
        lastName: 'User',
      };

      const registerResponse = await request(app).post('/api/auth/register').send(otherUserData);

      const otherToken = registerResponse.body.data.accessToken;

      // Try to access first user's work entry with second user's token
      const unauthorized = await request(app)
        .get(`/api/work-entries/${workEntryId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);

      expect(unauthorized.body.error).toBe('Work entry not found');

      // Try to update first user's work entry
      const updateResponse = await request(app)
        .put(`/api/work-entries/${workEntryId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          hours: 9.0,
          description: 'Unauthorized update',
        })
        .expect(404);

      expect(updateResponse.body.error).toBe('Work entry not found');

      // Try to delete first user's work entry
      const deleteResponse = await request(app)
        .delete(`/api/work-entries/${workEntryId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);

      expect(deleteResponse.body.error).toBe('Work entry not found');
    });

    it('should prevent information disclosure through timing attacks', async () => {
      const startTime = Date.now();

      // Login with non-existent user
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SecurePassword123!',
        })
        .expect(401);

      const nonExistentUserTime = Date.now() - startTime;

      const startTime2 = Date.now();

      // Login with existing user but wrong password
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      const existingUserTime = Date.now() - startTime2;

      // Response times should be similar to prevent user enumeration
      const timeDifference = Math.abs(nonExistentUserTime - existingUserTime);
      expect(timeDifference).toBeLessThan(100); // Less than 100ms difference
    });
  });
});
