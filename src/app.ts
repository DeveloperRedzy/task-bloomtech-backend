import express from 'express';
import compression from 'compression';
import { config } from './config/app.config';
import authRoutes from './routes/auth.routes';
import workEntryRoutes from './routes/work-entry.routes';
import healthRoutes from './routes/health.routes';

// Enhanced security middleware
import {
  corsMiddleware,
  helmetMiddleware,
  requestSizeLimiter,
  additionalSecurityHeaders,
  inputSanitizer,
  sqlInjectionProtection,
  securityLogger,
} from './middleware/security.middleware';
import { authRateLimit, apiRateLimit } from './middleware/rate-limit.middleware';

const app = express();

// Enhanced security middleware stack
app.use(helmetMiddleware); // Security headers
app.use(corsMiddleware); // CORS with environment-specific config
app.use(securityLogger); // Security logging
app.use(requestSizeLimiter); // Request size limits
app.use(additionalSecurityHeaders); // Additional security headers
app.use(inputSanitizer); // Input sanitization
app.use(sqlInjectionProtection); // SQL injection protection

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Health check and monitoring routes
app.use('/health', healthRoutes);

// Root endpoint
app.get('/', (_req, res) => {
  res.status(200).json({
    message: 'BloomTech Work Tracker API',
    version: '1.0.0',
    status: 'Server is running successfully',
    documentation: '/api/docs',
    health: '/health',
  });
});

// API routes with tiered rate limiting
app.use(`${config.app.apiPrefix}/auth`, authRateLimit, authRoutes); // Strict rate limiting for auth
app.use(`${config.app.apiPrefix}/work-entries`, apiRateLimit, workEntryRoutes); // Standard rate limiting for API

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: 'The requested endpoint does not exist',
  });
});

// Global error handler
app.use((error: Error, _req: express.Request, res: express.Response) => {
  console.error('Unhandled error:', error);

  res.status(500).json({
    error: 'Internal Server Error',
    message: config.app.isDevelopment ? error.message : 'Something went wrong',
    ...(config.app.isDevelopment && { stack: error.stack }),
  });
});

export default app;
