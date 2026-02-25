import express from 'express';
import { PORTS, SERVICES, gatewayGuard } from '@microservices/shared';

const app = express();
app.use(express.json({ limit: '1mb' }));

// Reject direct access — only allow requests from gateway
app.use(gatewayGuard(process.env.GATEWAY_SECRET || ''));

app.get('/health', (_req, res) => {
  res.json({ service: SERVICES.PRODUCT, status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORTS.PRODUCT, () => {
  console.log(`${SERVICES.PRODUCT} running on port ${PORTS.PRODUCT}`);
});

export { app };
