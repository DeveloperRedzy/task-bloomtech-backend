import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

// Global test configuration
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/worktracker_test',
    },
  },
});

// Make Prisma available globally in tests
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient;
}

global.prisma = prisma;

// Setup and teardown hooks
beforeAll(async () => {
  // Connect to test database
  await prisma.$connect();

  // Run migrations
  // Note: In a real setup, you'd run migrations here
  console.log('🧪 Test database connected');
});

afterAll(async () => {
  // Disconnect from database
  await prisma.$disconnect();
  console.log('🧪 Test database disconnected');
});

beforeEach(() => {
  // Setup before each test
  jest.clearAllMocks();
});

afterEach(async () => {
  // Cleanup after each test
  // Note: In integration tests, you might want to clean up test data
});

// Increase timeout for database operations
jest.setTimeout(30000);
