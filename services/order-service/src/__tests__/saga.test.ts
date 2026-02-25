import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma
vi.mock('@prisma/client', () => {
  const OrderStatus = {
    PENDING: 'PENDING',
    STOCK_RESERVED: 'STOCK_RESERVED',
    CONFIRMED: 'CONFIRMED',
    CANCELLED: 'CANCELLED',
    FAILED: 'FAILED',
  };

  const mockPrisma = {
    order: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  return {
    PrismaClient: vi.fn(() => mockPrisma),
    OrderStatus,
    __mockPrisma: mockPrisma,
  };
});

// Mock NATS
vi.mock('@microservices/shared', () => ({
  natsRequest: vi.fn(),
  natsPublish: vi.fn(),
  retry: vi.fn((fn: () => Promise<any>) => fn()),
  NATS_SUBJECTS: {
    PRODUCT_RESERVE_STOCK: 'product.reserveStock',
    PRODUCT_RELEASE_STOCK: 'product.releaseStock',
    ORDER_CONFIRMED: 'order.confirmed',
    ORDER_CANCELLED: 'order.cancelled',
  },
}));

import { runOrderCreationSaga } from '../services/saga';
import { natsRequest, natsPublish } from '@microservices/shared';
// @ts-expect-error accessing mock
import { __mockPrisma } from '@prisma/client';

const mockPrisma = __mockPrisma;

describe('order creation saga', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return existing order for duplicate idempotency key', async () => {
    const existingOrder = { id: 'ord-1', status: 'CONFIRMED', idempotencyKey: 'key-1' };
    mockPrisma.order.findUnique.mockResolvedValue(existingOrder);

    const result = await runOrderCreationSaga('user-1', [], 'key-1');

    expect(result).toEqual(existingOrder);
    expect(mockPrisma.order.create).not.toHaveBeenCalled();
  });

  it('should create order and run saga steps on success', async () => {
    const createdOrder = { id: 'ord-new', status: 'PENDING' };
    const finalOrder = { id: 'ord-new', status: 'CONFIRMED' };

    mockPrisma.order.findUnique
      .mockResolvedValueOnce(null) // idempotency check
      .mockResolvedValueOnce(finalOrder); // final fetch
    mockPrisma.order.create.mockResolvedValue(createdOrder);
    mockPrisma.order.update.mockResolvedValue({});
    vi.mocked(natsRequest).mockResolvedValue({ reserved: true });

    const items = [{ productId: 'p1', quantity: 2, price: 10 }];
    const result = await runOrderCreationSaga('user-1', items, undefined, 'corr-1');

    expect(mockPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          status: 'PENDING',
          sagaStep: 'CREATED',
        }),
      }),
    );

    // Stock reservation via NATS
    expect(natsRequest).toHaveBeenCalledWith(
      'product.reserveStock',
      { productId: 'p1', quantity: 2 },
      'corr-1',
    );

    // Order confirmed event published
    expect(natsPublish).toHaveBeenCalledWith(
      'order.confirmed',
      expect.objectContaining({ orderId: 'ord-new', status: 'CONFIRMED' }),
      'corr-1',
    );

    expect(result).toEqual(finalOrder);
  });

  it('should compensate on stock reservation failure', async () => {
    const createdOrder = { id: 'ord-fail', status: 'PENDING' };

    mockPrisma.order.findUnique.mockResolvedValueOnce(null);
    mockPrisma.order.create.mockResolvedValue(createdOrder);
    mockPrisma.order.update.mockResolvedValue({});

    // First item reserves fine, second fails
    vi.mocked(natsRequest)
      .mockResolvedValueOnce({ reserved: true }) // reserve item 1
      .mockResolvedValueOnce({ reserved: false }); // reserve item 2 fails

    const items = [
      { productId: 'p1', quantity: 1, price: 10 },
      { productId: 'p2', quantity: 1, price: 20 },
    ];

    await expect(
      runOrderCreationSaga('user-1', items),
    ).rejects.toThrow('Failed to reserve stock for product p2');

    // Order should be marked as FAILED
    expect(mockPrisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ord-fail' },
        data: { status: 'FAILED', sagaStep: 'FAILED' },
      }),
    );
  });

  it('should calculate total correctly', async () => {
    mockPrisma.order.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({});
    mockPrisma.order.create.mockResolvedValue({ id: 'ord-calc' });
    mockPrisma.order.update.mockResolvedValue({});
    vi.mocked(natsRequest).mockResolvedValue({ reserved: true });

    const items = [
      { productId: 'p1', quantity: 3, price: 10 },
      { productId: 'p2', quantity: 2, price: 25 },
    ];

    await runOrderCreationSaga('user-1', items);

    // Total should be 3*10 + 2*25 = 80
    expect(mockPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ total: 80 }),
      }),
    );
  });
});
