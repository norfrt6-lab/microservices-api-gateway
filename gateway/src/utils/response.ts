import { Response } from 'express';
import { ApiResponse } from '@microservices/shared';

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: ApiResponse['meta'],
) {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      ...meta,
      correlationId: (res.req as any).correlationId,
    },
  };
  res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
) {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      correlationId: (res.req as any).correlationId,
    },
  };
  res.status(statusCode).json(response);
}
