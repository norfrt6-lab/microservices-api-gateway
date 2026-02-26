import { describe, it, expect, vi } from 'vitest';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';

// Mock logger
vi.mock('../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

// Mock config
vi.mock('../config', () => ({
  config: {
    jwt: {
      secret: 'test-secret',
      expiresIn: '1h',
      issuer: 'test-issuer',
      audience: 'test-audience',
    },
  },
}));

import { authenticate, requireRole, optionalAuth } from '../middleware/auth';
import { UserRole } from '@microservices/shared';

type MockReq = Partial<Request> & {
  headers: Record<string, string>;
  correlationId: string;
};

type MockRes = Record<string, never>;

function createMockReqRes(authHeader?: string) {
  const req: MockReq = {
    headers: authHeader ? { authorization: authHeader } : {},
    correlationId: 'test-corr-id',
  };
  const res: MockRes = {};
  const next = vi.fn();
  return { req, res, next };
}

describe('authenticate middleware', () => {
  it('should reject request with no Authorization header', () => {
    const { req, res, next } = createMockReqRes();
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('should reject request with invalid token format', () => {
    const { req, res, next } = createMockReqRes('InvalidFormat token');
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('should reject request with invalid JWT', () => {
    const { req, res, next } = createMockReqRes('Bearer invalid.token.here');
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('should reject request with invalid issuer', () => {
    const payload = { userId: 'user-1', email: 'test@test.com', role: UserRole.USER };
    const token = jwt.sign(payload, 'test-secret', {
      expiresIn: '1h',
      issuer: 'wrong-issuer',
      audience: 'test-audience',
    });
    const { req, res, next } = createMockReqRes(`Bearer ${token}`);

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('should accept request with valid JWT and attach user', () => {
    const payload = { userId: 'user-1', email: 'test@test.com', role: UserRole.USER };
    const token = jwt.sign(payload, 'test-secret', {
      expiresIn: '1h',
      issuer: 'test-issuer',
      audience: 'test-audience',
    });
    const { req, res, next } = createMockReqRes(`Bearer ${token}`);

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeDefined();
    expect(req.user.userId).toBe('user-1');
    expect(req.user.email).toBe('test@test.com');
    expect(req.user.role).toBe(UserRole.USER);
  });

  it('should reject expired token', () => {
    const token = jwt.sign(
      { userId: 'user-1', email: 'test@test.com', role: UserRole.USER },
      'test-secret',
      { expiresIn: '0s', issuer: 'test-issuer', audience: 'test-audience' },
    );
    const { req, res, next } = createMockReqRes(`Bearer ${token}`);

    // Wait a tick for token to expire
    setTimeout(() => {
      authenticate(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    }, 10);
  });
});

describe('requireRole middleware', () => {
  it('should reject if no user attached', () => {
    const { req, res, next } = createMockReqRes();
    const middleware = requireRole(UserRole.ADMIN);
    middleware(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('should reject if user lacks required role', () => {
    const { req, res, next } = createMockReqRes();
    req.user = { userId: 'user-1', email: 'test@test.com', role: UserRole.USER };
    req.correlationId = 'test';

    const middleware = requireRole(UserRole.ADMIN);
    middleware(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('should allow if user has required role', () => {
    const { req, res, next } = createMockReqRes();
    req.user = { userId: 'user-1', email: 'test@test.com', role: UserRole.ADMIN };

    const middleware = requireRole(UserRole.ADMIN);
    middleware(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('should allow if user has one of multiple allowed roles', () => {
    const { req, res, next } = createMockReqRes();
    req.user = { userId: 'user-1', email: 'test@test.com', role: UserRole.USER };

    const middleware = requireRole(UserRole.USER, UserRole.ADMIN);
    middleware(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('optionalAuth middleware', () => {
  it('should proceed without user if no token', () => {
    const { req, res, next } = createMockReqRes();
    optionalAuth(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });

  it('should attach user if valid token present', () => {
    const payload = { userId: 'user-1', email: 'test@test.com', role: UserRole.USER };
    const token = jwt.sign(payload, 'test-secret', {
      expiresIn: '1h',
      issuer: 'test-issuer',
      audience: 'test-audience',
    });
    const { req, res, next } = createMockReqRes(`Bearer ${token}`);

    optionalAuth(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeDefined();
    expect(req.user.userId).toBe('user-1');
  });

  it('should proceed without user if token is invalid', () => {
    const { req, res, next } = createMockReqRes('Bearer bad.token.value');
    optionalAuth(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });
});
