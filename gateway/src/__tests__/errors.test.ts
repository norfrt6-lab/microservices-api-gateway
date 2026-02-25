import { describe, it, expect } from 'vitest';
import {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  ServiceUnavailableError,
} from '../utils/errors';

describe('Custom Errors', () => {
  it('should create AppError with correct properties', () => {
    const err = new AppError(400, 'TEST_ERROR', 'test message', { detail: true });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('TEST_ERROR');
    expect(err.message).toBe('test message');
    expect(err.details).toEqual({ detail: true });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('should create BadRequestError', () => {
    const err = new BadRequestError('invalid input');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('invalid input');
  });

  it('should create BadRequestError with default message', () => {
    const err = new BadRequestError();
    expect(err.message).toBe('Bad request');
  });

  it('should create UnauthorizedError', () => {
    const err = new UnauthorizedError('no token');
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('should create ForbiddenError', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('should create NotFoundError', () => {
    const err = new NotFoundError('route not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });

  it('should create TooManyRequestsError with retryAfter', () => {
    const err = new TooManyRequestsError(30);
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('TOO_MANY_REQUESTS');
    expect(err.details).toEqual({ retryAfter: 30 });
  });

  it('should create ServiceUnavailableError', () => {
    const err = new ServiceUnavailableError('user-service');
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe('SERVICE_UNAVAILABLE');
    expect(err.message).toBe('user-service is currently unavailable');
  });
});
