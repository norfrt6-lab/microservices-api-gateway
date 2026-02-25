import { describe, it, expect } from 'vitest';
import { createProductSchema, updateProductSchema } from '../schemas/product.schema';

describe('createProductSchema', () => {
  it('should accept valid product data', () => {
    const result = createProductSchema.parse({
      name: 'Widget',
      description: 'A useful widget',
      price: 29.99,
      stock: 100,
    });
    expect(result.name).toBe('Widget');
    expect(result.price).toBe(29.99);
    expect(result.stock).toBe(100);
  });

  it('should accept product without description', () => {
    const result = createProductSchema.parse({ name: 'Widget', price: 9.99, stock: 0 });
    expect(result.description).toBeUndefined();
  });

  it('should reject empty name', () => {
    expect(() =>
      createProductSchema.parse({ name: '', price: 9.99, stock: 0 }),
    ).toThrow();
  });

  it('should reject name over 200 characters', () => {
    expect(() =>
      createProductSchema.parse({ name: 'a'.repeat(201), price: 9.99, stock: 0 }),
    ).toThrow();
  });

  it('should reject negative price', () => {
    expect(() =>
      createProductSchema.parse({ name: 'Widget', price: -1, stock: 0 }),
    ).toThrow('Price must be positive');
  });

  it('should reject zero price', () => {
    expect(() =>
      createProductSchema.parse({ name: 'Widget', price: 0, stock: 0 }),
    ).toThrow();
  });

  it('should reject negative stock', () => {
    expect(() =>
      createProductSchema.parse({ name: 'Widget', price: 9.99, stock: -1 }),
    ).toThrow('Stock cannot be negative');
  });

  it('should reject non-integer stock', () => {
    expect(() =>
      createProductSchema.parse({ name: 'Widget', price: 9.99, stock: 1.5 }),
    ).toThrow();
  });
});

describe('updateProductSchema', () => {
  it('should accept partial updates', () => {
    const result = updateProductSchema.parse({ name: 'New Name' });
    expect(result.name).toBe('New Name');
    expect(result.price).toBeUndefined();
  });

  it('should accept empty object (no updates)', () => {
    const result = updateProductSchema.parse({});
    expect(Object.keys(result).filter((k) => result[k as keyof typeof result] !== undefined)).toHaveLength(0);
  });

  it('should reject invalid price in update', () => {
    expect(() => updateProductSchema.parse({ price: -5 })).toThrow();
  });
});
