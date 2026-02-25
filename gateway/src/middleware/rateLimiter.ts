import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../services/redis';
import { config } from '../config';
import { logger } from '../config/logger';
import { TooManyRequestsError } from '../utils/errors';
import { rateLimitHitsTotal } from '../telemetry/meter';

/**
 * Lua script for atomic token bucket rate limiting.
 * Returns: [allowed (0/1), remaining tokens, retry-after seconds]
 */
const TOKEN_BUCKET_SCRIPT = `
  local key = KEYS[1]
  local max_tokens = tonumber(ARGV[1])
  local window_ms = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])

  local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
  local tokens = tonumber(bucket[1])
  local last_refill = tonumber(bucket[2])

  -- Initialize bucket if it doesn't exist
  if tokens == nil then
    tokens = max_tokens
    last_refill = now
  end

  -- Refill tokens based on elapsed time
  local elapsed = now - last_refill
  local refill_rate = max_tokens / window_ms
  local new_tokens = math.min(max_tokens, tokens + (elapsed * refill_rate))

  -- Try to consume a token
  if new_tokens >= 1 then
    new_tokens = new_tokens - 1
    redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
    redis.call('PEXPIRE', key, window_ms)
    return {1, math.floor(new_tokens), 0}
  else
    -- Calculate retry-after in seconds
    local wait_ms = (1 - new_tokens) / refill_rate
    redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
    redis.call('PEXPIRE', key, window_ms)
    return {0, 0, math.ceil(wait_ms / 1000)}
  end
`;

function getRateLimitKey(req: Request): { key: string; limit: number } {
  // Authenticated users get higher limits, keyed by userId
  if (req.user) {
    return {
      key: `ratelimit:user:${req.user.userId}`,
      limit: config.rateLimit.authenticatedMax,
    };
  }

  // Anonymous users keyed by IP
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return {
    key: `ratelimit:ip:${ip}`,
    limit: config.rateLimit.maxRequests,
  };
}

export async function rateLimiter(req: Request, res: Response, next: NextFunction) {
  try {
    const redis = getRedisClient();
    const { key, limit } = getRateLimitKey(req);

    const result = await redis.eval(
      TOKEN_BUCKET_SCRIPT,
      1,
      key,
      limit,
      config.rateLimit.windowMs,
      Date.now(),
    ) as [number, number, number];

    const [allowed, remaining, retryAfter] = result;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + Math.ceil(config.rateLimit.windowMs / 1000));

    if (!allowed) {
      res.setHeader('Retry-After', retryAfter);
      rateLimitHitsTotal.inc({ tier: req.user ? 'authenticated' : 'anonymous' });
      logger.warn(
        { correlationId: req.correlationId, key, retryAfter },
        'Rate limit exceeded',
      );
      return next(new TooManyRequestsError(retryAfter));
    }

    next();
  } catch (err) {
    // If Redis is down, allow the request through (fail-open)
    logger.error({ err, correlationId: req.correlationId }, 'Rate limiter error — failing open');
    next();
  }
}
