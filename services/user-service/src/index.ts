// OTel must init before all other imports
import { initTelemetry, getMetricsRegister, shutdownTelemetry } from '@microservices/shared';
initTelemetry('user-service');

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
import { userRoutes } from './routes/user.routes';
import * as userService from './services/user.service';

const app = express();
app.use(express.json({ limit: '1mb' }));

// Reject direct access — only allow requests from gateway
app.use(gatewayGuard(process.env.GATEWAY_SECRET || ''));

// Health endpoint (excluded from gateway guard)
app.get('/health', (_req, res) => {
  res.json({ service: SERVICES.USER, status: 'healthy', timestamp: new Date().toISOString() });
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

// Routes
app.use(userRoutes);

async function start() {
  try {
    // Connect to NATS
    await createNatsClient({
      url: process.env.NATS_URL || 'nats://nats:4222',
      name: SERVICES.USER,
      onStatusChange: (type, data) => {
        console.log(`[${SERVICES.USER}] NATS status: ${type}`, data);
      },
    });

    // Start heartbeat
    startHeartbeat(SERVICES.USER, `http://${SERVICES.USER}:${PORTS.USER}`);

    // NATS responder: user.get — fetch user by ID
    natsRespond<{ userId: string }, any>(
      NATS_SUBJECTS.USER_GET,
      async (data, correlationId) => {
        console.log(`[NATS] user.get request for ${data.userId} (correlation: ${correlationId})`);
        return await userService.getUserById(data.userId);
      },
      SERVICES.USER,
    );

    app.listen(PORTS.USER, () => {
      console.log(`${SERVICES.USER} running on port ${PORTS.USER}`);
    });
  } catch (err) {
    console.error(`Failed to start ${SERVICES.USER}:`, err);
    process.exit(1);
  }
}

const shutdown = async () => {
  console.log(`Shutting down ${SERVICES.USER}...`);
  stopHeartbeat();
  await closeNatsClient();
  await shutdownTelemetry();
  await userService.prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();

export { app };
