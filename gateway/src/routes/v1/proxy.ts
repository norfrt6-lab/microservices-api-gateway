import { Router, Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { routeMap } from '../../config/routes.config';
import { HEADERS } from '@microservices/shared';
import { config } from '../../config';
import { logger } from '../../config/logger';
import { authenticate } from '../../middleware/auth';
import { circuitBreakerMiddleware } from '../../middleware/circuitBreaker';
import { NotFoundError } from '../../utils/errors';

export function createProxyRouter(version: string): Router {
  const router = Router();
  const routes = routeMap[version];

  if (!routes) {
    logger.warn(`No routes defined for API version: ${version}`);
    return router;
  }

  for (const route of routes) {
    const proxyOptions: Options = {
      target: route.target,
      changeOrigin: true,
      pathRewrite: {
        [`^/api/${version}${route.prefix}`]: route.prefix,
      },
      on: {
        proxyReq: (proxyReq, req) => {
          const expressReq = req as Request;

          // Propagate correlation ID to downstream service
          if (expressReq.correlationId) {
            proxyReq.setHeader(HEADERS.CORRELATION_ID, expressReq.correlationId);
          }

          // Inject gateway secret so services know request came from gateway
          proxyReq.setHeader(HEADERS.GATEWAY_SECRET, config.gatewaySecret);

          // Forward authenticated user info to downstream service
          if (expressReq.user) {
            proxyReq.setHeader('x-user-id', expressReq.user.userId);
            proxyReq.setHeader('x-user-email', expressReq.user.email);
            proxyReq.setHeader('x-user-role', expressReq.user.role);
          }

          logger.debug(
            {
              correlationId: expressReq.correlationId,
              target: route.target,
              path: expressReq.path,
              userId: expressReq.user?.userId,
            },
            `Proxying request to ${route.target}`,
          );
        },
        proxyRes: (proxyRes, req) => {
          const expressReq = req as Request;
          logger.debug(
            {
              correlationId: expressReq.correlationId,
              status: proxyRes.statusCode,
            },
            `Proxy response from ${route.target}`,
          );
        },
        error: (err, req, res) => {
          const expressReq = req as Request;
          logger.error(
            {
              correlationId: expressReq.correlationId,
              target: route.target,
              error: err.message,
            },
            `Proxy error to ${route.target}`,
          );

          if ('writeHead' in res && 'end' in res) {
            const httpRes = res as Response;
            if (!httpRes.headersSent) {
              httpRes.status(502).json({
                success: false,
                error: {
                  code: 'BAD_GATEWAY',
                  message: `Service ${route.target} is unavailable`,
                },
                meta: { correlationId: expressReq.correlationId },
              });
            }
          }
        },
      },
    };

    // Build middleware chain: circuit breaker → auth (if required) → proxy
    const middlewares: Array<import('express').RequestHandler> = [];

    middlewares.push(circuitBreakerMiddleware(route.serviceName));

    if (route.auth) {
      middlewares.push(authenticate);
    }

    middlewares.push(createProxyMiddleware(proxyOptions));

    router.use(route.prefix, ...middlewares);
    logger.info(
      `Route mounted: /api/${version}${route.prefix} → ${route.target} [auth=${route.auth}, circuit=${route.serviceName}]`,
    );
  }

  // Catch unmatched routes within the version namespace
  router.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Route ${req.method} /api/${version}${req.path} not found`));
  });

  return router;
}
