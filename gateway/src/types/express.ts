import { Request } from 'express';
import { JwtPayload } from '@microservices/shared';

declare module 'express-serve-static-core' {
  interface Request {
    correlationId?: string;
    user?: JwtPayload;
  }
}

export type CorrelationRequest = Request & {
  correlationId: string;
};

export type AuthenticatedRequest = Request & {
  user: JwtPayload;
};

export type GatewayRequest = Request & {
  correlationId: string;
  user?: JwtPayload;
};

export function hasUser(req: Request): req is AuthenticatedRequest {
  return !!(req as { user?: JwtPayload }).user;
}

export function hasCorrelationId(req: Request): req is CorrelationRequest {
  return typeof (req as { correlationId?: string }).correlationId === 'string';
}
