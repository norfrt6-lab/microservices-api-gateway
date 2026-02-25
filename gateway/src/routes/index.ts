import { Router, Request, Response, NextFunction } from 'express';
import { createProxyRouter } from './v1/proxy';

const router = Router();

// V1 — deprecated, sunset scheduled for 2026-12-31
router.use('/api/v1', deprecationHeaders('2026-12-31'), createProxyRouter('v1'));

// V2 — current stable version
router.use('/api/v2', createProxyRouter('v2'));

/**
 * Middleware that adds Sunset and Deprecation headers to v1 responses,
 * signaling consumers to migrate to v2 before the sunset date.
 */
function deprecationHeaders(sunsetDate: string) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Sunset', sunsetDate);
    res.setHeader('Deprecation', 'true');
    res.setHeader('Link', `</api/v2>; rel="successor-version"`);
    next();
  };
}

export { router };
