import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../src/app';
import { createUserFactory, generateTestEmail } from '../factories/user.factory';
import { cacheService } from '../../src/services/cache.service';
import { performanceMonitor } from '../../src/services/performance-monitor.service';

const prisma = new PrismaClient();

describe('Advanced Features Integration Tests', () => {
  let testUser: any;
  let accessToken: string;
  let userId: string;

  beforeEach(async () => {
    // Clean up database and cache before each test
    await prisma.workEntry.deleteMany({});
    await prisma.user.deleteMany({});
    cacheService.clear();

    // Clear performance monitor metrics (no reset method available)
    // performanceMonitor.reset(); // This method doesn't exist

    // Create test user
    const userData = {
      email: generateTestEmail('advanced'),
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

    accessToken = loginResponse.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    // Clean up after all tests
    await prisma.workEntry.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('Advanced Pagination Features', () => {
    beforeEach(async () => {
      // Ensure userId is available
      if (!userId) {
        throw new Error('User ID not available for work entry creation');
      }

      // Create 25 work entries for pagination testing
      const workEntries = Array.from({ length: 25 }, (_, i) => {
        const baseDate = new Date(2024, 0, i + 1); // Jan 1-25, 2024
        const hours = 8.0 + (i % 3) * 0.5; // Varying hours: 8.0, 8.5, 9.0
        const startTime = new Date(baseDate.getTime() + 9 * 60 * 60 * 1000); // 9 AM
        const endTime = new Date(startTime.getTime() + hours * 60 * 60 * 1000); // Add hours

        return {
          startTime,
          endTime,
          description: `Work entry ${i + 1}`,
          userId,
        };
      });

      await prisma.workEntry.createMany({
        data: workEntries,
      });
    });

    it('should handle basic pagination correctly', async () => {
      const response = await request(app)
        .get('/api/work-entries?page=1&limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(10);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNext: true,
        hasPrev: false,
      });
    });

    it('should handle middle page navigation', async () => {
      const response = await request(app)
        .get('/api/work-entries?page=2&limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.workEntries).toHaveLength(10);
      expect(response.body.data.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        pages: 3,
        hasNext: true,
        hasPrev: true,
      });
    });

    it('should handle last page correctly', async () => {
      const response = await request(app)
        .get('/api/work-entries?page=3&limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.workEntries).toHaveLength(5);
      expect(response.body.data.pagination).toEqual({
        page: 3,
        limit: 10,
        total: 25,
        pages: 3,
        hasNext: false,
        hasPrev: true,
      });
    });

    it('should handle edge case of requesting beyond last page', async () => {
      const response = await request(app)
        .get('/api/work-entries?page=10&limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.workEntries).toHaveLength(0);
      expect(response.body.data.pagination).toEqual({
        page: 10,
        limit: 10,
        total: 25,
        pages: 3,
        hasNext: false,
        hasPrev: true,
      });
    });

    it('should validate pagination parameters', async () => {
      // Test invalid page number
      const response1 = await request(app)
        .get('/api/work-entries?page=0&limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response1.body.success).toBe(false);

      // Test invalid limit
      const response2 = await request(app)
        .get('/api/work-entries?page=1&limit=0')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response2.body.success).toBe(false);

      // Test limit exceeding maximum
      const response3 = await request(app)
        .get('/api/work-entries?page=1&limit=1000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response3.body.success).toBe(false);
    });

    it('should handle different page sizes correctly', async () => {
      const pageSizes = [5, 15, 25, 50];

      for (const pageSize of pageSizes) {
        const response = await request(app)
          .get(`/api/work-entries?page=1&limit=${pageSize}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        const expectedCount = Math.min(pageSize, 25);
        expect(response.body.data.workEntries).toHaveLength(expectedCount);
        expect(response.body.data.pagination.limit).toBe(pageSize);
      }
    });
  });

  describe('Advanced Filtering Features', () => {
    beforeEach(async () => {
      // Ensure userId is available
      if (!userId) {
        throw new Error('User ID not available for work entry creation');
      }

      // Create work entries across different months and hours
      const workEntries = [
        {
          startTime: new Date(2024, 0, 15, 9, 0),
          endTime: new Date(2024, 0, 15, 17, 0),
          description: 'January work',
        },
        {
          startTime: new Date(2024, 1, 15, 9, 0),
          endTime: new Date(2024, 1, 15, 16, 30),
          description: 'February work',
        },
        {
          startTime: new Date(2024, 2, 15, 9, 0),
          endTime: new Date(2024, 2, 15, 15, 0),
          description: 'March work',
        },
        {
          startTime: new Date(2024, 3, 15, 9, 0),
          endTime: new Date(2024, 3, 15, 17, 30),
          description: 'April work',
        },
        {
          startTime: new Date(2024, 4, 15, 9, 0),
          endTime: new Date(2024, 4, 15, 13, 0),
          description: 'May work',
        },
        {
          startTime: new Date(2024, 5, 15, 9, 0),
          endTime: new Date(2024, 5, 15, 18, 0),
          description: 'June work',
        },
      ];

      await prisma.workEntry.createMany({
        data: workEntries.map((entry) => ({ ...entry, userId })),
      });
    });

    it('should filter by date range correctly', async () => {
      const response = await request(app)
        .get('/api/work-entries?startDate=2024-02-01&endDate=2024-04-30')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.workEntries).toHaveLength(3);

      const descriptions = response.body.data.workEntries.map((entry: any) => entry.description);
      expect(descriptions).toContain('February work');
      expect(descriptions).toContain('March work');
      expect(descriptions).toContain('April work');
    });

    it('should filter by start date only', async () => {
      const response = await request(app)
        .get('/api/work-entries?startDate=2024-04-01')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.workEntries).toHaveLength(3);

      const descriptions = response.body.data.workEntries.map((entry: any) => entry.description);
      expect(descriptions).toContain('April work');
      expect(descriptions).toContain('May work');
      expect(descriptions).toContain('June work');
    });

    it('should filter by end date only', async () => {
      const response = await request(app)
        .get('/api/work-entries?endDate=2024-03-31')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.workEntries).toHaveLength(3);

      const descriptions = response.body.data.workEntries.map((entry: any) => entry.description);
      expect(descriptions).toContain('January work');
      expect(descriptions).toContain('February work');
      expect(descriptions).toContain('March work');
    });

    it('should combine filtering with pagination', async () => {
      const response = await request(app)
        .get('/api/work-entries?startDate=2024-02-01&endDate=2024-05-31&page=1&limit=2')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.workEntries).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(4);
      expect(response.body.data.pagination.pages).toBe(2);
    });

    it('should handle invalid date formats', async () => {
      const response = await request(app)
        .get('/api/work-entries?startDate=invalid-date')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });

    it('should handle start date after end date', async () => {
      const response = await request(app)
        .get('/api/work-entries?startDate=2024-05-01&endDate=2024-03-01')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Start date must be before end date');
    });
  });

  describe('Advanced Sorting Features', () => {
    beforeEach(async () => {
      // Ensure userId is available
      if (!userId) {
        throw new Error('User ID not available for work entry creation');
      }

      // Create work entries with different dates and durations for sorting
      const workEntries = [
        {
          startTime: new Date(2024, 0, 15, 9, 0),
          endTime: new Date(2024, 0, 15, 17, 0),
          description: 'Alpha work',
        },
        {
          startTime: new Date(2024, 0, 10, 9, 0),
          endTime: new Date(2024, 0, 10, 15, 0),
          description: 'Beta work',
        },
        {
          startTime: new Date(2024, 0, 20, 9, 0),
          endTime: new Date(2024, 0, 20, 16, 30),
          description: 'Gamma work',
        },
        {
          startTime: new Date(2024, 0, 5, 9, 0),
          endTime: new Date(2024, 0, 5, 18, 0),
          description: 'Delta work',
        },
        {
          startTime: new Date(2024, 0, 25, 9, 0),
          endTime: new Date(2024, 0, 25, 13, 0),
          description: 'Epsilon work',
        },
      ];

      await prisma.workEntry.createMany({
        data: workEntries.map((entry) => ({ ...entry, userId })),
      });
    });

    it('should sort by startTime ascending', async () => {
      const response = await request(app)
        .get('/api/work-entries?sortBy=startTime&sortOrder=asc')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const startTimes = response.body.data.workEntries.map(
        (entry: any) => new Date(entry.startTime)
      );

      for (let i = 1; i < startTimes.length; i++) {
        expect(startTimes[i].getTime()).toBeGreaterThanOrEqual(startTimes[i - 1].getTime());
      }
    });

    it('should sort by startTime descending', async () => {
      const response = await request(app)
        .get('/api/work-entries?sortBy=startTime&sortOrder=desc')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const startTimes = response.body.data.workEntries.map(
        (entry: any) => new Date(entry.startTime)
      );

      for (let i = 1; i < startTimes.length; i++) {
        expect(startTimes[i].getTime()).toBeLessThanOrEqual(startTimes[i - 1].getTime());
      }
    });

    it('should sort by duration ascending', async () => {
      const response = await request(app)
        .get('/api/work-entries?sortBy=duration&sortOrder=asc')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const durations = response.body.data.workEntries.map((entry: any) => entry.duration);

      for (let i = 1; i < durations.length; i++) {
        expect(durations[i]).toBeGreaterThanOrEqual(durations[i - 1]);
      }
    });

    it('should sort by duration descending', async () => {
      const response = await request(app)
        .get('/api/work-entries?sortBy=duration&sortOrder=desc')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const durations = response.body.data.workEntries.map((entry: any) => entry.duration);

      for (let i = 1; i < durations.length; i++) {
        expect(durations[i]).toBeLessThanOrEqual(durations[i - 1]);
      }
    });

    it('should combine sorting with filtering and pagination', async () => {
      const response = await request(app)
        .get('/api/work-entries?sortBy=duration&sortOrder=desc&page=1&limit=3')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.workEntries).toHaveLength(3);
      const durations = response.body.data.workEntries.map((entry: any) => entry.duration);
      expect(durations[0]).toBeGreaterThanOrEqual(durations[1]);
      expect(durations[1]).toBeGreaterThanOrEqual(durations[2]);
    });

    it('should handle invalid sort parameters', async () => {
      const response = await request(app)
        .get('/api/work-entries?sortBy=invalid&sortOrder=asc')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });
  });

  describe('Caching System Integration', () => {
    beforeEach(async () => {
      // Ensure userId is available
      if (!userId) {
        throw new Error('User ID not available for work entry creation');
      }

      // Create test work entries
      const workEntries = Array.from({ length: 10 }, (_, i) => {
        const baseDate = new Date(2024, 0, i + 1);
        const startTime = new Date(baseDate.getTime() + 9 * 60 * 60 * 1000); // 9 AM
        const endTime = new Date(startTime.getTime() + 8 * 60 * 60 * 1000); // 8 hours later

        return {
          startTime,
          endTime,
          description: `Cached work entry ${i + 1}`,
          userId,
        };
      });

      await prisma.workEntry.createMany({
        data: workEntries,
      });
    });

    it('should cache work entries list requests', async () => {
      // Clear cache to ensure fresh start
      cacheService.clear();

      // First request - should hit database
      const response1 = await request(app)
        .get('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Second request - should use cache
      const response2 = await request(app)
        .get('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response1.body).toEqual(response2.body);
      expect(response1.body.data.workEntries).toHaveLength(10);
    });

    it('should cache with different query parameters separately', async () => {
      cacheService.clear();

      // Request with page 1
      const response1 = await request(app)
        .get('/api/work-entries?page=1&limit=5')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Request with page 2
      const response2 = await request(app)
        .get('/api/work-entries?page=2&limit=5')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response1.body.data.workEntries).toHaveLength(5);
      expect(response2.body.data.workEntries).toHaveLength(5);
      expect(response1.body.data.pagination.page).toBe(1);
      expect(response2.body.data.pagination.page).toBe(2);
    });

    it('should invalidate cache on data modification', async () => {
      cacheService.clear();

      // First request - populate cache
      const response1 = await request(app)
        .get('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response1.body.data.workEntries).toHaveLength(10);

      // Create new work entry - should invalidate cache
      await request(app)
        .post('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          startTime: '2024-01-15T09:00:00.000Z',
          endTime: '2024-01-15T17:00:00.000Z',
          description: 'New work entry',
        });

      // Second request - should reflect new data
      const response2 = await request(app)
        .get('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response2.body.data.workEntries).toHaveLength(11);
    });

    it('should handle cache TTL expiration', async () => {
      cacheService.clear();

      // Create entry with short TTL for testing
      const cacheKey = `work-entries:${userId}:{}`;
      const testData = { test: 'data' };

      cacheService.set(cacheKey, testData, 1); // 1 second TTL

      expect(cacheService.get(cacheKey)).toEqual(testData);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(cacheService.get(cacheKey)).toBeNull();
    });

    it('should handle cache statistics', async () => {
      cacheService.clear();

      // Make multiple requests to generate cache statistics
      for (let i = 0; i < 5; i++) {
        await request(app).get('/api/work-entries').set('Authorization', `Bearer ${accessToken}`);
      }

      const stats = cacheService.getStats();
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.active).toBeGreaterThan(0);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('Performance Monitoring Integration', () => {
    beforeEach(async () => {
      // Ensure userId is available
      if (!userId) {
        throw new Error('User ID not available for work entry creation');
      }

      // Create test work entries
      await prisma.workEntry.createMany({
        data: Array.from({ length: 50 }, (_, i) => {
          const baseDate = new Date(2024, 0, i + 1);
          const startTime = new Date(baseDate.getTime() + 9 * 60 * 60 * 1000); // 9 AM
          const endTime = new Date(startTime.getTime() + 8 * 60 * 60 * 1000); // 8 hours later

          return {
            startTime,
            endTime,
            description: `Performance test entry ${i + 1}`,
            userId,
          };
        }),
      });
    });

    it('should track API response times', async () => {
      // Make multiple requests
      for (let i = 0; i < 10; i++) {
        await request(app).get('/api/work-entries').set('Authorization', `Bearer ${accessToken}`);
      }

      const stats = performanceMonitor.getStats();
      expect(stats.totalQueries).toBeGreaterThan(0);
      expect(stats.averageResponseTime).toBeGreaterThan(0);
      expect(stats.errorRate).toBeGreaterThanOrEqual(0);
      expect(stats.cacheHitRate).toBeGreaterThanOrEqual(0);
    });

    it('should track different endpoint performance separately', async () => {
      // Make requests to different endpoints
      await request(app).get('/api/work-entries').set('Authorization', `Bearer ${accessToken}`);

      await request(app)
        .post('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          startTime: '2024-01-15T09:00:00.000Z',
          endTime: '2024-01-15T17:00:00.000Z',
          description: 'Performance test',
        });

      const stats = performanceMonitor.getStats();
      expect(stats.totalQueries).toBeGreaterThan(0);
      expect(stats.averageResponseTime).toBeGreaterThan(0);
      expect(stats.errorRate).toBeGreaterThanOrEqual(0);
    });

    it('should track error rates', async () => {
      // Make successful requests
      for (let i = 0; i < 5; i++) {
        await request(app).get('/api/work-entries').set('Authorization', `Bearer ${accessToken}`);
      }

      // Make failed requests
      for (let i = 0; i < 2; i++) {
        await request(app).get('/api/work-entries').set('Authorization', 'Bearer invalid-token');
      }

      const stats = performanceMonitor.getStats();
      expect(stats.totalQueries).toBeGreaterThan(0);
      expect(stats.errorRate).toBeGreaterThan(0);
    });

    it('should track performance metrics', async () => {
      // Make requests that would generate metrics
      for (let i = 0; i < 10; i++) {
        await request(app)
          .get('/api/work-entries?limit=50')
          .set('Authorization', `Bearer ${accessToken}`);
      }

      const stats = performanceMonitor.getStats();
      expect(stats.totalQueries).toBeGreaterThan(0);
      expect(stats.averageResponseTime).toBeGreaterThan(0);
      expect(stats.errorRate).toBeGreaterThanOrEqual(0);
      expect(stats.cacheHitRate).toBeGreaterThanOrEqual(0);
    });

    it('should track slowest queries', async () => {
      // Make multiple requests with varying response times
      for (let i = 0; i < 20; i++) {
        await request(app).get('/api/work-entries').set('Authorization', `Bearer ${accessToken}`);
      }

      const stats = performanceMonitor.getStats();
      expect(stats.totalQueries).toBeGreaterThan(0);
      expect(stats.averageResponseTime).toBeGreaterThan(0);
      expect(stats.slowestQueries).toBeInstanceOf(Array);
      expect(stats.recentErrors).toBeInstanceOf(Array);
    });
  });

  describe('Health Check Integration', () => {
    it('should provide basic health check', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        environment: 'test',
      });
    });

    it('should provide detailed health check', async () => {
      const response = await request(app).get('/health/detailed').expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        environment: 'test',
        database: {
          status: 'connected',
          responseTime: expect.any(Number),
        },
        cache: {
          status: 'operational',
          hitRate: expect.any(Number),
          size: expect.any(Number),
        },
        performance: {
          averageResponseTime: expect.any(Number),
          totalRequests: expect.any(Number),
          errorRate: expect.any(Number),
          memoryUsage: expect.any(Number),
        },
      });
    });
  });

  describe('Complex Integration Scenarios', () => {
    beforeEach(async () => {
      // Ensure userId is available
      if (!userId) {
        throw new Error('User ID not available for work entry creation');
      }

      // Create comprehensive test data
      await prisma.workEntry.createMany({
        data: Array.from({ length: 100 }, (_, i) => {
          const baseDate = new Date(2024, Math.floor(i / 10), (i % 10) + 1);
          const hours = 4.0 + (i % 10) * 0.5;
          const startTime = new Date(baseDate.getTime() + 9 * 60 * 60 * 1000); // 9 AM
          const endTime = new Date(startTime.getTime() + hours * 60 * 60 * 1000); // Add variable hours

          return {
            startTime,
            endTime,
            description: `Complex test entry ${i + 1}`,
            userId,
          };
        }),
      });
    });

    it('should handle complex queries with all features combined', async () => {
      const response = await request(app)
        .get(
          '/api/work-entries?startDate=2024-03-01&endDate=2024-06-30&sortBy=hours&sortOrder=desc&page=2&limit=15'
        )
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.data.workEntries).toHaveLength(15);
      expect(response.body.data.pagination.page).toBe(2);
      expect(response.body.data.pagination.limit).toBe(15);

      // Verify sorting
      const hours = response.body.data.workEntries.map((entry: any) => entry.hours);
      for (let i = 1; i < hours.length; i++) {
        expect(hours[i]).toBeLessThanOrEqual(hours[i - 1]);
      }
    });

    it('should maintain performance under load', async () => {
      // Simulate concurrent requests
      const promises = Array.from({ length: 20 }, () =>
        request(app).get('/api/work-entries?limit=50').set('Authorization', `Bearer ${accessToken}`)
      );

      const results = await Promise.allSettled(promises);

      // All requests should succeed
      const successful = results.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 200
      );

      expect(successful).toHaveLength(20);

      // Performance should still be acceptable
      const stats = performanceMonitor.getStats();
      expect(stats.averageResponseTime).toBeLessThan(500); // Under 500ms
      expect(stats.errorRate).toBeLessThanOrEqual(10); // Allow some error tolerance
    });

    it('should handle edge cases gracefully', async () => {
      // Test with extreme pagination
      const response1 = await request(app)
        .get('/api/work-entries?page=1000&limit=100')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response1.body.data.workEntries).toHaveLength(0);

      // Test with very restrictive filters
      const response2 = await request(app)
        .get('/api/work-entries?startDate=2025-01-01&endDate=2025-01-01')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response2.body.data.workEntries).toHaveLength(0);
    });
  });
});
