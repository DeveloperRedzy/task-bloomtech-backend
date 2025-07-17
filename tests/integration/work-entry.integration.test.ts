import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../src/app';
import { createUserFactory, generateTestEmail } from '../factories/user.factory';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Helper function to generate valid recent dates for tests
const getRecentDate = (daysAgo: number, hour: number = 9, minute: number = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

const getRecentDateObj = (daysAgo: number, hour: number = 9, minute: number = 0): Date => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date;
};

describe('Work Entry Integration Tests', () => {
  let testUser: any;
  let userId: string;
  let accessToken: string;
  let otherUser: any;

  beforeEach(async () => {
    // Clean up database before each test
    await prisma.workEntry.deleteMany({});
    await prisma.user.deleteMany({});

    // Create test user
    const userData = {
      email: generateTestEmail('workentry'),
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

    userId = dbUser.id;

    // Login to get access token
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: 'SecurePassword123!',
    });

    if (!loginResponse.body?.data?.tokens?.accessToken) {
      throw new Error(`Login failed for testUser. Response: ${JSON.stringify(loginResponse.body)}`);
    }
    accessToken = loginResponse.body.data.tokens.accessToken;

    // Create another user for authorization testing
    const otherUserData = {
      email: generateTestEmail('other'),
      password: 'SecurePassword123!',
      firstName: 'Other',
      lastName: 'User',
    };

    otherUser = await createUserFactory({
      withHashedPassword: true,
      override: otherUserData,
    });

    await prisma.user.create({
      data: {
        email: otherUser.email,
        password: otherUser.password,
        firstName: otherUser.firstName,
        lastName: otherUser.lastName,
      },
    });

    const otherLoginResponse = await request(app).post('/api/auth/login').send({
      email: otherUser.email,
      password: 'SecurePassword123!',
    });

    if (!otherLoginResponse.body?.data?.tokens?.accessToken) {
      throw new Error(
        `Login failed for otherUser. Response: ${JSON.stringify(otherLoginResponse.body)}`
      );
    }
  });

  afterAll(async () => {
    // Clean up after all tests
    await prisma.workEntry.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('POST /api/work-entries', () => {
    it('should create a new work entry successfully', async () => {
      const workEntryData = {
        startTime: getRecentDate(1, 9), // Yesterday, 9 AM
        endTime: getRecentDate(1, 17), // Yesterday, 5 PM
        description: 'Working on authentication system',
      };

      const response = await request(app)
        .post('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(workEntryData)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        message: 'Work entry created successfully',
        data: {
          id: expect.any(String),
          startTime: getRecentDate(1, 9), // Yesterday, 9 AM
          endTime: getRecentDate(1, 17), // Yesterday, 5 PM
          duration: 8.0,
          description: 'Working on authentication system',
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });

      // Verify the entry was created in the database
      const workEntry = await prisma.workEntry.findFirst({
        where: { userId },
      });

      expect(workEntry).toBeTruthy();
      expect(workEntry!.startTime).toEqual(getRecentDateObj(1, 9));
      expect(workEntry!.endTime).toEqual(getRecentDateObj(1, 17));
    });

    it('should create multiple work entries for same user', async () => {
      const workEntryData1 = {
        startTime: getRecentDate(1, 9), // Yesterday, 9 AM
        endTime: getRecentDate(1, 17), // Yesterday, 5 PM
        description: 'Morning work session',
      };

      const workEntryData2 = {
        startTime: getRecentDate(1, 19), // Yesterday, 7 PM
        endTime: getRecentDate(1, 21), // Yesterday, 9 PM
        description: 'Evening work session',
      };

      // Create first entry
      const response1 = await request(app)
        .post('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(workEntryData1)
        .expect(201);

      // Create second entry for same day
      const response2 = await request(app)
        .post('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(workEntryData2)
        .expect(201);

      expect(response1.body.success).toBe(true);
      expect(response2.body.success).toBe(true);
      expect(response1.body.data.duration).toBe(8.0);
      expect(response2.body.data.duration).toBe(2.0);
    });

    it('should reject creation with invalid time range', async () => {
      const workEntryData = {
        startTime: getRecentDate(1, 17), // Yesterday, 5 PM
        endTime: getRecentDate(1, 9), // Yesterday, 9 AM (End before start)
        description: 'Invalid time range',
      };

      const response = await request(app)
        .post('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(workEntryData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid input data');
    });

    it('should reject creation with missing required fields', async () => {
      const workEntryData = {
        startTime: '2024-01-15T09:00:00.000Z',
        // Missing endTime and description
      };

      const response = await request(app)
        .post('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(workEntryData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid input data');
    });

    it('should validate various duration lengths', async () => {
      const testCases = [
        {
          startTime: '2024-01-15T09:00:00.000Z',
          endTime: '2024-01-15T09:14:00.000Z',
          shouldFail: true,
        }, // 14 min - too short
        {
          startTime: '2024-01-15T09:00:00.000Z',
          endTime: '2024-01-15T09:15:00.000Z',
          shouldFail: false,
        }, // 15 min - minimum
        {
          startTime: '2024-01-15T09:00:00.000Z',
          endTime: '2024-01-15T13:00:00.000Z',
          shouldFail: false,
        }, // 4 hours - normal
        {
          startTime: '2024-01-15T09:00:00.000Z',
          endTime: '2024-01-16T09:00:00.000Z',
          shouldFail: false,
        }, // 24 hours - maximum
        {
          startTime: '2024-01-15T09:00:00.000Z',
          endTime: '2024-01-16T10:00:00.000Z',
          shouldFail: true,
        }, // 25 hours - too long
      ];

      for (const testCase of testCases) {
        const workEntryData = {
          startTime: testCase.startTime,
          endTime: testCase.endTime,
          description: `Test duration: ${testCase.endTime}`,
        };

        const response = await request(app)
          .post('/api/work-entries')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(workEntryData);

        if (testCase.shouldFail) {
          expect(response.status).toBe(400);
          expect(response.body.success).toBe(false);
        } else {
          expect(response.status).toBe(201);
          expect(response.body.success).toBe(true);
        }
      }
    });

    it('should reject creation with empty description', async () => {
      const workEntryData = {
        startTime: '2024-01-15T09:00:00.000Z',
        endTime: '2024-01-15T17:00:00.000Z',
        description: '',
      };

      const response = await request(app)
        .post('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(workEntryData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid input data');
    });

    it('should sanitize description input', async () => {
      const workEntryData = {
        startTime: '2024-01-15T09:00:00.000Z',
        endTime: '2024-01-15T17:00:00.000Z',
        description: '  Working on   authentication   system  ',
      };

      const response = await request(app)
        .post('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(workEntryData)
        .expect(201);

      expect(response.body.data.description).toBe('Working on authentication system');
    });

    it('should create work entries for different users without conflict', async () => {
      // Create second user
      const secondUser = await prisma.user.create({
        data: {
          email: 'user2@example.com',
          password: 'hashedPassword2',
          firstName: 'User',
          lastName: 'Two',
        },
      });

      const secondUserToken = jwt.sign(
        { userId: secondUser.id, email: secondUser.email },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      // Both users create work entries for same time period
      const workEntryData = {
        startTime: '2024-01-15T09:00:00.000Z',
        endTime: '2024-01-15T17:00:00.000Z',
        description: 'Same time period work',
      };

      const response1 = await request(app)
        .post('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(workEntryData)
        .expect(201);

      const response2 = await request(app)
        .post('/api/work-entries')
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send(workEntryData)
        .expect(201);

      expect(response1.body.success).toBe(true);
      expect(response2.body.success).toBe(true);
      expect(response1.body.data.id).not.toBe(response2.body.data.id);
    });
  });

  describe('GET /api/work-entries', () => {
    beforeEach(async () => {
      // Ensure userId is available
      if (!userId) {
        throw new Error('userId is not available for creating work entries');
      }

      // Verify user exists in database
      const userExists = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!userExists) {
        throw new Error(`User with id ${userId} does not exist in database`);
      }

      // Create test work entries with different timestamps (using recent dates)
      const today = new Date();
      const workEntries = [
        {
          startTime: new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000), // 4 days ago, 9 AM
          endTime: new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000), // 4 days ago, 5 PM
          description: 'Backend development',
        },
        {
          startTime: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000), // 3 days ago, 10 AM
          endTime: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000 + 17.5 * 60 * 60 * 1000), // 3 days ago, 5:30 PM
          description: 'Project development',
        },
        {
          startTime: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000), // 2 days ago, 8 AM
          endTime: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000), // 2 days ago, 2 PM
          description: 'Bug fixes',
        },
        {
          startTime: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000), // Yesterday, 9 AM
          endTime: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000 + 17.5 * 60 * 60 * 1000), // Yesterday, 5:30 PM
          description: 'Code review',
        },
        {
          startTime: new Date(today.getTime() - 0 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000), // Today, 9 AM
          endTime: new Date(today.getTime() - 0 * 24 * 60 * 60 * 1000 + 13 * 60 * 60 * 1000), // Today, 1 PM
          description: 'Documentation',
        },
      ];

      await prisma.workEntry.createMany({
        data: workEntries.map((entry) => ({
          ...entry,
          userId,
        })),
      });
    });

    it('should retrieve all work entries for authenticated user', async () => {
      const response = await request(app)
        .get('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Work entries retrieved successfully',
        data: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            startTime: expect.any(String),
            endTime: expect.any(String),
            duration: expect.any(Number),
            description: expect.any(String),
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          }),
        ]),
        pagination: {
          page: 1,
          limit: 20,
          total: 5,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });
    });

    it('should filter work entries by date range', async () => {
      const response = await request(app)
        .get('/api/work-entries')
        .query({
          startDate: '2024-01-02',
          endDate: '2024-01-03',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.total).toBe(2);

      const startTimes = response.body.data.map((entry: any) => new Date(entry.startTime));
      startTimes.forEach((startTime: Date) => {
        expect(startTime >= new Date('2024-01-02')).toBe(true);
        expect(startTime <= new Date('2024-01-04')).toBe(true); // End date + 1 day
      });
    });

    it('should sort work entries by startTime in descending order', async () => {
      const response = await request(app)
        .get('/api/work-entries')
        .query({
          sortBy: 'startTime',
          sortOrder: 'desc',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const startTimes = response.body.data.map((entry: any) => new Date(entry.startTime));
      for (let i = 0; i < startTimes.length - 1; i++) {
        expect(startTimes[i] >= startTimes[i + 1]).toBe(true);
      }
    });

    it('should sort work entries by duration in ascending order', async () => {
      const response = await request(app)
        .get('/api/work-entries')
        .query({
          sortBy: 'duration',
          sortOrder: 'asc',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const durations = response.body.data.map((entry: any) => entry.duration);
      for (let i = 0; i < durations.length - 1; i++) {
        expect(durations[i] <= durations[i + 1]).toBe(true);
      }
    });

    it('should paginate work entries correctly', async () => {
      const response = await request(app)
        .get('/api/work-entries')
        .query({
          page: 1,
          limit: 3,
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 3,
        total: 5,
        totalPages: 2,
        hasNext: true,
        hasPrev: false,
      });
    });
  });

  describe('GET /api/work-entries/:id', () => {
    let workEntry: any;

    beforeEach(async () => {
      const workEntryData = {
        startTime: '2024-01-15T09:00:00.000Z',
        endTime: '2024-01-15T17:00:00.000Z',
        description: 'Test work entry',
      };

      const response = await request(app)
        .post('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(workEntryData);

      workEntry = response.body.data;
    });

    it('should retrieve a specific work entry', async () => {
      const response = await request(app)
        .get(`/api/work-entries/${workEntry.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Work entry retrieved successfully',
        data: {
          id: workEntry.id,
          startTime: '2024-01-15T09:00:00.000Z',
          endTime: '2024-01-15T17:00:00.000Z',
          duration: 8.0,
          description: 'Test work entry',
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });
    });

    it('should return 404 for non-existent work entry', async () => {
      const response = await request(app)
        .get('/api/work-entries/nonexistent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Work entry not found');
    });

    it('should prevent access to other users work entries', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@example.com',
          password: 'hashedPassword',
          firstName: 'Other',
          lastName: 'User',
        },
      });

      const otherUserToken = jwt.sign(
        { userId: otherUser.id, email: otherUser.email },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      // Try to access the work entry with other user's token
      const response = await request(app)
        .get(`/api/work-entries/${workEntry.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Work entry not found');
    });
  });

  describe('PUT /api/work-entries/:id', () => {
    let workEntry: any;

    beforeEach(async () => {
      const workEntryData = {
        startTime: '2024-01-15T09:00:00.000Z',
        endTime: '2024-01-15T17:00:00.000Z',
        description: 'Original work entry',
      };

      const response = await request(app)
        .post('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(workEntryData);

      workEntry = response.body.data;
    });

    it('should update a work entry successfully', async () => {
      const updateData = {
        startTime: '2024-01-16T10:00:00.000Z',
        endTime: '2024-01-16T17:30:00.000Z',
        description: 'Updated work entry',
      };

      const response = await request(app)
        .put(`/api/work-entries/${workEntry.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Work entry updated successfully',
        data: {
          id: workEntry.id,
          startTime: '2024-01-16T10:00:00.000Z',
          endTime: '2024-01-16T17:30:00.000Z',
          duration: 7.5,
          description: 'Updated work entry',
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });

      // Verify the changes in database
      const updatedEntry = await prisma.workEntry.findFirst({
        where: { id: workEntry.id },
      });

      expect(updatedEntry!.startTime).toEqual(new Date('2024-01-16T10:00:00.000Z'));
      expect(updatedEntry!.endTime).toEqual(new Date('2024-01-16T17:30:00.000Z'));
    });

    it('should update partial fields', async () => {
      const updateData = {
        description: 'Updated description only',
      };

      const response = await request(app)
        .put(`/api/work-entries/${workEntry.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.description).toBe('Updated description only');
      expect(response.body.data.startTime).toBe('2024-01-15T09:00:00.000Z'); // Unchanged
      expect(response.body.data.endTime).toBe('2024-01-15T17:00:00.000Z'); // Unchanged
    });

    it('should reject update with invalid time range', async () => {
      const updateData = {
        startTime: '2024-01-15T17:00:00.000Z',
        endTime: '2024-01-15T09:00:00.000Z', // End before start
      };

      const response = await request(app)
        .put(`/api/work-entries/${workEntry.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid input data');
    });

    it('should reject update with no fields provided', async () => {
      const response = await request(app)
        .put(`/api/work-entries/${workEntry.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid input data');
    });

    it('should return 404 for non-existent work entry', async () => {
      const updateData = {
        description: 'Updated description',
      };

      const response = await request(app)
        .put('/api/work-entries/nonexistent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Work entry not found');
    });

    it('should prevent updating other users work entries', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@example.com',
          password: 'hashedPassword',
          firstName: 'Other',
          lastName: 'User',
        },
      });

      const otherUserToken = jwt.sign(
        { userId: otherUser.id, email: otherUser.email },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const updateData = {
        description: 'Attempting to update other user entry',
      };

      const response = await request(app)
        .put(`/api/work-entries/${workEntry.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Work entry not found');
    });
  });

  describe('DELETE /api/work-entries/:id', () => {
    let workEntry: any;

    beforeEach(async () => {
      const workEntryData = {
        startTime: '2024-01-15T09:00:00.000Z',
        endTime: '2024-01-15T17:00:00.000Z',
        description: 'Work entry to delete',
      };

      const response = await request(app)
        .post('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(workEntryData);

      workEntry = response.body.data;
    });

    it('should delete a work entry successfully', async () => {
      const response = await request(app)
        .delete(`/api/work-entries/${workEntry.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Work entry deleted successfully',
      });

      // Verify the entry was deleted from database
      const deletedEntry = await prisma.workEntry.findFirst({
        where: { id: workEntry.id },
      });

      expect(deletedEntry).toBeNull();
    });

    it('should return 404 for non-existent work entry', async () => {
      const response = await request(app)
        .delete('/api/work-entries/nonexistent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Work entry not found');
    });

    it('should prevent deleting other users work entries', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@example.com',
          password: 'hashedPassword',
          firstName: 'Other',
          lastName: 'User',
        },
      });

      const otherUserToken = jwt.sign(
        { userId: otherUser.id, email: otherUser.email },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .delete(`/api/work-entries/${workEntry.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Work entry not found');
    });
  });

  describe('GET /api/work-entries/stats', () => {
    beforeEach(async () => {
      // Create test work entries with different durations
      const workEntries = [
        {
          startTime: new Date('2024-01-01T09:00:00.000Z'),
          endTime: new Date('2024-01-01T17:00:00.000Z'),
          description: 'Entry 1',
        }, // 8 hours
        {
          startTime: new Date('2024-01-02T08:00:00.000Z'),
          endTime: new Date('2024-01-02T14:00:00.000Z'),
          description: 'Entry 2',
        }, // 6 hours
        {
          startTime: new Date('2024-01-03T10:00:00.000Z'),
          endTime: new Date('2024-01-03T17:30:00.000Z'),
          description: 'Entry 3',
        }, // 7.5 hours
        {
          startTime: new Date('2024-01-04T09:00:00.000Z'),
          endTime: new Date('2024-01-04T17:30:00.000Z'),
          description: 'Entry 4',
        }, // 8.5 hours
        {
          startTime: new Date('2024-01-05T13:00:00.000Z'),
          endTime: new Date('2024-01-05T17:00:00.000Z'),
          description: 'Entry 5',
        }, // 4 hours
      ];

      await prisma.workEntry.createMany({
        data: workEntries.map((entry) => ({
          ...entry,
          userId,
        })),
      });
    });

    it('should return work entry statistics', async () => {
      const response = await request(app)
        .get('/api/work-entries/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Work entry statistics retrieved successfully',
        data: {
          totalHours: 34.0, // 8 + 6 + 7.5 + 8.5 + 4
          averageHours: 6.8, // 34 / 5
          totalEntries: 5,
        },
      });
    });

    it('should filter statistics by date range', async () => {
      const response = await request(app)
        .get('/api/work-entries/stats')
        .query({
          startDate: '2024-01-02',
          endDate: '2024-01-04',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toEqual({
        totalHours: 22.0, // 6 + 7.5 + 8.5
        averageHours: 7.33, // 22 / 3, rounded to 2 decimals
        totalEntries: 3,
      });
    });

    it('should handle empty results', async () => {
      const response = await request(app)
        .get('/api/work-entries/stats')
        .query({
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toEqual({
        totalHours: 0,
        averageHours: 0,
        totalEntries: 0,
      });
    });

    it('should reject requests with invalid date range', async () => {
      const response = await request(app)
        .get('/api/work-entries/stats')
        .query({
          startDate: '2024-01-15',
          endDate: '2024-01-10', // End before start
        })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Query contains potentially harmful content');
    });
  });

  describe('Authorization', () => {
    it('should require authentication for all endpoints', async () => {
      const workEntryData = {
        startTime: '2024-01-15T09:00:00.000Z',
        endTime: '2024-01-15T17:00:00.000Z',
        description: 'Test work entry',
      };

      // Test all endpoints without authentication
      await request(app).post('/api/work-entries').send(workEntryData).expect(401);

      await request(app).get('/api/work-entries').expect(401);

      await request(app).get('/api/work-entries/test-id').expect(401);

      await request(app).put('/api/work-entries/test-id').send(workEntryData).expect(401);

      await request(app).delete('/api/work-entries/test-id').expect(401);

      await request(app).get('/api/work-entries/stats').expect(401);
    });

    it('should reject invalid JWT tokens', async () => {
      const workEntryData = {
        startTime: '2024-01-15T09:00:00.000Z',
        endTime: '2024-01-15T17:00:00.000Z',
        description: 'Test work entry',
      };

      const response = await request(app)
        .post('/api/work-entries')
        .set('Authorization', 'Bearer invalid-token')
        .send(workEntryData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid token');
    });
  });

  describe('Edge Cases', () => {
    it('should handle future timestamps gracefully', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const workEntryData = {
        startTime: futureDate.toISOString(),
        endTime: new Date(futureDate.getTime() + 8 * 60 * 60 * 1000).toISOString(),
        description: 'Future work entry',
      };

      const response = await request(app)
        .post('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(workEntryData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid input data');
    });

    it('should handle concurrent creation requests', async () => {
      const workEntryData = {
        startTime: '2024-01-15T09:00:00.000Z',
        endTime: '2024-01-15T17:00:00.000Z',
        description: 'Concurrent work entry',
      };

      // Create multiple concurrent requests
      const requests = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/work-entries')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(workEntryData)
      );

      const responses = await Promise.all(requests);

      // All requests should succeed since we allow multiple entries per day
      responses.forEach((response) => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      // Verify all entries were created
      const entries = await prisma.workEntry.findMany({
        where: { userId },
      });

      expect(entries.length).toBe(5);
    });
  });
});
