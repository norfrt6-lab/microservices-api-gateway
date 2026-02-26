import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../services/redis';
import { HEADERS, isValidIdempotencyKey } from '@microservices/shared';
import { logger } from '../config/logger';

const IDEMPOTENCY_TTL = 86400; // 24 hours
const KEY_PREFIX = 'idempotency:';

interface CachedResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * Gateway-level idempotency middleware.
 *
 * For mutation requests (POST, PUT, PATCH) that include an Idempotency-Key header:
 * 1. Check Redis for an existing response cached under that key
 * 2. If found, return the cached response immediately (no re-processing)
 * 3. If not found, let the request proceed, then cache the response
 *
 * This prevents duplicate side effects in distributed systems.
 */
export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Only apply to mutation methods
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
    return next();
  }

  const idempotencyKey = req.headers[HEADERS.IDEMPOTENCY_KEY] as string | undefined;

  // No key provided — skip
  if (!idempotencyKey) {
    return next();
  }

  // Validate key format
  if (!isValidIdempotencyKey(idempotencyKey)) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_IDEMPOTENCY_KEY', message: 'Idempotency key must be a valid UUID' },
    });
    return;
  }

  const redis = getRedisClient();
  const cacheKey = `${KEY_PREFIX}${idempotencyKey}`;

  redis
    .get(cacheKey)
    .then((cached) => {
      if (cached) {
        // Return cached response
        const cachedResponse: CachedResponse = JSON.parse(cached);
        logger.info({ idempotencyKey }, 'Idempotency cache hit — returning cached response');

        res.status(cachedResponse.statusCode);
        for (const [key, value] of Object.entries(cachedResponse.headers)) {
          res.setHeader(key, value);
        }
        res.setHeader('x-idempotent-replayed', 'true');
        res.end(cachedResponse.body);
        return;
      }

      // Cache miss — intercept the response to cache it
      const originalJson = res.json.bind(res);
      const originalEnd = res.end.bind(res);

      let responseBody = '';

      res.json = function (body: unknown) {
        responseBody = JSON.stringify(body);
        return originalJson(body);
      };

      res.end = function (chunk?: unknown, ...args: unknown[]) {
        if (chunk && !responseBody) {
          responseBody = typeof chunk === 'string' ? chunk : chunk.toString();
        }

        // Cache the response (only for successful or known responses)
        if (responseBody && res.statusCode < 500) {
          const toCache: CachedResponse = {
            statusCode: res.statusCode,
            headers: {
              'content-type': res.getHeader('content-type') as string || 'application/json',
            },
            body: responseBody,
          };

          redis.setex(cacheKey, IDEMPOTENCY_TTL, JSON.stringify(toCache)).catch((err) => {
            logger.error({ err, idempotencyKey }, 'Failed to cache idempotent response');
          });
        }

        return originalEnd(chunk, ...args);
      } as typeof res.end;

      next();
    })
    .catch((err) => {
      // Fail open — if Redis is down, proceed without idempotency
      logger.error({ err }, 'Idempotency check failed — proceeding without cache');
      next();
    });
}
