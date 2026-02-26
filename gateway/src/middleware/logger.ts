import pinoHttp from 'pino-http';
import { logger } from '../config/logger';
import { GatewayRequest } from '../types/express';

export const httpLogger = pinoHttp({
  logger,
  customProps: (req) => ({
    correlationId: (req as GatewayRequest).correlationId,
  }),
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      correlationId: (req as { raw?: { correlationId?: string } }).raw?.correlationId
        ?? (req as GatewayRequest).correlationId,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});
