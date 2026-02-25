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
} from '@microservices/shared';
import { productRoutes } from './routes/product.routes';
import * as productService from './services/product.service';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use(gatewayGuard(process.env.GATEWAY_SECRET || ''));

app.get('/health', (_req, res) => {
  res.json({ service: SERVICES.PRODUCT, status: 'healthy', timestamp: new Date().toISOString() });
});

app.use(productRoutes);

async function start() {
  try {
    await createNatsClient({
      url: process.env.NATS_URL || 'nats://nats:4222',
      name: SERVICES.PRODUCT,
      onStatusChange: (type, data) => {
        console.log(`[${SERVICES.PRODUCT}] NATS status: ${type}`, data);
      },
    });

    startHeartbeat(SERVICES.PRODUCT, `http://${SERVICES.PRODUCT}:${PORTS.PRODUCT}`);

    // NATS responder: product.checkStock
    natsRespond<{ productId: string; quantity: number }, { available: boolean }>(
      NATS_SUBJECTS.PRODUCT_CHECK_STOCK,
      async (data, correlationId) => {
        console.log(`[NATS] product.checkStock for ${data.productId} qty=${data.quantity} (correlation: ${correlationId})`);
        const available = await productService.checkStock(data.productId, data.quantity);
        return { available };
      },
      SERVICES.PRODUCT,
    );

    // NATS responder: product.reserveStock (saga step)
    natsRespond<{ productId: string; quantity: number }, { reserved: boolean }>(
      NATS_SUBJECTS.PRODUCT_RESERVE_STOCK,
      async (data, correlationId) => {
        console.log(`[NATS] product.reserveStock for ${data.productId} qty=${data.quantity} (correlation: ${correlationId})`);
        const reserved = await productService.reserveStock(data.productId, data.quantity);
        return { reserved };
      },
      SERVICES.PRODUCT,
    );

    // NATS responder: product.releaseStock (saga compensation)
    natsRespond<{ productId: string; quantity: number }, { released: boolean }>(
      NATS_SUBJECTS.PRODUCT_RELEASE_STOCK,
      async (data, correlationId) => {
        console.log(`[NATS] product.releaseStock for ${data.productId} qty=${data.quantity} (correlation: ${correlationId})`);
        await productService.releaseStock(data.productId, data.quantity);
        return { released: true };
      },
      SERVICES.PRODUCT,
    );

    app.listen(PORTS.PRODUCT, () => {
      console.log(`${SERVICES.PRODUCT} running on port ${PORTS.PRODUCT}`);
    });
  } catch (err) {
    console.error(`Failed to start ${SERVICES.PRODUCT}:`, err);
    process.exit(1);
  }
}

const shutdown = async () => {
  console.log(`Shutting down ${SERVICES.PRODUCT}...`);
  stopHeartbeat();
  await closeNatsClient();
  await productService.prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();

export { app };
