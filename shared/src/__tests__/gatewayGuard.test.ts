import { describe, it, expect, vi } from 'vitest';
import { gatewayGuard } from '../middleware/gatewayGuard';

function createMockReqRes(path: string, headers: Record<string, string> = {}) {
  const req: any = { path, headers };
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('gatewayGuard middleware', () => {
  const guard = gatewayGuard('test-secret');

  it('should allow /health endpoint without secret', () => {
    const { req, res, next } = createMockReqRes('/health');
    guard(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should allow /metrics endpoint without secret', () => {
    const { req, res, next } = createMockReqRes('/metrics');
    guard(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should reject request without gateway secret', () => {
    const { req, res, next } = createMockReqRes('/products');
    guard(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should reject request with wrong gateway secret', () => {
    const { req, res, next } = createMockReqRes('/products', { 'x-gateway-secret': 'wrong' });
    guard(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should allow request with correct gateway secret', () => {
    const { req, res, next } = createMockReqRes('/products', { 'x-gateway-secret': 'test-secret' });
    guard(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
