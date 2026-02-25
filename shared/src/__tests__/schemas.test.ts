import { describe, it, expect } from 'vitest';
import { paginationSchema, idParamSchema } from '../schemas/common.schema';

describe('paginationSchema', () => {
  it('should use defaults when no input provided', () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.sortOrder).toBe('desc');
  });

  it('should coerce string numbers', () => {
    const result = paginationSchema.parse({ page: '3', limit: '50' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it('should reject negative page', () => {
    expect(() => paginationSchema.parse({ page: -1 })).toThrow();
  });

  it('should reject page 0', () => {
    expect(() => paginationSchema.parse({ page: 0 })).toThrow();
  });

  it('should reject limit > 100', () => {
    expect(() => paginationSchema.parse({ limit: 101 })).toThrow();
  });

  it('should accept valid sortOrder', () => {
    const result = paginationSchema.parse({ sortOrder: 'asc' });
    expect(result.sortOrder).toBe('asc');
  });

  it('should reject invalid sortOrder', () => {
    expect(() => paginationSchema.parse({ sortOrder: 'random' })).toThrow();
  });

  it('should accept optional sortBy', () => {
    const result = paginationSchema.parse({ sortBy: 'createdAt' });
    expect(result.sortBy).toBe('createdAt');
  });
});

describe('idParamSchema', () => {
  it('should accept valid UUID', () => {
    const result = idParamSchema.parse({ id: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should reject non-UUID string', () => {
    expect(() => idParamSchema.parse({ id: 'not-a-uuid' })).toThrow('Invalid ID format');
  });

  it('should reject empty string', () => {
    expect(() => idParamSchema.parse({ id: '' })).toThrow();
  });

  it('should reject numeric ID', () => {
    expect(() => idParamSchema.parse({ id: '12345' })).toThrow();
  });
});
