import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../../src/app';
import { createUserFactory, generateTestEmail } from '../factories/user.factory';
import { performanceMonitor } from '../../src/services/performance-monitor.service';

const prisma = new PrismaClient();

describe('Performance Tests', () => {
  let testUser: any;
  let accessToken: string;

  beforeAll(async () => {
    // Clean up database before tests
    await prisma.workEntry.deleteMany({});
    await prisma.user.deleteMany({});

    // Create test user
    const userData = {
      email: generateTestEmail('performance'),
      password: 'SecurePassword123!',
      firstName: 'Performance',
      lastName: 'Test',
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
    // Clean up after tests
    await prisma.workEntry.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('API Response Times', () => {
    it('should respond to health check within 50ms', async () => {
      const startTime = Date.now();

      const response = await request(app).get('/health').expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body.status).toBe('healthy');
      expect(responseTime).toBeLessThan(50);
    });

    it('should respond to login within 300ms', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'SecurePassword123!',
        })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(300);
    });

    it('should respond to work entries GET within 200ms', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(200);
    });

    it('should respond to work entry creation within 300ms', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/work-entries')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          date: '2024-01-15',
          hours: 8.0,
          description: 'Performance test entry',
        })
        .expect(201);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(300);
    });
  });

  describe('Database Performance', () => {
    it('should handle database queries efficiently', async () => {
      // Create test data
      const entries = Array.from({ length: 100 }, (_, i) => {
        const baseDate = new Date(2024, 0, i + 1);
        const startTime = new Date(baseDate.getTime() + 9 * 60 * 60 * 1000); // 9 AM
        const endTime = new Date(startTime.getTime() + 8 * 60 * 60 * 1000); // 8 hours later

        return {
          startTime,
          endTime,
          description: `Performance test entry ${i + 1}`,
          userId: testUser.id,
        };
      });

      const startTime = Date.now();

      // Use createMany for bulk insert
      await prisma.workEntry.createMany({
        data: entries,
      });

      const endTime = Date.now();
      const insertTime = endTime - startTime;

      // Should be able to insert 100 records in under 500ms
      expect(insertTime).toBeLessThan(500);

      // Test query performance
      const queryStart = Date.now();

      const results = await prisma.workEntry.findMany({
        where: { userId: testUser.id },
        take: 50,
        orderBy: { startTime: 'desc' },
      });

      const queryEnd = Date.now();
      const queryTime = queryEnd - queryStart;

      expect(results.length).toBe(50);
      expect(queryTime).toBeLessThan(100);
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 20;
      const promises = [];

      const startTime = Date.now();

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .get('/api/work-entries')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200)
        );
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should complete
      expect(results.length).toBe(concurrentRequests);
      results.forEach((result) => {
        expect(result.body.success).toBe(true);
      });

      // Should handle 20 concurrent requests in under 2 seconds
      expect(totalTime).toBeLessThan(2000);
    });
  });

  describe('Memory Usage', () => {
    it('should not have memory leaks during repeated operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform repeated operations
      for (let i = 0; i < 100; i++) {
        await request(app).get('/health').expect(200);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Load Testing', () => {
    it('should handle burst traffic without significant degradation', async () => {
      const burstSize = 50;
      const promises = [];
      const responseTimes: number[] = [];

      for (let i = 0; i < burstSize; i++) {
        promises.push(
          (async () => {
            const startTime = Date.now();
            await request(app).get('/health').expect(200);
            const endTime = Date.now();
            responseTimes.push(endTime - startTime);
          })()
        );
      }

      await Promise.all(promises);

      // Calculate average response time
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);

      // Average should be under 100ms, max under 300ms
      expect(avgResponseTime).toBeLessThan(100);
      expect(maxResponseTime).toBeLessThan(300);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics correctly', async () => {
      // Clean up old metrics
      performanceMonitor.cleanup();

      // Make several requests
      for (let i = 0; i < 10; i++) {
        await request(app).get('/health').expect(200);
      }

      // Check performance metrics
      const stats = performanceMonitor.getStats();

      expect(stats.totalQueries).toBeGreaterThanOrEqual(0);
      expect(stats.averageResponseTime).toBeGreaterThanOrEqual(0);
      expect(stats.averageResponseTime).toBeLessThan(1000);
    });
  });
});
