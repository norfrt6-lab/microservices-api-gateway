import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { ValidationError } from '../errors';

type Source = 'body' | 'query' | 'params';

interface ValidateOptions {
  source?: Source;
}

export function validate<T>(schema: ZodSchema<T>, options: ValidateOptions = {}) {
  const { source = 'body' } = options;

  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req[source]);
      (req as unknown as Record<string, unknown>)[source] = data;
      next();
    } catch (err) {
      const details =
        err && typeof err === 'object' && 'errors' in err
          ? (err as { errors: unknown }).errors
          : undefined;
      next(new ValidationError('Invalid request data', details));
    }
  };
}
