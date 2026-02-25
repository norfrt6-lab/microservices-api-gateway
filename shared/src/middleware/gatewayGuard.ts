import { Request, Response, NextFunction } from 'express';
import { HEADERS } from '../constants';

/**
 * Rejects requests that did not come through the API gateway.
 * Checks for the x-gateway-secret header matching the expected secret.
 * Health endpoints are excluded so Prometheus/K8s probes still work.
 */
export function gatewayGuard(expectedSecret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Allow health probes through without gateway secret
    if (req.path === '/health' || req.path === '/metrics') {
      return next();
    }

    const secret = req.headers[HEADERS.GATEWAY_SECRET] as string;

    if (!secret || secret !== expectedSecret) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Direct access to this service is not allowed',
        },
      });
    }

    next();
  };
}
