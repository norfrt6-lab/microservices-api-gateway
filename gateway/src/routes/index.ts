import { Router, Request, Response, NextFunction } from 'express';
import { createProxyRouter } from './v1/proxy';

const router = Router();

// V1 — current stable version
router.use('/api/v1', createProxyRouter('v1'));

// V2 — next version (deprecation headers on v1 will be added when v2 diverges)
router.use('/api/v2', deprecationHeaders('v1', '2026-12-31'), createProxyRouter('v2'));

/**
 * Middleware that adds Sunset and Deprecation headers to signal
 * that a prior version will be retired. Applied to v2+ responses
 * to indicate v1 deprecation timeline.
 */
function deprecationHeaders(deprecatedVersion: string, sunsetDate: string) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Sunset', sunsetDate);
    res.setHeader('Deprecation', `version="${deprecatedVersion}"`);
    res.setHeader('Link', `</api/v2>; rel="successor-version"`);
    next();
  };
}

export { router };
