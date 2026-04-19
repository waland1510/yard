interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
  hitRate: number;
}

interface CacheOptions {
  defaultTTL?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
  cleanupInterval?: number; // Cleanup interval in milliseconds
  enableStats?: boolean;
}

export class MemoryCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    size: 0,
    hitRate: 0,
  };
  private cleanupTimer: NodeJS.Timeout | null = null;
  private options: Required<CacheOptions>;

  constructor(options: CacheOptions = {}) {
    this.options = {
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      maxSize: 1000,
      cleanupInterval: 60 * 1000, // 1 minute
      enableStats: true,
      ...options,
    };

    if (this.options.cleanupInterval > 0) {
      this.startCleanup();
    }
  }

  set(key: string, value: T, ttl?: number): void {
    const actualTTL = ttl ?? this.options.defaultTTL;
    
    // Check if we need to evict entries
    if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl: actualTTL,
      hits: 0,
    };

    this.cache.set(key, entry);
    
    if (this.options.enableStats) {
      this.stats.sets++;
      this.stats.size = this.cache.size;
    }
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      if (this.options.enableStats) {
        this.stats.misses++;
        this.updateHitRate();
      }
      return undefined;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      if (this.options.enableStats) {
        this.stats.misses++;
        this.stats.size = this.cache.size;
        this.updateHitRate();
      }
      return undefined;
    }

    // Update hit count and stats
    entry.hits++;
    if (this.options.enableStats) {
      this.stats.hits++;
      this.updateHitRate();
    }

    return entry.value;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      if (this.options.enableStats) {
        this.stats.size = this.cache.size;
      }
      return false;
    }
    
    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted && this.options.enableStats) {
      this.stats.deletes++;
      this.stats.size = this.cache.size;
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    if (this.options.enableStats) {
      this.stats.size = 0;
    }
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  values(): T[] {
    return Array.from(this.cache.values()).map(entry => entry.value);
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      size: this.cache.size,
      hitRate: 0,
    };
  }

  // Get or set pattern
  async getOrSet<U extends T>(
    key: string,
    factory: () => Promise<U> | U,
    ttl?: number
  ): Promise<U> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached as U;
    }

    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  // Batch operations
  mget(keys: string[]): (T | undefined)[] {
    return keys.map(key => this.get(key));
  }

  mset(entries: Array<[string, T, number?]>): void {
    entries.forEach(([key, value, ttl]) => {
      this.set(key, value, ttl);
    });
  }

  mdelete(keys: string[]): number {
    let deleted = 0;
    keys.forEach(key => {
      if (this.delete(key)) {
        deleted++;
      }
    });
    return deleted;
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (this.options.enableStats && keysToDelete.length > 0) {
      this.stats.size = this.cache.size;
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

// Game-specific cache instances
export const gameCache = new MemoryCache({
  defaultTTL: 10 * 60 * 1000, // 10 minutes
  maxSize: 500,
  cleanupInterval: 2 * 60 * 1000, // 2 minutes
});

export const playerCache = new MemoryCache({
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxSize: 1000,
  cleanupInterval: 60 * 1000, // 1 minute
});

export const aiDecisionCache = new MemoryCache({
  defaultTTL: 30 * 1000, // 30 seconds (AI decisions shouldn't be cached too long)
  maxSize: 200,
  cleanupInterval: 30 * 1000,
});

// Cache key generators
export const cacheKeys = {
  game: (channel: string) => `game:${channel}`,
  gameById: (id: number) => `game:id:${id}`,
  player: (gameId: number, role: string) => `player:${gameId}:${role}`,
  moves: (gameId: number) => `moves:${gameId}`,
  aiDecision: (gameState: string, playerRole: string) => `ai:${gameState}:${playerRole}`,
  gameState: (channel: string) => `gamestate:${channel}`,
};

// Cache decorators for functions
export function cached<T extends (...args: any[]) => Promise<any>>(
  cache: MemoryCache,
  keyGenerator: (...args: Parameters<T>) => string,
  ttl?: number
) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: Parameters<T>) {
      const key = keyGenerator(...args);
      const cached = cache.get(key);
      
      if (cached !== undefined) {
        return cached;
      }

      const result = await method.apply(this, args);
      cache.set(key, result, ttl);
      return result;
    };

    return descriptor;
  };
}

// Utility functions
export function createCacheMiddleware(cache: MemoryCache, keyGenerator: (req: any) => string, ttl?: number) {
  return (req: any, reply: any, next: () => void) => {
    const key = keyGenerator(req);
    const cached = cache.get(key);
    
    if (cached !== undefined) {
      reply.send(cached);
      return;
    }

    // Override reply.send to cache the response
    const originalSend = reply.send;
    reply.send = function (payload: any) {
      cache.set(key, payload, ttl);
      return originalSend.call(this, payload);
    };

    next();
  };
}

export function warmupCache() {
  // Pre-populate cache with frequently accessed data
  console.log('Warming up cache...');
  // Implementation would depend on your specific use case
}

export function getCacheMetrics() {
  return {
    game: gameCache.getStats(),
    player: playerCache.getStats(),
    aiDecision: aiDecisionCache.getStats(),
  };
}
