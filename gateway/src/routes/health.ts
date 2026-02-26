import { Router, Request, Response } from 'express';
import { GatewayHealth, ServiceHealth } from '@microservices/shared';
import { config } from '../config';
import { isRedisHealthy } from '../services/redis';
import { isNatsHealthy } from '../services/nats';
import { circuitBreaker } from '../middleware/circuitBreaker';
import { getRegisteredServices } from '../services/discovery';
import { logger } from '../config/logger';

const router = Router();

async function checkServiceHealth(name: string, url: string): Promise<ServiceHealth> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${url}/health`, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return { service: name, status: 'healthy', timestamp: new Date().toISOString(), details: data as Record<string, unknown> };
    }
    return { service: name, status: 'unhealthy', timestamp: new Date().toISOString(), details: { statusCode: res.status } };
  } catch (err) {
    return {
      service: name,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      details: { error: err instanceof Error ? err.message : 'Unknown error' },
    };
  }
}

// Deep health check — checks Redis, NATS, and all downstream services
router.get('/health', async (req: Request, res: Response) => {
  const [redisHealthy, natsHealthy, userHealth, productHealth, orderHealth] = await Promise.all([
    isRedisHealthy(),
    isNatsHealthy(),
    checkServiceHealth('user-service', config.services.user),
    checkServiceHealth('product-service', config.services.product),
    checkServiceHealth('order-service', config.services.order),
  ]);

  const services = [userHealth, productHealth, orderHealth];
  const allServicesHealthy = services.every((s) => s.status === 'healthy');
  const anyServiceUnhealthy = services.some((s) => s.status === 'unhealthy');

  let overallStatus: GatewayHealth['status'] = 'healthy';
  if (!redisHealthy || !natsHealthy || anyServiceUnhealthy) {
    overallStatus = allServicesHealthy && redisHealthy && natsHealthy ? 'healthy' : 'degraded';
  }
  if (!redisHealthy && !natsHealthy) {
    overallStatus = 'unhealthy';
  }

  const circuitBreakers = await circuitBreaker.getStates();

  const health = {
    status: overallStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services,
    dependencies: {
      redis: redisHealthy ? 'connected' : 'disconnected',
      nats: natsHealthy ? 'connected' : 'disconnected',
    },
    circuitBreakers,
    serviceRegistry: getRegisteredServices(),
  };

  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

  logger.debug({ health }, 'Health check completed');
  res.status(statusCode).json({
    success: overallStatus !== 'unhealthy',
    data: health,
    meta: { correlationId: req.correlationId },
  });
});

// Liveness probe — lightweight, no dependency checks
router.get('/health/live', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

export { router as healthRouter };
