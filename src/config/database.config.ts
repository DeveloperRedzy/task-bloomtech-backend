import { PrismaClient } from '@prisma/client';
import { databaseConfig, appConfig } from './app.config';

// Create Prisma client instance with configuration
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseConfig.url,
    },
  },
  log: appConfig.isDevelopment ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
});

// Handle graceful shutdown
const gracefulShutdown = async (): Promise<void> => {
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Database health check
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
};

// Database initialization
export const initializeDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log('📊 Database connected successfully');

    const isHealthy = await checkDatabaseConnection();
    if (!isHealthy) {
      throw new Error('Database health check failed');
    }
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
};
