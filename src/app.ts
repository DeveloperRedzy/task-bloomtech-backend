import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config/app.config';
import authRoutes from './routes/auth.routes';
import workEntryRoutes from './routes/work-entry.routes';

const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.security.corsOrigin,
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMax,
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.app.nodeEnv,
    version: process.env.npm_package_version || '1.0.0',
  });
});

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

// API routes
app.use(`${config.app.apiPrefix}/auth`, authRoutes);
app.use(`${config.app.apiPrefix}/work-entries`, workEntryRoutes);

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
