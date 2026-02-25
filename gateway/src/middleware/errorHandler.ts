import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const correlationId = req.correlationId;

  if (err instanceof AppError) {
    logger.warn({ err, correlationId }, `AppError: ${err.message}`);
    return sendError(res, err.statusCode, err.code, err.message, err.details);
  }

  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    logger.warn({ err: details, correlationId }, 'Validation error');
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid request data', details);
  }

  if (err instanceof SyntaxError && 'body' in err) {
    logger.warn({ correlationId }, 'Invalid JSON body');
    return sendError(res, 400, 'INVALID_JSON', 'Invalid JSON in request body');
  }

  logger.error({ err, correlationId }, 'Unhandled error');
  return sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
}
