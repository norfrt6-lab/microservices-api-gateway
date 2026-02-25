import { PrismaClient, Prisma, OrderStatus } from '@prisma/client';
import { natsRequest, natsPublish, NATS_SUBJECTS } from '@microservices/shared';
import { CreateOrderInput } from '../schemas/order.schema';

const prisma = new PrismaClient();

interface ProductInfo {
  id: string;
  name: string;
  price: number;
  stock: number;
}

export async function createOrder(
  userId: string,
  data: CreateOrderInput,
  idempotencyKey?: string,
  correlationId?: string,
) {
  // Check idempotency — return existing order if key was already used
  if (idempotencyKey) {
    const existing = await prisma.order.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;
  }

  // Step 1: Check stock availability for all items via NATS
  for (const item of data.items) {
    const result = await natsRequest<
      { productId: string; quantity: number },
      { available: boolean }
    >(NATS_SUBJECTS.PRODUCT_CHECK_STOCK, { productId: item.productId, quantity: item.quantity }, correlationId);

    if (!result.available) {
      throw new Error(`Insufficient stock for product ${item.productId}`);
    }
  }

  // Step 2: Reserve stock for all items (saga step)
  const reservedItems: { productId: string; quantity: number }[] = [];
  try {
    for (const item of data.items) {
      const result = await natsRequest<
        { productId: string; quantity: number },
        { reserved: boolean }
      >(NATS_SUBJECTS.PRODUCT_RESERVE_STOCK, { productId: item.productId, quantity: item.quantity }, correlationId);

      if (!result.reserved) {
        throw new Error(`Failed to reserve stock for product ${item.productId}`);
      }
      reservedItems.push({ productId: item.productId, quantity: item.quantity });
    }
  } catch (err) {
    // Saga compensation: release any stock that was reserved
    await compensateReservations(reservedItems, correlationId);
    throw err;
  }

  // Step 3: Calculate total from reserved items
  // Fetch product details to get prices
  let total = new Prisma.Decimal(0);
  const itemsWithPrice: { productId: string; quantity: number; price: number }[] = [];

  for (const item of data.items) {
    const product = await natsRequest<{ productId: string }, ProductInfo>(
      'product.get',
      { productId: item.productId },
      correlationId,
    ).catch(() => null);

    // If we can't fetch price via NATS, use a fallback approach
    const price = product?.price ?? 0;
    itemsWithPrice.push({ productId: item.productId, quantity: item.quantity, price });
    total = total.add(new Prisma.Decimal(price).mul(item.quantity));
  }

  // Step 4: Create the order
  const order = await prisma.order.create({
    data: {
      userId,
      items: itemsWithPrice as unknown as Prisma.InputJsonValue,
      total,
      status: OrderStatus.STOCK_RESERVED,
      sagaStep: 'STOCK_RESERVED',
      idempotencyKey,
    },
  });

  // Step 5: Publish order.created event
  natsPublish(NATS_SUBJECTS.ORDER_CREATED, {
    orderId: order.id,
    userId: order.userId,
    items: itemsWithPrice,
    total: order.total.toString(),
    status: order.status,
  }, correlationId);

  return order;
}

export async function getOrderById(id: string, userId?: string) {
  const where: Prisma.OrderWhereInput = { id };
  if (userId) where.userId = userId;

  const order = await prisma.order.findFirst({ where });
  if (!order) throw new Error('Order not found');
  return order;
}

export async function listOrders(userId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.order.count({ where: { userId } }),
  ]);

  return { orders, total, page, limit };
}

export async function confirmOrder(id: string, userId: string, correlationId?: string) {
  const order = await prisma.order.findFirst({
    where: { id, userId, status: OrderStatus.STOCK_RESERVED },
  });

  if (!order) throw new Error('Order not found or cannot be confirmed');

  const updated = await prisma.order.update({
    where: { id },
    data: { status: OrderStatus.CONFIRMED, sagaStep: 'CONFIRMED' },
  });

  natsPublish(NATS_SUBJECTS.ORDER_CONFIRMED, {
    orderId: updated.id,
    userId: updated.userId,
    status: updated.status,
  }, correlationId);

  return updated;
}

export async function cancelOrder(id: string, userId: string, correlationId?: string) {
  const order = await prisma.order.findFirst({
    where: { id, userId, status: { in: [OrderStatus.PENDING, OrderStatus.STOCK_RESERVED] } },
  });

  if (!order) throw new Error('Order not found or cannot be cancelled');

  // Saga compensation: release reserved stock
  const items = order.items as { productId: string; quantity: number }[];
  await compensateReservations(items, correlationId);

  const updated = await prisma.order.update({
    where: { id },
    data: { status: OrderStatus.CANCELLED, sagaStep: 'CANCELLED' },
  });

  natsPublish(NATS_SUBJECTS.ORDER_CANCELLED, {
    orderId: updated.id,
    userId: updated.userId,
    status: updated.status,
  }, correlationId);

  return updated;
}

async function compensateReservations(
  items: { productId: string; quantity: number }[],
  correlationId?: string,
) {
  for (const item of items) {
    try {
      await natsRequest<
        { productId: string; quantity: number },
        { released: boolean }
      >(NATS_SUBJECTS.PRODUCT_RELEASE_STOCK, { productId: item.productId, quantity: item.quantity }, correlationId);
    } catch (err) {
      console.error(`[SAGA] Failed to release stock for ${item.productId}:`, err);
    }
  }
}

export { prisma };
