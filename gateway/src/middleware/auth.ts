import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload, UserRole } from '@microservices/shared';
import { config } from '../config';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { logger } from '../config/logger';



/**
 * Extracts and verifies JWT from Authorization header.
 * Attaches decoded payload to req.user.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or invalid Authorization header'));
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as JwtPayload;
    req.user = decoded;

    logger.debug(
      { correlationId: req.correlationId, userId: decoded.userId, role: decoded.role },
      'JWT verified',
    );

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new UnauthorizedError('Token expired'));
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return next(new UnauthorizedError('Invalid token'));
    }
    return next(new UnauthorizedError('Authentication failed'));
  }
}

/**
 * Requires the user to have a specific role.
 * Must be used after authenticate middleware.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(
        { correlationId: req.correlationId, userId: req.user.userId, role: req.user.role, required: roles },
        'Insufficient permissions',
      );
      return next(new ForbiddenError('Insufficient permissions'));
    }

    next();
  };
}

/**
 * Optional auth — extracts user if token present, but doesn't require it.
 * Useful for routes that behave differently for authenticated users.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as JwtPayload;
    req.user = decoded;
  } catch {
    // Token invalid — proceed without user, don't error
  }

  next();
}
