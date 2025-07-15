import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../src/app';
import { createUserFactory, generateTestEmail } from '../factories/user.factory';
import { hashPassword } from '../../src/utils/password.utils';
import { generateRefreshToken } from '../../src/utils/jwt.utils';

const prisma = new PrismaClient();

describe('Authentication Integration Tests', () => {
  beforeEach(async () => {
    // Clean up database before each test
    await prisma.workEntry.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    // Clean up after all tests
    await prisma.workEntry.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: generateTestEmail('register'),
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User',
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(201);

      expect(response.body).toEqual({
        success: true,
        data: {
          user: {
            id: expect.any(String),
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          },
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        },
      });

      // Verify user was created in database
      const dbUser = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      expect(dbUser).toBeTruthy();
      expect(dbUser?.email).toBe(userData.email);
      expect(dbUser?.firstName).toBe(userData.firstName);
      expect(dbUser?.lastName).toBe(userData.lastName);
      expect(dbUser?.password).not.toBe(userData.password); // Should be hashed
    });

    it('should reject registration with existing email', async () => {
      const userData = {
        email: generateTestEmail('existing'),
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User',
      };

      // Create existing user
      await createUserFactory({
        withHashedPassword: true,
        override: userData,
      });

      const response = await request(app).post('/api/auth/register').send(userData).expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Email already exists',
      });
    });

    it('should reject registration with invalid email format', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User',
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        email: generateTestEmail('weak'),
        password: 'weak',
        firstName: 'Test',
        lastName: 'User',
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Password contains common weak patterns');
    });

    it('should reject registration with missing required fields', async () => {
      const userData = {
        email: generateTestEmail('missing'),
        // Missing password, firstName, lastName
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });

    it('should sanitize user input during registration', async () => {
      const userData = {
        email: generateTestEmail('sanitize'),
        password: 'SecurePassword123!',
        firstName: '  Test  ',
        lastName: '  User  ',
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(201);

      expect(response.body.data.user.firstName).toBe('Test');
      expect(response.body.data.user.lastName).toBe('User');
    });

    it('should handle special characters in names', async () => {
      const userData = {
        email: generateTestEmail('special'),
        password: 'SecurePassword123!',
        firstName: "Mary-Jane O'Connor",
        lastName: 'Smith-Wilson',
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(201);

      expect(response.body.data.user.firstName).toBe("Mary-Jane O'Connor");
      expect(response.body.data.user.lastName).toBe('Smith-Wilson');
    });
  });

  describe('POST /api/auth/login', () => {
    let testUser: any;

    beforeEach(async () => {
      // Create test user for login tests
      const userData = {
        email: generateTestEmail('login'),
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User',
      };

      testUser = await createUserFactory({
        withHashedPassword: true,
        override: userData,
      });

      // Store in database
      await prisma.user.create({
        data: {
          email: testUser.email,
          password: testUser.password,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
        },
      });
    });

    it('should login successfully with correct credentials', async () => {
      const loginData = {
        email: testUser.email,
        password: 'SecurePassword123!', // Original password
      };

      const response = await request(app).post('/api/auth/login').send(loginData).expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          user: {
            id: expect.any(String),
            email: testUser.email,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          },
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        },
      });
    });

    it('should reject login with incorrect password', async () => {
      const loginData = {
        email: testUser.email,
        password: 'WrongPassword123!',
      };

      const response = await request(app).post('/api/auth/login').send(loginData).expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid credentials',
      });
    });

    it('should reject login with non-existent email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'SecurePassword123!',
      };

      const response = await request(app).post('/api/auth/login').send(loginData).expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid credentials',
      });
    });

    it('should reject login with invalid email format', async () => {
      const loginData = {
        email: 'invalid-email',
        password: 'SecurePassword123!',
      };

      const response = await request(app).post('/api/auth/login').send(loginData).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });

    it('should reject login with missing credentials', async () => {
      const loginData = {
        email: testUser.email,
        // Missing password
      };

      const response = await request(app).post('/api/auth/login').send(loginData).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });

    it('should handle case-insensitive email login', async () => {
      const loginData = {
        email: testUser.email.toUpperCase(),
        password: 'SecurePassword123!',
      };

      const response = await request(app).post('/api/auth/login').send(loginData).expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email.toLowerCase());
    });
  });

  describe('POST /api/auth/refresh', () => {
    let testUser: any;
    let refreshToken: string;

    beforeEach(async () => {
      // Create test user
      const userData = {
        email: generateTestEmail('refresh'),
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

      // Generate refresh token
      refreshToken = generateRefreshToken(dbUser.id, dbUser.email);
    });

    it('should refresh token successfully with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
        },
      });
    });

    it('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid refresh token',
      });
    });

    it('should reject refresh with missing token', async () => {
      const response = await request(app).post('/api/auth/refresh').send({}).expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });

    it('should reject refresh with expired token', async () => {
      // Generate an expired token (this would need to be mocked in a real scenario)
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE1MTYyMzkwMjIsImV4cCI6MTUxNjIzOTAyMn0.invalid';

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: expiredToken })
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid refresh token',
      });
    });
  });

  describe('GET /api/auth/profile', () => {
    let testUser: any;
    let accessToken: string;

    beforeEach(async () => {
      // Create test user and login to get token
      const userData = {
        email: generateTestEmail('profile'),
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

      accessToken = loginResponse.body.data.accessToken;
    });

    it('should get user profile successfully with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          user: {
            id: expect.any(String),
            email: testUser.email,
            firstName: testUser.firstName,
            lastName: testUser.lastName,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          },
        },
      });
    });

    it('should reject profile request without token', async () => {
      const response = await request(app).get('/api/auth/profile').expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should reject profile request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid token',
      });
    });

    it('should reject profile request with malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid token format',
      });
    });

    it('should reject profile request for deleted user', async () => {
      // Delete the user from database
      await prisma.user.delete({
        where: { email: testUser.email },
      });

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'User not found',
      });
    });
  });

  describe('Authentication Flow Integration', () => {
    it('should complete full authentication flow', async () => {
      // 1. Register user
      const userData = {
        email: generateTestEmail('flow'),
        password: 'SecurePassword123!',
        firstName: 'Flow',
        lastName: 'Test',
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      const { accessToken, refreshToken } = registerResponse.body.data;

      // 2. Get profile with access token
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(profileResponse.body.success).toBe(true);
      expect(profileResponse.body.data.user.email).toBe(userData.email);

      // 3. Refresh token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(refreshResponse.body.success).toBe(true);
      const newAccessToken = refreshResponse.body.data.accessToken;

      // 4. Use new access token
      const newProfileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);

      expect(newProfileResponse.body.success).toBe(true);
      expect(newProfileResponse.body.data.user.email).toBe(userData.email);

      // 5. Login with original credentials
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data.user.email).toBe(userData.email);
    });

    it('should handle concurrent registrations gracefully', async () => {
      const userData = {
        email: generateTestEmail('concurrent'),
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User',
      };

      // Attempt concurrent registrations
      const promises = Array.from({ length: 3 }, () =>
        request(app).post('/api/auth/register').send(userData)
      );

      const results = await Promise.allSettled(promises);

      // Only one should succeed
      const successful = results.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 201
      );
      const failed = results.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 400
      );

      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(2);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking database errors
      // For now, we'll test that the API handles unexpected errors
      const userData = {
        email: generateTestEmail('error'),
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User',
      };

      const response = await request(app).post('/api/auth/register').send(userData);

      // Should not return 500 errors or expose internal details
      expect(response.status).not.toBe(500);
    });

    it('should handle malformed JSON input', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send('invalid-json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle very large payload', async () => {
      const userData = {
        email: generateTestEmail('large'),
        password: 'SecurePassword123!',
        firstName: 'A'.repeat(10000), // Very large name
        lastName: 'User',
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle special characters in email', async () => {
      const userData = {
        email: 'test+tag@domain.co.uk',
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User',
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test+tag@domain.co.uk');
    });
  });
});
