import { describe, it, expect } from 'vitest';
import { createOrderSchema, updateOrderStatusSchema } from '../schemas/order.schema';

describe('createOrderSchema', () => {
  it('should accept valid order data', () => {
    const result = createOrderSchema.parse({
      items: [
        { productId: '550e8400-e29b-41d4-a716-446655440000', quantity: 2 },
        { productId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', quantity: 1 },
      ],
    });
    expect(result.items).toHaveLength(2);
    expect(result.items[0].quantity).toBe(2);
  });

  it('should reject empty items array', () => {
    expect(() => createOrderSchema.parse({ items: [] })).toThrow('at least one item');
  });

  it('should reject invalid product ID', () => {
    expect(() =>
      createOrderSchema.parse({ items: [{ productId: 'not-a-uuid', quantity: 1 }] }),
    ).toThrow('Invalid product ID');
  });

  it('should reject zero quantity', () => {
    expect(() =>
      createOrderSchema.parse({
        items: [{ productId: '550e8400-e29b-41d4-a716-446655440000', quantity: 0 }],
      }),
    ).toThrow();
  });

  it('should reject negative quantity', () => {
    expect(() =>
      createOrderSchema.parse({
        items: [{ productId: '550e8400-e29b-41d4-a716-446655440000', quantity: -1 }],
      }),
    ).toThrow();
  });

  it('should reject non-integer quantity', () => {
    expect(() =>
      createOrderSchema.parse({
        items: [{ productId: '550e8400-e29b-41d4-a716-446655440000', quantity: 1.5 }],
      }),
    ).toThrow();
  });

  it('should reject missing items field', () => {
    expect(() => createOrderSchema.parse({})).toThrow();
  });
});

describe('updateOrderStatusSchema', () => {
  it('should accept CONFIRMED status', () => {
    const result = updateOrderStatusSchema.parse({ status: 'CONFIRMED' });
    expect(result.status).toBe('CONFIRMED');
  });

  it('should accept CANCELLED status', () => {
    const result = updateOrderStatusSchema.parse({ status: 'CANCELLED' });
    expect(result.status).toBe('CANCELLED');
  });

  it('should reject invalid status', () => {
    expect(() => updateOrderStatusSchema.parse({ status: 'PENDING' })).toThrow(
      'Status must be CONFIRMED or CANCELLED',
    );
  });

  it('should reject empty status', () => {
    expect(() => updateOrderStatusSchema.parse({ status: '' })).toThrow();
  });
});
