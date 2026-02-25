// OTel must init before all other imports
import { initTelemetry, getMetricsRegister, shutdownTelemetry } from '@microservices/shared';
initTelemetry('order-service');

import express from 'express';
import {
  PORTS,
  SERVICES,
  gatewayGuard,
  createNatsClient,
  startHeartbeat,
  stopHeartbeat,
  closeNatsClient,
} from '@microservices/shared';
import { orderRoutes } from './routes/order.routes';
import * as orderService from './services/order.service';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use(gatewayGuard(process.env.GATEWAY_SECRET || ''));

app.get('/health', (_req, res) => {
  res.json({ service: SERVICES.ORDER, status: 'healthy', timestamp: new Date().toISOString() });
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

app.use(orderRoutes);

async function start() {
  try {
    await createNatsClient({
      url: process.env.NATS_URL || 'nats://nats:4222',
      name: SERVICES.ORDER,
      onStatusChange: (type, data) => {
        console.log(`[${SERVICES.ORDER}] NATS status: ${type}`, data);
      },
    });

    startHeartbeat(SERVICES.ORDER, `http://${SERVICES.ORDER}:${PORTS.ORDER}`);

    app.listen(PORTS.ORDER, () => {
      console.log(`${SERVICES.ORDER} running on port ${PORTS.ORDER}`);
    });
  } catch (err) {
    console.error(`Failed to start ${SERVICES.ORDER}:`, err);
    process.exit(1);
  }
}

const shutdown = async () => {
  console.log(`Shutting down ${SERVICES.ORDER}...`);
  stopHeartbeat();
  await closeNatsClient();
  await shutdownTelemetry();
  await orderService.prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();

export { app };
