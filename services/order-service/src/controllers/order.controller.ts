import { Request, Response, NextFunction } from 'express';
import { createOrderSchema } from '../schemas/order.schema';
import { paginationSchema, idParamSchema, HEADERS, UnauthorizedError, NotFoundError, ConflictError } from '@microservices/shared';
import * as orderService from '../services/order.service';

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return next(new UnauthorizedError('User ID required'));
    }

    const data = createOrderSchema.parse(req.body);
    const idempotencyKey = req.headers[HEADERS.IDEMPOTENCY_KEY] as string | undefined;
    const correlationId = req.headers[HEADERS.CORRELATION_ID] as string | undefined;

    const order = await orderService.createOrder(userId, data, idempotencyKey, correlationId);
    return res.status(201).json({ success: true, data: order });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes('Insufficient stock') || err.message.includes('Failed to reserve'))) {
      return next(new ConflictError(err.message));
    }
    return next(err as Error);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const userId = req.headers['x-user-id'] as string;
    const order = await orderService.getOrderById(id, userId);
    return res.json({ success: true, data: order });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Order not found') {
      return next(new NotFoundError('Order not found'));
    }
    return next(err as Error);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return next(new UnauthorizedError('User ID required'));
    }

    const { page, limit } = paginationSchema.parse(req.query);
    const result = await orderService.listOrders(userId, page, limit);
    return res.json({
      success: true,
      data: result.orders,
      meta: { page: result.page, limit: result.limit, total: result.total },
    });
  } catch (err: unknown) {
    return next(err as Error);
  }
}

export async function confirm(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const userId = req.headers['x-user-id'] as string;
    const correlationId = req.headers[HEADERS.CORRELATION_ID] as string | undefined;

    if (!userId) {
      return next(new UnauthorizedError('User ID required'));
    }

    const order = await orderService.confirmOrder(id, userId, correlationId);
    return res.json({ success: true, data: order });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes('not found') || err.message.includes('cannot be confirmed'))) {
      return next(new NotFoundError(err.message));
    }
    return next(err as Error);
  }
}

export async function cancel(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const userId = req.headers['x-user-id'] as string;
    const correlationId = req.headers[HEADERS.CORRELATION_ID] as string | undefined;

    if (!userId) {
      return next(new UnauthorizedError('User ID required'));
    }

    const order = await orderService.cancelOrder(id, userId, correlationId);
    return res.json({ success: true, data: order });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes('not found') || err.message.includes('cannot be cancelled'))) {
      return next(new NotFoundError(err.message));
    }
    return next(err as Error);
  }
}
