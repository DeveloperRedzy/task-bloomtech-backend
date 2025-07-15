/**
 * Cache Service for query result caching
 * Implements in-memory caching with TTL (Time To Live) support
 * For production, this could be replaced with Redis or Memcached
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class CacheService {
  private cache = new Map<string, CacheItem<any>>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes default

  /**
   * Get item from cache
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    // Check if item has expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  /**
   * Set item in cache
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    };

    this.cache.set(key, item);
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clean expired items
   */
  cleanup(): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Generate cache key for work entries list
   */
  generateWorkEntriesKey(
    userId: string,
    filters: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
      startDate?: string | undefined;
      endDate?: string | undefined;
    }
  ): string {
    const filterStr = JSON.stringify(filters);
    return `work_entries:${userId}:${Buffer.from(filterStr).toString('base64')}`;
  }

  /**
   * Generate cache key for work entry stats
   */
  generateStatsKey(userId: string, startDate?: string, endDate?: string): string {
    return `work_stats:${userId}:${startDate || 'all'}:${endDate || 'all'}`;
  }

  /**
   * Generate cache key for work entry summary
   */
  generateSummaryKey(userId: string, limit: number): string {
    return `work_summary:${userId}:${limit}`;
  }

  /**
   * Invalidate user-related cache
   */
  invalidateUserCache(userId: string): number {
    let removedCount = 0;

    for (const key of this.cache.keys()) {
      if (key.includes(`${userId}:`)) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let expired = 0;
    let total = 0;

    for (const item of this.cache.values()) {
      total++;
      if (now - item.timestamp > item.ttl) {
        expired++;
      }
    }

    return {
      total,
      expired,
      active: total - expired,
      size: this.cache.size,
    };
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Setup automatic cleanup every 10 minutes
setInterval(
  () => {
    const removed = cacheService.cleanup();
    console.log(`🧹 Cache cleanup: removed ${removed} expired items`);
  },
  10 * 60 * 1000
);
