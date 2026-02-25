import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requestIdMiddleware } from './middleware/requestId';
import { httpLogger } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import { router } from './routes';
import { healthRouter } from './routes/health';
import { NotFoundError } from './utils/errors';

const app = express();

// Security
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Correlation ID (must be before logger)
app.use(requestIdMiddleware);

// Structured logging
app.use(httpLogger);

// Health endpoints (before proxy routes — not proxied)
app.use(healthRouter);

// Versioned API proxy routes
app.use(router);

// 404 catch-all
app.use((req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
});

// Error handler (must be last)
app.use(errorHandler);

export { app };
