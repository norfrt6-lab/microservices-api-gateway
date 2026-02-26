import { Request, Response, NextFunction } from 'express';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';

export function tracingMiddleware(req: Request, res: Response, next: NextFunction) {
  const span = trace.getSpan(context.active());

  if (span) {
    span.setAttribute('http.method', req.method);
    span.setAttribute('http.target', req.originalUrl);
    span.setAttribute('http.route', req.route?.path ?? req.path);
    if (req.correlationId) {
      span.setAttribute('correlation_id', req.correlationId);
    }
    if (req.user?.userId) {
      span.setAttribute('user.id', req.user.userId);
    }
    if (req.user?.email) {
      span.setAttribute('user.email', req.user.email);
    }
    if (req.user?.role) {
      span.setAttribute('user.role', req.user.role);
    }
  }

  res.on('finish', () => {
    if (!span) return;

    span.setAttribute('http.status_code', res.statusCode);

    if (res.statusCode >= 500) {
      span.setStatus({ code: SpanStatusCode.ERROR });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }
  });

  next();
}
