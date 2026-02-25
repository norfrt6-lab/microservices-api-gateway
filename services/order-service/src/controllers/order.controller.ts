import { Request, Response } from 'express';
import { createOrderSchema, updateOrderStatusSchema } from '../schemas/order.schema';
import { paginationSchema, idParamSchema, HEADERS } from '@microservices/shared';
import * as orderService from '../services/order.service';

export async function create(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User ID required' } });
    }

    const data = createOrderSchema.parse(req.body);
    const idempotencyKey = req.headers[HEADERS.IDEMPOTENCY_KEY] as string | undefined;
    const correlationId = req.headers[HEADERS.CORRELATION_ID] as string | undefined;

    const order = await orderService.createOrder(userId, data, idempotencyKey, correlationId);
    res.status(201).json({ success: true, data: order });
  } catch (err: any) {
    if (err.message?.includes('Insufficient stock') || err.message?.includes('Failed to reserve')) {
      return res.status(409).json({ success: false, error: { code: 'STOCK_UNAVAILABLE', message: err.message } });
    }
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: err.message } });
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const userId = req.headers['x-user-id'] as string;
    const order = await orderService.getOrderById(id, userId);
    res.json({ success: true, data: order });
  } catch (err: any) {
    if (err.message === 'Order not found') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: err.message } });
    }
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: err.message } });
  }
}

export async function list(req: Request, res: Response) {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User ID required' } });
    }

    const { page, limit } = paginationSchema.parse(req.query);
    const result = await orderService.listOrders(userId, page, limit);
    res.json({
      success: true,
      data: result.orders,
      meta: { page: result.page, limit: result.limit, total: result.total },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
}

export async function confirm(req: Request, res: Response) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const userId = req.headers['x-user-id'] as string;
    const correlationId = req.headers[HEADERS.CORRELATION_ID] as string | undefined;

    if (!userId) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User ID required' } });
    }

    const order = await orderService.confirmOrder(id, userId, correlationId);
    res.json({ success: true, data: order });
  } catch (err: any) {
    if (err.message?.includes('not found') || err.message?.includes('cannot be confirmed')) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: err.message } });
    }
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: err.message } });
  }
}

export async function cancel(req: Request, res: Response) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const userId = req.headers['x-user-id'] as string;
    const correlationId = req.headers[HEADERS.CORRELATION_ID] as string | undefined;

    if (!userId) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User ID required' } });
    }

    const order = await orderService.cancelOrder(id, userId, correlationId);
    res.json({ success: true, data: order });
  } catch (err: any) {
    if (err.message?.includes('not found') || err.message?.includes('cannot be cancelled')) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: err.message } });
    }
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: err.message } });
  }
}
