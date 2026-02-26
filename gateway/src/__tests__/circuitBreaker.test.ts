import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockRedis = {
  eval: vi.fn(),
  hget: vi.fn(),
  hmget: vi.fn(),
  keys: vi.fn(),
};

vi.mock('../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../services/redis', () => ({
  getRedisClient: vi.fn(() => mockRedis),
}));

vi.mock('../telemetry/meter', () => ({
  circuitBreakerState: { set: vi.fn() },
}));

import { circuitBreaker, CircuitState } from '../middleware/circuitBreaker';
import { getRedisClient } from '../services/redis';
import { circuitBreakerState } from '../telemetry/meter';

describe('Redis-backed CircuitBreaker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows request when Redis script returns CLOSED', async () => {
    mockRedis.eval.mockResolvedValueOnce([1, CircuitState.CLOSED]);

    const allowed = await circuitBreaker.canRequest('user-service');

    expect(allowed).toBe(true);
    expect(getRedisClient).toHaveBeenCalled();
    expect(circuitBreakerState.set).toHaveBeenCalledWith({ service: 'user-service' }, 0);
  });

  it('rejects request when Redis script returns OPEN', async () => {
    mockRedis.eval.mockResolvedValueOnce([0, CircuitState.OPEN]);

    const allowed = await circuitBreaker.canRequest('product-service');

    expect(allowed).toBe(false);
    expect(circuitBreakerState.set).toHaveBeenCalledWith({ service: 'product-service' }, 1);
  });

  it('records failure and updates gauge when circuit opens', async () => {
    mockRedis.eval.mockResolvedValueOnce(CircuitState.OPEN);

    await circuitBreaker.recordFailure('order-service');

    expect(mockRedis.eval).toHaveBeenCalled();
    expect(circuitBreakerState.set).toHaveBeenCalledWith({ service: 'order-service' }, 1);
  });

  it('records success and updates gauge when circuit closes', async () => {
    mockRedis.eval.mockResolvedValueOnce(CircuitState.CLOSED);

    await circuitBreaker.recordSuccess('order-service');

    expect(mockRedis.eval).toHaveBeenCalled();
    expect(circuitBreakerState.set).toHaveBeenCalledWith({ service: 'order-service' }, 0);
  });

  it('returns CLOSED when no state exists in Redis', async () => {
    mockRedis.hget.mockResolvedValueOnce(null);

    const state = await circuitBreaker.getState('inventory-service');

    expect(state).toBe(CircuitState.CLOSED);
    expect(mockRedis.hget).toHaveBeenCalled();
  });

  it('returns states for all circuit keys', async () => {
    mockRedis.keys.mockResolvedValueOnce(['circuit:user-service', 'circuit:product-service']);
    mockRedis.hmget
      .mockResolvedValueOnce([CircuitState.OPEN, '3'])
      .mockResolvedValueOnce([CircuitState.CLOSED, '0']);

    const states = await circuitBreaker.getStates();

    expect(states['user-service']).toEqual({ state: CircuitState.OPEN, failureCount: 3 });
    expect(states['product-service']).toEqual({ state: CircuitState.CLOSED, failureCount: 0 });
  });
});
