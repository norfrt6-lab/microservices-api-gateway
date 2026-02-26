import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import './types/express';
import { requestIdMiddleware } from './middleware/requestId';
import { tracingMiddleware } from './middleware/tracing';
import { httpLogger } from './middleware/logger';
import { metricsMiddleware } from './middleware/metrics';
import { errorHandler } from './middleware/errorHandler';
import { router } from './routes';
import { healthRouter } from './routes/health';
import { metricsRouter } from './routes/metrics';
import { rateLimiter } from './middleware/rateLimiter';
import { cacheMiddleware, cacheInvalidator } from './middleware/cache';
import { idempotencyMiddleware } from './middleware/idempotency';
import { docsRouter } from './routes/docs';
import { NotFoundError } from './utils/errors';
import { config } from './config';

const app = express();
app.set('trust proxy', config.trustProxy);


// Security headers (HSTS, X-Frame-Options, X-Content-Type-Options, CSP, etc.)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        imgSrc: ["'self'", 'data:'],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  }),
);

// Strict CORS — whitelist origins, restrict methods
const allowedOrigins = config.nodeEnv === 'production'
  ? (process.env.CORS_ORIGINS || '').split(',').filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, health probes)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id', 'idempotency-key'],
    exposedHeaders: ['x-correlation-id'],
    credentials: true,
    maxAge: 600, // 10 min preflight cache
  }),
);

// Request size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Correlation ID (must be before logger)
app.use(requestIdMiddleware);

// Tracing context enrichment
app.use(tracingMiddleware);

// Structured logging
app.use(httpLogger);

// Prometheus metrics collection
app.use(metricsMiddleware);

// Health, metrics & docs endpoints (before rate limiter — not rate limited)
app.use(healthRouter);
app.use(metricsRouter);
app.use(docsRouter);

// Rate limiting (after health, before proxy routes)
app.use('/api', rateLimiter);

// Idempotency (POST/PUT/PATCH with Idempotency-Key header)
app.use('/api', idempotencyMiddleware);

// Response caching (GET) + cache invalidation (POST/PUT/PATCH/DELETE)
app.use('/api', cacheMiddleware({ ttl: 60 }));
app.use('/api', cacheInvalidator());

// Versioned API proxy routes
app.use(router);

// 404 catch-all
app.use((req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
});

// Error handler (must be last)
app.use(errorHandler);

export { app };
