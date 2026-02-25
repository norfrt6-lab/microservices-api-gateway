import express from 'express';
import { PORTS, SERVICES } from '@microservices/shared';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ service: SERVICES.PRODUCT, status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORTS.PRODUCT, () => {
  console.log(`${SERVICES.PRODUCT} running on port ${PORTS.PRODUCT}`);
});

export { app };
