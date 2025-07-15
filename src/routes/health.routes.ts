import { Router, Request, Response } from 'express';
import { performanceMonitor } from '../services/performance-monitor.service';
import { cacheService } from '../services/cache.service';
import { getFailedAttemptsStats, getSuspiciousIPs } from '../middleware/rate-limit.middleware';

const router = Router();

/**
 * Basic health check endpoint
 */
router.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  });
});

/**
 * Detailed health check with performance metrics
 */
router.get('/detailed', (req: Request, res: Response) => {
  try {
    const healthCheck = performanceMonitor.getHealthCheck();
    const cacheStats = cacheService.getStats();
    const securityStats = getFailedAttemptsStats();
    const suspiciousIPs = getSuspiciousIPs();

    res.status(healthCheck.status === 'critical' ? 503 : 200).json({
      status: healthCheck.status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      performance: healthCheck.metrics,
      cache: cacheStats,
      security: {
        ...securityStats,
        suspiciousIPsCount: suspiciousIPs.length,
        status: securityStats.lockedAccounts > 0 ? 'warning' : 'healthy',
      },
      issues: healthCheck.issues,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Performance statistics endpoint
 */
router.get('/performance', (req: Request, res: Response) => {
  try {
    const timeRange = req.query.timeRange ? parseInt(req.query.timeRange as string) : undefined;
    const stats = performanceMonitor.getStats(timeRange);

    res.status(200).json({
      stats,
      timeRangeMs: timeRange || 60 * 60 * 1000,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve performance statistics',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Cache statistics endpoint
 */
router.get('/cache', (req: Request, res: Response) => {
  try {
    const stats = cacheService.getStats();

    res.status(200).json({
      stats,
      size: cacheService.size(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve cache statistics',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Security monitoring endpoint
 */
router.get('/security', (req: Request, res: Response) => {
  try {
    const securityStats = getFailedAttemptsStats();
    const suspiciousIPs = getSuspiciousIPs();
    const includeIPs = req.query.includeIPs === 'true';

    res.status(200).json({
      status: 'ok',
      security: {
        ...securityStats,
        suspiciousIPsCount: suspiciousIPs.length,
        suspiciousIPs: includeIPs ? suspiciousIPs : undefined,
        status: securityStats.lockedAccounts > 0 ? 'warning' : 'healthy',
        threatLevel:
          securityStats.lockedAccounts > 5
            ? 'high'
            : securityStats.totalActiveAttempts > 20
              ? 'medium'
              : 'low',
      },
      recommendations:
        securityStats.lockedAccounts > 0
          ? [
              'Monitor for potential brute force attacks',
              'Consider implementing additional security measures',
              'Review recent authentication logs',
            ]
          : [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve security statistics',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Cache management endpoints (for development/debugging)
 */
router.post('/cache/clear', (req: Request, res: Response) => {
  try {
    cacheService.clear();
    res.status(200).json({
      status: 'success',
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to clear cache',
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/cache/cleanup', (req: Request, res: Response) => {
  try {
    const removed = cacheService.cleanup();
    res.status(200).json({
      status: 'success',
      message: `Removed ${removed} expired cache items`,
      removed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to cleanup cache',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
