import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { create, getById, list, confirm, cancel } from '../controllers/order.controller';

vi.mock('../services/order.service', () => ({
  createOrder: vi.fn(),
  getOrderById: vi.fn(),
  listOrders: vi.fn(),
  confirmOrder: vi.fn(),
  cancelOrder: vi.fn(),
}));

import * as orderService from '../services/order.service';

type MockRequest = Partial<Request> & {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
};

function createMockRes(): Pick<Response, 'status' | 'json'> {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as Pick<Response, 'status' | 'json'>;
  return res;
}

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

describe('order controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should return 201 on successful order creation', async () => {
      const mockOrder = { id: 'ord-1', userId: 'user-1', status: 'STOCK_RESERVED' };
      vi.mocked(orderService.createOrder).mockResolvedValue(
        mockOrder as Awaited<ReturnType<typeof orderService.createOrder>>,
      );

      const req: MockRequest = {
        headers: { 'x-user-id': 'user-1' },
        body: { items: [{ productId: validUUID, quantity: 2 }] },
      };
      const res = createMockRes();

      await create(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockOrder });
    });

    it('should return 401 when x-user-id header missing', async () => {
      const req: MockRequest = {
        headers: {},
        body: { items: [{ productId: validUUID, quantity: 1 }] },
      };
      const res = createMockRes();

      await create(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 409 on insufficient stock', async () => {
      vi.mocked(orderService.createOrder).mockRejectedValue(
        new Error('Insufficient stock for product p1'),
      );

      const req: MockRequest = {
        headers: { 'x-user-id': 'user-1' },
        body: { items: [{ productId: validUUID, quantity: 1 }] },
      };
      const res = createMockRes();

      await create(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'STOCK_UNAVAILABLE' }),
      }));
    });

    it('should pass idempotency key from header', async () => {
      vi.mocked(orderService.createOrder).mockResolvedValue(
        { id: 'ord-1' } as Awaited<ReturnType<typeof orderService.createOrder>>,
      );

      const req: MockRequest = {
        headers: { 'x-user-id': 'user-1', 'idempotency-key': 'idem-key-123' },
        body: { items: [{ productId: validUUID, quantity: 1 }] },
      };
      const res = createMockRes();

      await create(req, res);

      expect(orderService.createOrder).toHaveBeenCalledWith(
        'user-1',
        expect.any(Object),
        'idem-key-123',
        undefined,
      );
    });
  });

  describe('getById', () => {
    it('should return order by ID', async () => {
      const mockOrder = { id: validUUID, userId: 'user-1', status: 'CONFIRMED' };
      vi.mocked(orderService.getOrderById).mockResolvedValue(
        mockOrder as Awaited<ReturnType<typeof orderService.getOrderById>>,
      );

      const req: MockRequest = {
        params: { id: validUUID },
        headers: { 'x-user-id': 'user-1' },
      };
      const res = createMockRes();

      await getById(req, res);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockOrder });
    });

    it('should return 404 when order not found', async () => {
      vi.mocked(orderService.getOrderById).mockRejectedValue(new Error('Order not found'));

      const req: MockRequest = {
        params: { id: validUUID },
        headers: { 'x-user-id': 'user-1' },
      };
      const res = createMockRes();

      await getById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('list', () => {
    it('should return paginated orders', async () => {
      const mockResult = { orders: [], total: 0, page: 1, limit: 20 };
      vi.mocked(orderService.listOrders).mockResolvedValue(mockResult);

      const req: MockRequest = { headers: { 'x-user-id': 'user-1' }, query: {} };
      const res = createMockRes();

      await list(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
        meta: { page: 1, limit: 20, total: 0 },
      });
    });

    it('should return 401 when x-user-id missing', async () => {
      const req: MockRequest = { headers: {}, query: {} };
      const res = createMockRes();

      await list(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('confirm', () => {
    it('should confirm order successfully', async () => {
      const mockOrder = { id: validUUID, status: 'CONFIRMED' };
      vi.mocked(orderService.confirmOrder).mockResolvedValue(
        mockOrder as Awaited<ReturnType<typeof orderService.confirmOrder>>,
      );

      const req: MockRequest = {
        params: { id: validUUID },
        headers: { 'x-user-id': 'user-1' },
      };
      const res = createMockRes();

      await confirm(req, res);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockOrder });
    });

    it('should return 404 when order cannot be confirmed', async () => {
      vi.mocked(orderService.confirmOrder).mockRejectedValue(
        new Error('Order not found or cannot be confirmed'),
      );

      const req: MockRequest = {
        params: { id: validUUID },
        headers: { 'x-user-id': 'user-1' },
      };
      const res = createMockRes();

      await confirm(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 401 when x-user-id missing', async () => {
      const req: MockRequest = { params: { id: validUUID }, headers: {} };
      const res = createMockRes();

      await confirm(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('cancel', () => {
    it('should cancel order successfully', async () => {
      const mockOrder = { id: validUUID, status: 'CANCELLED' };
      vi.mocked(orderService.cancelOrder).mockResolvedValue(
        mockOrder as Awaited<ReturnType<typeof orderService.cancelOrder>>,
      );

      const req: MockRequest = {
        params: { id: validUUID },
        headers: { 'x-user-id': 'user-1' },
      };
      const res = createMockRes();

      await cancel(req, res);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockOrder });
    });

    it('should return 404 when order cannot be cancelled', async () => {
      vi.mocked(orderService.cancelOrder).mockRejectedValue(
        new Error('Order not found or cannot be cancelled'),
      );

      const req: MockRequest = {
        params: { id: validUUID },
        headers: { 'x-user-id': 'user-1' },
      };
      const res = createMockRes();

      await cancel(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
