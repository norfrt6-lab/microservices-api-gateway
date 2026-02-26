import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { ServiceUnavailableError } from '../utils/errors';
import { circuitBreakerState as circuitBreakerGauge } from '../telemetry/meter';
import { getRedisClient } from '../services/redis';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold: number; // failures before opening circuit
  recoveryTimeout: number; // ms before trying half-open
  halfOpenMaxRequests: number; // max requests in half-open state
  keyPrefix: string;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  recoveryTimeout: 30000,
  halfOpenMaxRequests: 3,
  keyPrefix: 'circuit',
};

const CAN_REQUEST_SCRIPT = `
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local recoveryTimeout = tonumber(ARGV[2])
  local halfOpenMaxRequests = tonumber(ARGV[3])

  local state = redis.call('HGET', key, 'state')
  local failureCount = tonumber(redis.call('HGET', key, 'failureCount')) or 0
  local lastFailureTime = tonumber(redis.call('HGET', key, 'lastFailureTime')) or 0
  local halfOpenRequests = tonumber(redis.call('HGET', key, 'halfOpenRequests')) or 0
  local successCount = tonumber(redis.call('HGET', key, 'successCount')) or 0

  if not state then
    state = 'CLOSED'
    redis.call('HSET', key, 'state', state, 'failureCount', 0, 'lastFailureTime', 0, 'halfOpenRequests', 0, 'successCount', 0)
  end

  if state == 'OPEN' then
    local elapsed = now - lastFailureTime
    if elapsed >= recoveryTimeout then
      state = 'HALF_OPEN'
      halfOpenRequests = 0
      successCount = 0
      redis.call('HSET', key, 'state', state, 'halfOpenRequests', halfOpenRequests, 'successCount', successCount)
      return {1, state}
    end
    return {0, state}
  end

  if state == 'HALF_OPEN' then
    if halfOpenRequests < halfOpenMaxRequests then
      halfOpenRequests = halfOpenRequests + 1
      redis.call('HSET', key, 'halfOpenRequests', halfOpenRequests)
      return {1, state}
    end
    return {0, state}
  end

  return {1, state}
`;

const RECORD_SUCCESS_SCRIPT = `
  local key = KEYS[1]
  local halfOpenMaxRequests = tonumber(ARGV[1])

  local state = redis.call('HGET', key, 'state')
  local failureCount = tonumber(redis.call('HGET', key, 'failureCount')) or 0
  local successCount = tonumber(redis.call('HGET', key, 'successCount')) or 0

  if not state then
    state = 'CLOSED'
    failureCount = 0
    successCount = 0
  end

  if state == 'HALF_OPEN' then
    successCount = successCount + 1
    if successCount >= halfOpenMaxRequests then
      state = 'CLOSED'
      failureCount = 0
      successCount = 0
      redis.call('HSET', key, 'state', state, 'failureCount', failureCount, 'successCount', successCount, 'halfOpenRequests', 0)
    else
      redis.call('HSET', key, 'successCount', successCount)
    end
    return state
  end

  if state == 'CLOSED' then
    if failureCount > 0 then
      failureCount = 0
      redis.call('HSET', key, 'failureCount', failureCount)
    end
  end

  return state
`;

const RECORD_FAILURE_SCRIPT = `
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local failureThreshold = tonumber(ARGV[2])

  local state = redis.call('HGET', key, 'state')
  local failureCount = tonumber(redis.call('HGET', key, 'failureCount')) or 0

  if not state then
    state = 'CLOSED'
    failureCount = 0
  end

  if state == 'HALF_OPEN' then
    state = 'OPEN'
    redis.call('HSET', key, 'state', state, 'lastFailureTime', now, 'failureCount', 0, 'halfOpenRequests', 0, 'successCount', 0)
    return state
  end

  if state == 'CLOSED' then
    failureCount = failureCount + 1
    if failureCount >= failureThreshold then
      state = 'OPEN'
      redis.call('HSET', key, 'state', state, 'failureCount', failureCount, 'lastFailureTime', now)
      return state
    else
      redis.call('HSET', key, 'failureCount', failureCount, 'lastFailureTime', now)
      return state
    end
  end

  return state
`;

class RedisCircuitBreaker {
  private options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  private key(service: string) {
    return `${this.options.keyPrefix}:${service}`;
  }

  private setGauge(service: string, state: CircuitState) {
    const value = state === CircuitState.CLOSED ? 0 : state === CircuitState.OPEN ? 1 : 2;
    circuitBreakerGauge.set({ service }, value);
  }

  async canRequest(service: string): Promise<boolean> {
    try {
      const redis = getRedisClient();
      const result = await redis.eval(
        CAN_REQUEST_SCRIPT,
        1,
        this.key(service),
        Date.now(),
        this.options.recoveryTimeout,
        this.options.halfOpenMaxRequests,
      ) as [number, string];

      const [allowed, state] = result;
      const normalized = state as CircuitState;
      this.setGauge(service, normalized);

      if (normalized === CircuitState.OPEN && !allowed) {
        logger.warn({ service, state: normalized }, 'Circuit breaker OPEN — request rejected');
      }

      return Boolean(allowed);
    } catch (err) {
      logger.error({ err, service }, 'Circuit breaker error — failing open');
      return true;
    }
  }

  async recordSuccess(service: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const state = await redis.eval(
        RECORD_SUCCESS_SCRIPT,
        1,
        this.key(service),
        this.options.halfOpenMaxRequests,
      ) as string;

      const normalized = state as CircuitState;
      this.setGauge(service, normalized);

      if (normalized === CircuitState.CLOSED) {
        logger.info({ service, state: normalized }, 'Circuit breaker → CLOSED');
      }
    } catch (err) {
      logger.error({ err, service }, 'Circuit breaker recordSuccess error');
    }
  }

  async recordFailure(service: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const state = await redis.eval(
        RECORD_FAILURE_SCRIPT,
        1,
        this.key(service),
        Date.now(),
        this.options.failureThreshold,
      ) as string;

      const normalized = state as CircuitState;
      this.setGauge(service, normalized);

      if (normalized === CircuitState.OPEN) {
        logger.warn({ service, state: normalized }, 'Circuit breaker → OPEN');
      }
    } catch (err) {
      logger.error({ err, service }, 'Circuit breaker recordFailure error');
    }
  }

  async getState(service: string): Promise<CircuitState> {
    try {
      const redis = getRedisClient();
      const state = await redis.hget(this.key(service), 'state');
      return (state as CircuitState) || CircuitState.CLOSED;
    } catch {
      return CircuitState.CLOSED;
    }
  }

  async getStates(): Promise<Record<string, { state: CircuitState; failureCount: number }>> {
    try {
      const redis = getRedisClient();
      const keys = await redis.keys(`${this.options.keyPrefix}:*`);
      const states: Record<string, { state: CircuitState; failureCount: number }> = {};

      for (const key of keys) {
        const service = key.replace(`${this.options.keyPrefix}:`, '');
        const [stateRaw, failureCountRaw] = await redis.hmget(key, 'state', 'failureCount');
        const state = (stateRaw as CircuitState) || CircuitState.CLOSED;
        const failureCount = Number(failureCountRaw || 0);
        states[service] = { state, failureCount };
      }

      return states;
    } catch (err) {
      logger.error({ err }, 'Circuit breaker getStates error');
      return {};
    }
  }
}

// Singleton instance
export const circuitBreaker = new RedisCircuitBreaker();

/**
 * Express middleware that wraps the proxy with circuit breaker logic.
 * Extracts the service name from the route config target URL.
 */
export function circuitBreakerMiddleware(serviceName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const allowed = await circuitBreaker.canRequest(serviceName);

    if (!allowed) {
      return next(new ServiceUnavailableError(serviceName));
    }

    // Intercept response to record success/failure
    const originalEnd = res.end.bind(res);
    res.end = ((...args: Parameters<typeof originalEnd>) => {
      if (res.statusCode >= 500) {
        circuitBreaker.recordFailure(serviceName).catch(() => undefined);
      } else {
        circuitBreaker.recordSuccess(serviceName).catch(() => undefined);
      }
      return originalEnd(...args);
    }) as typeof res.end;

    next();
  };
}
