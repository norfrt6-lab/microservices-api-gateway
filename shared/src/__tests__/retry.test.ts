import { describe, it, expect, vi } from 'vitest';
import { retry } from '../utils/retry';

describe('retry utility', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await retry(fn, { maxAttempts: 3, baseDelayMs: 10 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const result = await retry(fn, { maxAttempts: 3, baseDelayMs: 10, jitter: false });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    await expect(retry(fn, { maxAttempts: 3, baseDelayMs: 10, jitter: false })).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should respect maxAttempts=1 (no retries)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    await expect(retry(fn, { maxAttempts: 1, baseDelayMs: 10 })).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should use exponential backoff', async () => {
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: any, delay?: number) => {
      if (delay && delay > 0) delays.push(delay);
      return originalSetTimeout(fn, 0);
    });

    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockResolvedValue('ok');

    await retry(fn, { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 10000, jitter: false });

    // First delay: 100ms * 2^0 = 100ms, Second delay: 100ms * 2^1 = 200ms
    expect(delays[0]).toBe(100);
    expect(delays[1]).toBe(200);

    vi.restoreAllMocks();
  });

  it('should cap delay at maxDelayMs', async () => {
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: any, delay?: number) => {
      if (delay && delay > 0) delays.push(delay);
      return originalSetTimeout(fn, 0);
    });

    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockResolvedValue('ok');

    await retry(fn, { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 50, jitter: false });

    // Both delays should be capped at 50
    expect(delays.every((d) => d <= 50)).toBe(true);

    vi.restoreAllMocks();
  });

  it('should apply jitter when enabled', async () => {
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: any, delay?: number) => {
      if (delay && delay > 0) delays.push(delay);
      return originalSetTimeout(fn, 0);
    });

    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockResolvedValue('ok');

    await retry(fn, { maxAttempts: 2, baseDelayMs: 100, maxDelayMs: 10000, jitter: true });

    // With jitter: delay = base * (0.5 + random * 0.5), so between 50 and 100
    expect(delays[0]).toBeGreaterThanOrEqual(50);
    expect(delays[0]).toBeLessThanOrEqual(100);

    vi.restoreAllMocks();
  });
});
