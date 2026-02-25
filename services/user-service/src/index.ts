import express from 'express';
import { PORTS, SERVICES } from '@microservices/shared';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ service: SERVICES.USER, status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORTS.USER, () => {
  console.log(`${SERVICES.USER} running on port ${PORTS.USER}`);
});

export { app };
