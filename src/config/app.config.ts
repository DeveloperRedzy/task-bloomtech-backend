import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface AppConfig {
  port: number;
  nodeEnv: string;
  apiPrefix: string;
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
}

interface JWTConfig {
  secret: string;
  refreshSecret: string;
  expiresIn: string;
  refreshExpiresIn: string;
}

interface SecurityConfig {
  bcryptRounds: number;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  corsOrigin: string[];
}

interface DatabaseConfig {
  url: string;
  poolMin: number;
  poolMax: number;
}

interface LoggingConfig {
  level: string;
  file: string;
}

interface PaginationConfig {
  defaultLimit: number;
  maxLimit: number;
}

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

export const appConfig: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPrefix: process.env.API_PREFIX || '/api',
  isDevelopment: (process.env.NODE_ENV || 'development') === 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  isTest: (process.env.NODE_ENV || 'development') === 'test',
};

export const jwtConfig: JWTConfig = {
  secret: process.env.JWT_SECRET!,
  refreshSecret: process.env.JWT_REFRESH_SECRET!,
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
};

export const securityConfig: SecurityConfig = {
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
};

export const databaseConfig: DatabaseConfig = {
  url: process.env.DATABASE_URL!,
  poolMin: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
  poolMax: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
};

export const loggingConfig: LoggingConfig = {
  level: process.env.LOG_LEVEL || 'info',
  file: process.env.LOG_FILE || 'logs/app.log',
};

export const paginationConfig: PaginationConfig = {
  defaultLimit: parseInt(process.env.PAGINATION_DEFAULT_LIMIT || '10', 10),
  maxLimit: parseInt(process.env.PAGINATION_MAX_LIMIT || '100', 10),
};

// Export all configs as a single object
export const config = {
  app: appConfig,
  jwt: jwtConfig,
  security: securityConfig,
  database: databaseConfig,
  logging: loggingConfig,
  pagination: paginationConfig,
};
