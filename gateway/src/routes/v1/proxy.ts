import { Router, Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { getRouteConfig, routeMap } from '../../config/routes.config';
import { HEADERS } from '@microservices/shared';
import { config } from '../../config';
import { logger } from '../../config/logger';
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

          logger.debug(
            {
              correlationId: expressReq.correlationId,
              target: route.target,
              path: expressReq.path,
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

    router.use(route.prefix, createProxyMiddleware(proxyOptions));
    logger.info(`Route mounted: /api/${version}${route.prefix} → ${route.target}`);
  }

  // Catch unmatched routes within the version namespace
  router.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Route ${req.method} /api/${version}${req.path} not found`));
  });

  return router;
}
