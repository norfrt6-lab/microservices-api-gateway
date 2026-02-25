import { PrismaClient, OrderStatus } from '@prisma/client';
import { natsRequest, natsPublish, retry, NATS_SUBJECTS } from '@microservices/shared';

const prisma = new PrismaClient();

/**
 * Saga step definition — each step has an execute action and a compensate action.
 */
interface SagaStep<TCtx> {
  name: string;
  execute: (ctx: TCtx) => Promise<void>;
  compensate: (ctx: TCtx) => Promise<void>;
}

interface OrderSagaContext {
  orderId: string;
  userId: string;
  items: { productId: string; quantity: number; price: number }[];
  correlationId?: string;
  reservedItems: { productId: string; quantity: number }[];
}

/**
 * Execute a saga — run each step in order.
 * If any step fails, compensate all previously completed steps in reverse order.
 */
async function executeSaga<TCtx>(steps: SagaStep<TCtx>[], ctx: TCtx): Promise<void> {
  const completedSteps: SagaStep<TCtx>[] = [];

  for (const step of steps) {
    try {
      await step.execute(ctx);
      completedSteps.push(step);
    } catch (err) {
      console.error(`[SAGA] Step "${step.name}" failed:`, err);

      // Compensate in reverse order
      for (const completed of [...completedSteps].reverse()) {
        try {
          await completed.compensate(ctx);
          console.log(`[SAGA] Compensated step "${completed.name}"`);
        } catch (compErr) {
          console.error(`[SAGA] Compensation failed for "${completed.name}":`, compErr);
        }
      }

      throw err;
    }
  }
}

/**
 * Order creation saga:
 *
 * 1. Create order (status: PENDING)
 * 2. Reserve stock → NATS request to product-service (with retry)
 *    - Success → step 3
 *    - Failure → cancel order (compensation)
 * 3. Process payment (simulated)
 *    - Success → confirm order (CONFIRMED)
 *    - Failure → release stock (compensation) → cancel order
 * 4. Publish order.confirmed event
 */
export async function runOrderCreationSaga(
  userId: string,
  items: { productId: string; quantity: number; price: number }[],
  idempotencyKey?: string,
  correlationId?: string,
) {
  // Idempotency check
  if (idempotencyKey) {
    const existing = await prisma.order.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;
  }

  // Calculate total
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Create the order first (PENDING)
  const order = await prisma.order.create({
    data: {
      userId,
      items: items as any,
      total,
      status: OrderStatus.PENDING,
      sagaStep: 'CREATED',
      idempotencyKey,
    },
  });

  const ctx: OrderSagaContext = {
    orderId: order.id,
    userId,
    items,
    correlationId,
    reservedItems: [],
  };

  const steps: SagaStep<OrderSagaContext>[] = [
    {
      name: 'reserve-stock',
      execute: async (ctx) => {
        for (const item of ctx.items) {
          const result = await retry(
            () =>
              natsRequest<
                { productId: string; quantity: number },
                { reserved: boolean }
              >(NATS_SUBJECTS.PRODUCT_RESERVE_STOCK, { productId: item.productId, quantity: item.quantity }, ctx.correlationId),
            { maxAttempts: 3, baseDelayMs: 1000 },
          );

          if (!result.reserved) {
            throw new Error(`Failed to reserve stock for product ${item.productId}`);
          }
          ctx.reservedItems.push({ productId: item.productId, quantity: item.quantity });
        }

        await prisma.order.update({
          where: { id: ctx.orderId },
          data: { status: OrderStatus.STOCK_RESERVED, sagaStep: 'STOCK_RESERVED' },
        });
      },
      compensate: async (ctx) => {
        for (const item of ctx.reservedItems) {
          try {
            await natsRequest<
              { productId: string; quantity: number },
              { released: boolean }
            >(NATS_SUBJECTS.PRODUCT_RELEASE_STOCK, { productId: item.productId, quantity: item.quantity }, ctx.correlationId);
          } catch (err) {
            console.error(`[SAGA] Failed to release stock for ${item.productId}:`, err);
          }
        }
      },
    },
    {
      name: 'process-payment',
      execute: async (ctx) => {
        // Simulated payment processing
        // In production: call payment service via NATS
        await prisma.order.update({
          where: { id: ctx.orderId },
          data: { sagaStep: 'PAYMENT_PROCESSED' },
        });
      },
      compensate: async (ctx) => {
        // Simulated payment refund
        await prisma.order.update({
          where: { id: ctx.orderId },
          data: { sagaStep: 'PAYMENT_REFUNDED' },
        });
      },
    },
    {
      name: 'confirm-order',
      execute: async (ctx) => {
        await prisma.order.update({
          where: { id: ctx.orderId },
          data: { status: OrderStatus.CONFIRMED, sagaStep: 'CONFIRMED' },
        });

        natsPublish(NATS_SUBJECTS.ORDER_CONFIRMED, {
          orderId: ctx.orderId,
          userId: ctx.userId,
          items: ctx.items,
          status: 'CONFIRMED',
        }, ctx.correlationId);
      },
      compensate: async (ctx) => {
        await prisma.order.update({
          where: { id: ctx.orderId },
          data: { status: OrderStatus.CANCELLED, sagaStep: 'CANCELLED' },
        });

        natsPublish(NATS_SUBJECTS.ORDER_CANCELLED, {
          orderId: ctx.orderId,
          userId: ctx.userId,
          status: 'CANCELLED',
        }, ctx.correlationId);
      },
    },
  ];

  try {
    await executeSaga(steps, ctx);
  } catch (err) {
    // Mark order as failed
    await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.FAILED, sagaStep: 'FAILED' },
    }).catch(() => {});

    throw err;
  }

  // Return the final order
  return prisma.order.findUnique({ where: { id: order.id } });
}

export { prisma as sagaPrisma };
