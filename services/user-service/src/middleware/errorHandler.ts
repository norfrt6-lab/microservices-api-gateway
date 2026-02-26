import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { DomainError, createLogger, SERVICES } from '@microservices/shared';

const logger = createLogger(SERVICES.USER);

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof DomainError) {
    logger.warn(
      {
        code: err.code,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
      },
      'Domain error',
    );
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    logger.warn(
      {
        details,
        path: req.path,
        method: req.method,
      },
      'Validation error',
    );
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details,
      },
    });
  }

  if (err instanceof SyntaxError && 'body' in err) {
    logger.warn(
      {
        path: req.path,
        method: req.method,
      },
      'Invalid JSON in request body',
    );
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON in request body',
      },
    });
  }

  logger.error(
    {
      err,
      path: req.path,
      method: req.method,
    },
    'Unhandled error',
  );
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
}
