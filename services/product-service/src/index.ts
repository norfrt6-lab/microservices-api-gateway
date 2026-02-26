// OTel must init before all other imports
import { initTelemetry, getMetricsRegister, shutdownTelemetry } from '@microservices/shared';
initTelemetry('product-service');

import express from 'express';

import {
  PORTS,
  SERVICES,
  NATS_SUBJECTS,
  gatewayGuard,
  createNatsClient,
  startHeartbeat,
  stopHeartbeat,
  natsRespond,
  closeNatsClient,
  createLogger,
} from '@microservices/shared';
import { productRoutes } from './routes/product.routes';
import * as productService from './services/product.service';
import { errorHandler } from './middleware/errorHandler';

const logger = createLogger(SERVICES.PRODUCT);
const app = express();
app.use(express.json({ limit: '1mb' }));

app.use(gatewayGuard(process.env.GATEWAY_SECRET || ''));

app.get('/health', (_req, res) => {
  res.json({ service: SERVICES.PRODUCT, status: 'healthy', timestamp: new Date().toISOString() });
});

// Prometheus metrics endpoint
app.get('/metrics', async (_req, res) => {
  try {
    const register = getMetricsRegister();
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch {
    res.status(500).end();
  }
});

app.use(productRoutes);
app.use(errorHandler);



async function start() {
  try {

    await createNatsClient({
      url: process.env.NATS_URL || 'nats://nats:4222',
      name: SERVICES.PRODUCT,
      onStatusChange: (type, data) => {
        logger.info({ type, data }, 'NATS status change');
      },
    });

    startHeartbeat(SERVICES.PRODUCT, `http://${SERVICES.PRODUCT}:${PORTS.PRODUCT}`);

    natsRespond<{ productId: string; quantity: number }, { available: boolean }>(
      NATS_SUBJECTS.PRODUCT_CHECK_STOCK,
      async (data, correlationId) => {
        logger.info({ productId: data.productId, quantity: data.quantity, correlationId }, 'NATS product.checkStock');
        const available = await productService.checkStock(data.productId, data.quantity);
        return { available };
      },
      SERVICES.PRODUCT,
    );

    natsRespond<{ productId: string; quantity: number }, { reserved: boolean }>(
      NATS_SUBJECTS.PRODUCT_RESERVE_STOCK,
      async (data, correlationId) => {
        logger.info({ productId: data.productId, quantity: data.quantity, correlationId }, 'NATS product.reserveStock');
        const reserved = await productService.reserveStock(data.productId, data.quantity);
        return { reserved };
      },
      SERVICES.PRODUCT,
    );

    natsRespond<{ productId: string; quantity: number }, { released: boolean }>(
      NATS_SUBJECTS.PRODUCT_RELEASE_STOCK,
      async (data, correlationId) => {
        logger.info({ productId: data.productId, quantity: data.quantity, correlationId }, 'NATS product.releaseStock');
        await productService.releaseStock(data.productId, data.quantity);
        return { released: true };
      },
      SERVICES.PRODUCT,
    );

    app.listen(PORTS.PRODUCT, () => {
      logger.info({ port: PORTS.PRODUCT }, `${SERVICES.PRODUCT} running`);
    });
  } catch (err) {
    logger.fatal({ err }, `Failed to start ${SERVICES.PRODUCT}`);
    process.exit(1);
  }
}

const shutdown = async () => {
  logger.info('Shutting down...');
  const forceExit = setTimeout(() => process.exit(1), 10000);
  try {
    stopHeartbeat();
    await closeNatsClient();
    await shutdownTelemetry();
    await productService.prisma.$disconnect();
  } finally {
    clearTimeout(forceExit);
    process.exit(0);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();

export { app };
