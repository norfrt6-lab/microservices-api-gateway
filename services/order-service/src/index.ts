import express from 'express';
import { PORTS, SERVICES } from '@microservices/shared';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ service: SERVICES.ORDER, status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORTS.ORDER, () => {
  console.log(`${SERVICES.ORDER} running on port ${PORTS.ORDER}`);
});

export { app };
