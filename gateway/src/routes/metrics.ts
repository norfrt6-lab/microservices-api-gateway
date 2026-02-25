import { Router, Request, Response } from 'express';
import { register } from '../telemetry/meter';

const router = Router();

/**
 * GET /metrics — Prometheus scrape endpoint
 * Returns all registered metrics in Prometheus exposition format.
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end();
  }
});

export { router as metricsRouter };
