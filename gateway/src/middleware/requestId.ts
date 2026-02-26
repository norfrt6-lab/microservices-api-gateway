import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { HEADERS } from '@microservices/shared';



export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = (req.headers[HEADERS.CORRELATION_ID] as string) || uuidv4();

  req.correlationId = correlationId;
  res.setHeader(HEADERS.CORRELATION_ID, correlationId);
  res.locals.correlationId = correlationId;

  next();
}
