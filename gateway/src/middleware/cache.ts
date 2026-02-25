import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../services/redis';
import { logger } from '../config/logger';
import { cacheHitsTotal, cacheMissesTotal } from '../telemetry/meter';

const DEFAULT_TTL = 60; // 60 seconds

interface CacheOptions {
  ttl?: number; // TTL in seconds
  keyPrefix?: string;
}

/**
 * Generates a cache key from the request.
 * Key format: cache:<prefix>:<method>:<path>:<sorted-query-params>
 */
function buildCacheKey(req: Request, prefix: string): string {
  const queryString = Object.keys(req.query)
    .sort()
    .map((k) => `${k}=${req.query[k]}`)
    .join('&');

  return `cache:${prefix}:${req.method}:${req.originalUrl.split('?')[0]}${queryString ? ':' + queryString : ''}`;
}

/**
 * Response caching middleware for GET requests.
 * Caches the full JSON response in Redis with TTL.
 * Only caches successful (2xx) GET responses.
 */
export function cacheMiddleware(options: CacheOptions = {}) {
  const { ttl = DEFAULT_TTL, keyPrefix = 'gw' } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip cache if client requests fresh data
    const cacheControl = req.headers['cache-control'];
    if (cacheControl === 'no-cache' || cacheControl === 'no-store') {
      return next();
    }

    const key = buildCacheKey(req, keyPrefix);

    try {
      const redis = getRedisClient();
      const cached = await redis.get(key);

      if (cached) {
        cacheHitsTotal.inc();
        logger.debug({ correlationId: req.correlationId, key }, 'Cache hit');

        const parsed = JSON.parse(cached);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', `public, max-age=${ttl}`);
        return res.status(parsed.statusCode || 200).json(parsed.body);
      }

      cacheMissesTotal.inc();
      logger.debug({ correlationId: req.correlationId, key }, 'Cache miss');
      res.setHeader('X-Cache', 'MISS');

      // Intercept the response to cache it
      const originalJson = res.json.bind(res);
      res.json = ((body: any) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const cacheEntry = JSON.stringify({
            statusCode: res.statusCode,
            body,
          });

          redis
            .setex(key, ttl, cacheEntry)
            .catch((err) => logger.error({ err, key }, 'Failed to write cache'));
        }

        res.setHeader('Cache-Control', `public, max-age=${ttl}`);
        return originalJson(body);
      }) as typeof res.json;

      next();
    } catch (err) {
      // If Redis is down, skip caching (fail-open)
      logger.error({ err, correlationId: req.correlationId }, 'Cache middleware error — failing open');
      next();
    }
  };
}

/**
 * Invalidates cache entries matching a pattern.
 * Called on POST/PUT/DELETE to keep cache consistent.
 */
export async function invalidateCache(pattern: string): Promise<void> {
  try {
    const redis = getRedisClient();
    const keys = await redis.keys(`cache:gw:*${pattern}*`);

    if (keys.length > 0) {
      await redis.del(...keys);
      logger.debug({ pattern, count: keys.length }, 'Cache invalidated');
    }
  } catch (err) {
    logger.error({ err, pattern }, 'Cache invalidation error');
  }
}

/**
 * Middleware that invalidates cache for mutation requests (POST/PUT/PATCH/DELETE).
 * Extracts the resource path and clears all related cache entries.
 */
export function cacheInvalidator() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      // Extract resource path: /api/v1/products/123 → /products
      const pathParts = req.originalUrl.split('/').filter(Boolean);
      // pathParts: ['api', 'v1', 'products', '123']
      if (pathParts.length >= 3) {
        const resource = `/${pathParts[2]}`;
        // Invalidate after response is sent
        _res.on('finish', () => {
          if (_res.statusCode >= 200 && _res.statusCode < 300) {
            invalidateCache(resource);
          }
        });
      }
    }
    next();
  };
}
