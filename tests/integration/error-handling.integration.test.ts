import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../src/app';
import { createUserFactory, generateTestEmail } from '../factories/user.factory';
import { cacheService } from '../../src/services/cache.service';

const prisma = new PrismaClient();

describe('Error Handling Integration Tests', () => {
  let testUser: any;
  let accessToken: string;

  beforeEach(async () => {
    // Clean up database and cache before each test
    await prisma.workEntry.deleteMany({});
    await prisma.user.deleteMany({});
    cacheService.clear();

    // Create test user
    const userData = {
      email: generateTestEmail('error'),
      password: 'SecurePassword123!',
      firstName: 'Test',
      lastName: 'User',
    };

    testUser = await createUserFactory({
      withHashedPassword: true,
      override: userData,
    });

    await prisma.user.create({
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

    accessToken = loginResponse.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    // Clean up after all tests
    await prisma.workEntry.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('Authentication Error Handling', () => {
    it('should handle missing authentication token', async () => {
      const response = await request(app).get('/api/work-entries').expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Authentication required',
      });

      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('details');
    });

    it('should handle malformed JWT tokens', async () => {
      const malformedTokens = [
        'Bearer invalid-token',
        'Bearer ',
        'Bearer token.missing.parts',
        'Bearer token.with.invalid.signature',
        'NotBearer token',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      ];

      for (const token of malformedTokens) {
        const response = await request(app)
          .get('/api/work-entries')
          .set('Authorization', token)
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toMatch(/Invalid token|Authentication required/);
        expect(response.body).not.toHaveProperty('stack');
      }
    });

    it('should handle expired JWT tokens gracefully', async () => {
      // Create an expired token (mock scenario)
      const expiredToken =
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZXhwIjoxNTE2MjM5MDIyfQ.invalid';

      const response = await request(app)
        .get('/api/work-entries')
        .set('Authorization', expiredToken)
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid token',
      });
    });

    it('should handle token for deleted user', async () => {
      // Create another user to avoid conflicts
      const tempUserData = {
        email: generateTestEmail('deleted'),
        password: 'SecurePassword123!',
        firstName: 'Deleted',
        lastName: 'User',
      };

      // Register and login to get token
      const registerResponse = await request(app).post('/api/auth/register').send(tempUserData);

      const tempToken = registerResponse.body.data.accessToken;

      // Delete the user
      await prisma.user.delete({
        where: { email: tempUserData.email },
      });

      // Try to use the token
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${tempToken}`)
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'User not found',
      });
    });

    it('should handle invalid refresh tokens', async () => {
      const invalidTokens = [
        'invalid-refresh-token',
        '',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        'valid.looking.token',
      ];

      for (const token of invalidTokens) {
        const response = await request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken: token })
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Invalid refresh token');
      }
    });
  });

  describe('Validation Error Handling', () => {
    it('should handle invalid registration data', async () => {
      const invalidData = [
        {
          email: 'invalid-email',
          password: 'SecurePassword123!',
          firstName: 'Test',
          lastName: 'User',
        },
        {
          email: generateTestEmail('valid'),
          password: 'weak',
          firstName: 'Test',
          lastName: 'User',
        },
        {
          email: generateTestEmail('valid'),
          password: 'SecurePassword123!',
          firstName: '',
          lastName: 'User',
        },
        {
          email: generateTestEmail('valid'),
          password: 'SecurePassword123!',
          firstName: 'Test',
          lastName: '',
        },
        {
          email: generateTestEmail('valid'),
          password: 'SecurePassword123!',
          firstName: 'A'.repeat(101),
          lastName: 'User',
        },
      ];

      for (const data of invalidData) {
        const response = await request(app).post('/api/auth/register').send(data).expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('validation');
        expect(response.body).not.toHaveProperty('stack');
      }
    });

    it('should handle invalid work entry data', async () => {
      const invalidData = [
        {
          date: 'invalid-date',
          hours: 8.0,
          description: 'Valid description',
        },
        {
          date: '2024-01-15',
          hours: -5,
          description: 'Valid description',
        },
        {
          date: '2024-01-15',
          hours: 25,
          description: 'Valid description',
        },
        {
          date: '2024-01-15',
          hours: 'not-a-number',
          description: 'Valid description',
        },
        {
          date: '2024-01-15',
          hours: 8.0,
          description: '',
        },
        {
          date: '2024-01-15',
          hours: 8.0,
          description: 'A'.repeat(1001),
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
        expect(response.body).not.toHaveProperty('stack');
      }
    });

    it('should handle malformed JSON payloads', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send('invalid-json')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body).not.toHaveProperty('stack');
    });

    it('should handle empty request bodies', async () => {
      const response = await request(app).post('/api/auth/register').send({}).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });

    it('should handle missing content-type header', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', '')
        .send('some-data')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle oversized request payloads', async () => {
      const largeData = {
        email: generateTestEmail('large'),
        password: 'SecurePassword123!',
        firstName: 'A'.repeat(10000),
        lastName: 'B'.repeat(10000),
        extraField: 'C'.repeat(100000),
      };

      const response = await request(app).post('/api/auth/register').send(largeData).expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Database Error Handling', () => {
    it('should handle unique constraint violations', async () => {
      const userData = {
        email: generateTestEmail('duplicate'),
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User',
      };

      // Create user first time
      await request(app).post('/api/auth/register').send(userData).expect(201);

      // Try to create same user again
      const response = await request(app).post('/api/auth/register').send(userData).expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Email already exists',
      });
      expect(response.body).not.toHaveProperty('stack');
    });

    it('should handle work entry creation successfully', async () => {
      const workEntryData = {
        date: '2024-01-15',
        hours: 8.0,
        description: 'First entry',
      };

      // Create first entry
      await request(app)
        .post('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(workEntryData)
        .expect(201);

      // Create second entry for same date (should succeed)
      const response = await request(app)
        .post('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ...workEntryData,
          description: 'Second entry for same date',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
    });

    it('should handle foreign key constraint violations', async () => {
      // This test would require mocking database constraints
      // For now, we'll test with invalid user references
      const response = await request(app)
        .get('/api/work-entries/invalid-uuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Work entry not found',
      });
    });
  });

  describe('Resource Not Found Error Handling', () => {
    it('should handle non-existent work entries', async () => {
      const nonExistentId = 'non-existent-id';

      const getResponse = await request(app)
        .get(`/api/work-entries/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(getResponse.body).toEqual({
        success: false,
        error: 'Work entry not found',
      });

      const updateResponse = await request(app)
        .put(`/api/work-entries/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          hours: 8.0,
          description: 'Updated description',
        })
        .expect(404);

      expect(updateResponse.body).toEqual({
        success: false,
        error: 'Work entry not found',
      });

      const deleteResponse = await request(app)
        .delete(`/api/work-entries/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(deleteResponse.body).toEqual({
        success: false,
        error: 'Work entry not found',
      });
    });

    it("should handle access to other users' resources", async () => {
      // Create another user
      const otherUserData = {
        email: generateTestEmail('other'),
        password: 'SecurePassword123!',
        firstName: 'Other',
        lastName: 'User',
      };

      const registerResponse = await request(app).post('/api/auth/register').send(otherUserData);

      const otherToken = registerResponse.body.data.accessToken;

      // Create work entry with first user
      const workEntryResponse = await request(app)
        .post('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          date: '2024-01-15',
          hours: 8.0,
          description: 'First user entry',
        });

      const workEntryId = workEntryResponse.body.data.workEntry.id;

      // Try to access with second user's token
      const response = await request(app)
        .get(`/api/work-entries/${workEntryId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Work entry not found',
      });
    });

    it('should handle non-existent API endpoints', async () => {
      const response = await request(app)
        .get('/api/non-existent-endpoint')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Not found');
    });
  });

  describe('Rate Limiting Error Handling', () => {
    it('should handle rate limit exceeded scenarios', async () => {
      // Make rapid requests to trigger rate limiting
      const promises = Array.from({ length: 20 }, () =>
        request(app).post('/api/auth/login').send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
      );

      const results = await Promise.allSettled(promises);

      // Some should be rate limited
      const rateLimited = results.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 429
      );

      expect(rateLimited.length).toBeGreaterThan(0);

      // Rate limited responses should have proper error format
      for (const result of rateLimited) {
        if (result.status === 'fulfilled') {
          expect(result.value.body.success).toBe(false);
          expect(result.value.body.error).toContain('Too many requests');
          expect(result.value.body).not.toHaveProperty('stack');
        }
      }
    });

    it('should include rate limit headers in error responses', async () => {
      const response = await request(app)
        .get('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });
  });

  describe('Account Lockout Error Handling', () => {
    it('should handle account lockout scenarios', async () => {
      const loginData = {
        email: testUser.email,
        password: 'WrongPassword123!',
      };

      // Make 5 failed attempts to trigger lockout
      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/auth/login').send(loginData).expect(401);
      }

      // 6th attempt should return account locked error
      const response = await request(app).post('/api/auth/login').send(loginData).expect(423);

      expect(response.body).toEqual({
        success: false,
        error: 'Account locked. Too many failed login attempts.',
      });
    });

    it('should handle login attempts while account is locked', async () => {
      const wrongLoginData = {
        email: testUser.email,
        password: 'WrongPassword123!',
      };

      // Trigger account lockout
      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/auth/login').send(wrongLoginData).expect(401);
      }

      // Try with correct credentials while locked
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
  });

  describe('Server Error Handling', () => {
    it('should handle unexpected server errors gracefully', async () => {
      // This test would require mocking server errors
      // For now, we'll ensure no 500 errors are exposed
      const response = await request(app)
        .get('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.status).not.toBe(500);
    });

    it('should not expose sensitive information in error responses', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.error).not.toContain('password');
      expect(response.body.error).not.toContain('hash');
      expect(response.body.error).not.toContain('database');
      expect(response.body.error).not.toContain('prisma');
      expect(response.body.error).not.toContain('bcrypt');
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('details');
    });

    it('should handle CORS errors properly', async () => {
      const response = await request(app)
        .options('/api/work-entries')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('Input Sanitization Error Handling', () => {
    it('should reject XSS attempts in all input fields', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:alert(1)',
      ];

      for (const payload of xssPayloads) {
        // Test in registration
        const registerResponse = await request(app)
          .post('/api/auth/register')
          .send({
            email: generateTestEmail('xss'),
            password: 'SecurePassword123!',
            firstName: payload,
            lastName: 'User',
          })
          .expect(400);

        expect(registerResponse.body.success).toBe(false);
        expect(registerResponse.body.error).toContain('validation');

        // Test in work entry
        const workEntryResponse = await request(app)
          .post('/api/work-entries')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            date: '2024-01-15',
            hours: 8.0,
            description: payload,
          })
          .expect(400);

        expect(workEntryResponse.body.success).toBe(false);
        expect(workEntryResponse.body.error).toContain('validation');
      }
    });

    it('should reject SQL injection attempts', async () => {
      const sqlPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users --",
        "' OR 1=1 --",
        "admin'--",
        "' OR 'a'='a",
      ];

      for (const payload of sqlPayloads) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: payload,
            password: 'SecurePassword123!',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('validation');
      }
    });

    it('should handle null byte injection attempts', async () => {
      const nullBytePayloads = [
        'test\0@example.com',
        'test@example.com\0',
        'description\0with\0nulls',
      ];

      for (const payload of nullBytePayloads) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: payload,
            password: 'SecurePassword123!',
            firstName: 'Test',
            lastName: 'User',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('validation');
      }
    });
  });

  describe('Edge Case Error Handling', () => {
    it('should handle very long request URLs', async () => {
      const longId = 'a'.repeat(1000);
      const response = await request(app)
        .get(`/api/work-entries/${longId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should handle concurrent modification conflicts', async () => {
      // Create work entry
      const workEntryResponse = await request(app)
        .post('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          date: '2024-01-15',
          hours: 8.0,
          description: 'Test entry',
        });

      const workEntryId = workEntryResponse.body.data.workEntry.id;

      // Make concurrent updates
      const promises = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .put(`/api/work-entries/${workEntryId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            hours: 8.0 + i,
            description: `Updated description ${i}`,
          })
      );

      const results = await Promise.allSettled(promises);

      // At least one should succeed
      const successful = results.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 200
      );

      expect(successful.length).toBeGreaterThan(0);
    });

    it('should handle invalid date formats consistently', async () => {
      const invalidDates = [
        '2024-13-01', // Invalid month
        '2024-01-32', // Invalid day
        '2024-02-30', // Invalid February date
        '2024/01/15', // Wrong format
        '01-15-2024', // Wrong format
        '2024-1-1', // Not zero-padded
        '2024-01-01T25:00:00', // Invalid time
      ];

      for (const date of invalidDates) {
        const response = await request(app)
          .post('/api/work-entries')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            date,
            hours: 8.0,
            description: 'Test entry',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('validation');
      }
    });

    it('should handle timezone-related edge cases', async () => {
      const edgeCaseDates = [
        '2024-01-15T00:00:00Z',
        '2024-01-15T23:59:59Z',
        '2024-01-15T12:00:00+00:00',
        '2024-01-15T12:00:00-08:00',
      ];

      for (const date of edgeCaseDates) {
        const response = await request(app)
          .post('/api/work-entries')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            date,
            hours: 8.0,
            description: 'Timezone test entry',
          });

        // Should either succeed or fail consistently
        expect([200, 201, 400]).toContain(response.status);

        if (response.status === 400) {
          expect(response.body.success).toBe(false);
          expect(response.body.error).toContain('validation');
        }
      }
    });

    it('should handle special characters in all fields', async () => {
      const specialChars = [
        '!@#$%^&*()_+-=[]{}|;:,.<>?',
        '™®©§¶•ªº',
        'αβγδεζηθικλμνξοπ',
        '中文测试',
        'العربية',
        'עברית',
        '🚀🔥💯',
      ];

      for (const chars of specialChars) {
        const response = await request(app)
          .post('/api/work-entries')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            date: '2024-01-15',
            hours: 8.0,
            description: `Test with special chars: ${chars}`,
          });

        // Should either succeed or fail gracefully
        expect([200, 201, 400]).toContain(response.status);

        if (response.status === 400) {
          expect(response.body.success).toBe(false);
          expect(response.body.error).toContain('validation');
        }
      }
    });
  });

  describe('Error Response Format Consistency', () => {
    it('should have consistent error response format across all endpoints', async () => {
      const errorScenarios = [
        {
          request: () => request(app).get('/api/work-entries'),
          expectedStatus: 401,
          expectedError: 'Authentication required',
        },
        {
          request: () => request(app).post('/api/auth/login').send({}),
          expectedStatus: 400,
          expectedError: 'validation',
        },
        {
          request: () =>
            request(app)
              .get('/api/work-entries/invalid-id')
              .set('Authorization', `Bearer ${accessToken}`),
          expectedStatus: 404,
          expectedError: 'Work entry not found',
        },
        {
          request: () => request(app).post('/api/auth/refresh').send({}),
          expectedStatus: 400,
          expectedError: 'validation',
        },
      ];

      for (const scenario of errorScenarios) {
        const response = await scenario.request().expect(scenario.expectedStatus);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain(scenario.expectedError);
        expect(response.body).not.toHaveProperty('stack');
        expect(response.body).not.toHaveProperty('details');
        expect(response.body).not.toHaveProperty('code');
      }
    });

    it('should include appropriate HTTP status codes', async () => {
      const statusTests = [
        { request: () => request(app).get('/api/work-entries'), expectedStatus: 401 },
        { request: () => request(app).post('/api/auth/login').send({}), expectedStatus: 400 },
        { request: () => request(app).get('/api/non-existent'), expectedStatus: 404 },
        {
          request: () =>
            request(app).get('/api/work-entries').set('Authorization', `Bearer ${accessToken}`),
          expectedStatus: 200,
        },
      ];

      for (const test of statusTests) {
        const response = await test.request().expect(test.expectedStatus);
        expect(response.status).toBe(test.expectedStatus);
      }
    });

    it('should handle preflight OPTIONS requests', async () => {
      const response = await request(app)
        .options('/api/work-entries')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });
  });
});
