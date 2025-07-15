/**
 * Performance Monitor Service
 * Tracks database query performance and provides monitoring capabilities
 */

interface QueryMetric {
  operation: string;
  duration: number;
  timestamp: number;
  userId?: string;
  cacheHit?: boolean;
  error?: boolean;
  metadata?: Record<string, any>;
}

interface PerformanceStats {
  averageResponseTime: number;
  totalQueries: number;
  cacheHitRate: number;
  errorRate: number;
  slowestQueries: QueryMetric[];
  recentErrors: QueryMetric[];
}

class PerformanceMonitorService {
  private metrics: QueryMetric[] = [];
  private readonly maxMetrics = 1000; // Keep last 1000 metrics
  private readonly slowQueryThreshold = 1000; // 1 second

  /**
   * Start timing a query
   */
  startTimer(): () => number {
    const startTime = Date.now();

    return () => {
      return Date.now() - startTime;
    };
  }

  /**
   * Record a query metric
   */
  recordQuery(metric: Omit<QueryMetric, 'timestamp'>): void {
    const fullMetric: QueryMetric = {
      ...metric,
      timestamp: Date.now(),
    };

    this.metrics.push(fullMetric);

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log slow queries
    if (fullMetric.duration > this.slowQueryThreshold) {
      console.warn(
        `🐌 Slow query detected: ${fullMetric.operation} took ${fullMetric.duration}ms`,
        {
          ...fullMetric,
          metadata: fullMetric.metadata,
        }
      );
    }

    // Log errors
    if (fullMetric.error) {
      console.error(`❌ Query error: ${fullMetric.operation}`, fullMetric);
    }
  }

  /**
   * Get performance statistics
   */
  getStats(timeRangeMs: number = 60 * 60 * 1000): PerformanceStats {
    const cutoff = Date.now() - timeRangeMs;
    const recentMetrics = this.metrics.filter((m) => m.timestamp > cutoff);

    if (recentMetrics.length === 0) {
      return {
        averageResponseTime: 0,
        totalQueries: 0,
        cacheHitRate: 0,
        errorRate: 0,
        slowestQueries: [],
        recentErrors: [],
      };
    }

    // Calculate average response time
    const totalTime = recentMetrics.reduce((sum, m) => sum + m.duration, 0);
    const averageResponseTime = totalTime / recentMetrics.length;

    // Calculate cache hit rate
    const cacheableQueries = recentMetrics.filter((m) => m.cacheHit !== undefined);
    const cacheHits = cacheableQueries.filter((m) => m.cacheHit).length;
    const cacheHitRate =
      cacheableQueries.length > 0 ? (cacheHits / cacheableQueries.length) * 100 : 0;

    // Calculate error rate
    const errors = recentMetrics.filter((m) => m.error).length;
    const errorRate = (errors / recentMetrics.length) * 100;

    // Get slowest queries
    const slowestQueries = recentMetrics
      .filter((m) => !m.error)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    // Get recent errors
    const recentErrors = recentMetrics
      .filter((m) => m.error)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    return {
      averageResponseTime: Number(averageResponseTime.toFixed(2)),
      totalQueries: recentMetrics.length,
      cacheHitRate: Number(cacheHitRate.toFixed(2)),
      errorRate: Number(errorRate.toFixed(2)),
      slowestQueries,
      recentErrors,
    };
  }

  /**
   * Get metrics by operation
   */
  getMetricsByOperation(operation: string, timeRangeMs: number = 60 * 60 * 1000): QueryMetric[] {
    const cutoff = Date.now() - timeRangeMs;
    return this.metrics.filter((m) => m.operation === operation && m.timestamp > cutoff);
  }

  /**
   * Get metrics by user
   */
  getMetricsByUser(userId: string, timeRangeMs: number = 60 * 60 * 1000): QueryMetric[] {
    const cutoff = Date.now() - timeRangeMs;
    return this.metrics.filter((m) => m.userId === userId && m.timestamp > cutoff);
  }

  /**
   * Clear old metrics
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAge;
    const originalLength = this.metrics.length;
    this.metrics = this.metrics.filter((m) => m.timestamp > cutoff);

    const removed = originalLength - this.metrics.length;
    if (removed > 0) {
      console.log(`🧹 Performance metrics cleanup: removed ${removed} old metrics`);
    }

    return removed;
  }

  /**
   * Get health check data
   */
  getHealthCheck(): {
    status: 'healthy' | 'warning' | 'critical';
    metrics: {
      averageResponseTime: number;
      errorRate: number;
      cacheHitRate: number;
      totalQueries: number;
    };
    issues: string[];
  } {
    const stats = this.getStats(5 * 60 * 1000); // Last 5 minutes
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check average response time
    if (stats.averageResponseTime > 2000) {
      issues.push(`High average response time: ${stats.averageResponseTime}ms`);
      status = 'critical';
    } else if (stats.averageResponseTime > 1000) {
      issues.push(`Elevated response time: ${stats.averageResponseTime}ms`);
      if (status === 'healthy') status = 'warning';
    }

    // Check error rate
    if (stats.errorRate > 10) {
      issues.push(`High error rate: ${stats.errorRate}%`);
      status = 'critical';
    } else if (stats.errorRate > 5) {
      issues.push(`Elevated error rate: ${stats.errorRate}%`);
      if (status === 'healthy') status = 'warning';
    }

    // Check cache hit rate (if we have cacheable queries)
    if (stats.totalQueries > 10 && stats.cacheHitRate < 30) {
      issues.push(`Low cache hit rate: ${stats.cacheHitRate}%`);
      if (status === 'healthy') status = 'warning';
    }

    return {
      status,
      metrics: {
        averageResponseTime: stats.averageResponseTime,
        errorRate: stats.errorRate,
        cacheHitRate: stats.cacheHitRate,
        totalQueries: stats.totalQueries,
      },
      issues,
    };
  }

  /**
   * Monitor a function execution
   */
  async monitor<T>(
    operation: string,
    fn: () => Promise<T>,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<T> {
    const stopTimer = this.startTimer();
    let error = false;
    let result: T;

    try {
      result = await fn();
      return result;
    } catch (err) {
      error = true;
      throw err;
    } finally {
      const duration = stopTimer();

      const metric: Omit<QueryMetric, 'timestamp'> = {
        operation,
        duration,
        error,
      };
      if (userId) metric.userId = userId;
      if (metadata) metric.metadata = metadata;

      this.recordQuery(metric);
    }
  }

  /**
   * Monitor a cached function execution
   */
  async monitorCached<T>(
    operation: string,
    fn: () => Promise<T>,
    cacheKey: string,
    cacheGetter: (key: string) => T | null,
    cacheSetter: (key: string, value: T, ttl?: number) => void,
    userId?: string,
    metadata?: Record<string, any>,
    cacheTTL?: number
  ): Promise<T> {
    const stopTimer = this.startTimer();
    let error = false;
    let cacheHit = false;

    try {
      // Check cache first
      const cachedResult = cacheGetter(cacheKey);
      if (cachedResult !== null) {
        cacheHit = true;
        return cachedResult;
      }

      // Execute function
      const result = await fn();

      // Cache the result
      cacheSetter(cacheKey, result, cacheTTL);

      return result;
    } catch (err) {
      error = true;
      throw err;
    } finally {
      const duration = stopTimer();

      const metric: Omit<QueryMetric, 'timestamp'> = {
        operation,
        duration,
        cacheHit,
        error,
      };
      if (userId) metric.userId = userId;
      if (metadata) metric.metadata = metadata;

      this.recordQuery(metric);
    }
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitorService();

// Setup automatic cleanup every hour
setInterval(
  () => {
    performanceMonitor.cleanup();
  },
  60 * 60 * 1000
);
