import { describe, it, expect } from 'vitest';
import { generateIdempotencyKey, isValidIdempotencyKey } from '../utils/idempotency';

describe('idempotency utilities', () => {
  describe('generateIdempotencyKey', () => {
    it('should generate a valid UUID', () => {
      const key = generateIdempotencyKey();
      expect(isValidIdempotencyKey(key)).toBe(true);
    });

    it('should generate unique keys', () => {
      const keys = new Set(Array.from({ length: 100 }, () => generateIdempotencyKey()));
      expect(keys.size).toBe(100);
    });
  });

  describe('isValidIdempotencyKey', () => {
    it('should accept valid UUID v4', () => {
      expect(isValidIdempotencyKey('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should accept lowercase UUIDs', () => {
      expect(isValidIdempotencyKey('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
    });

    it('should accept uppercase UUIDs', () => {
      expect(isValidIdempotencyKey('A1B2C3D4-E5F6-7890-ABCD-EF1234567890')).toBe(true);
    });

    it('should reject empty string', () => {
      expect(isValidIdempotencyKey('')).toBe(false);
    });

    it('should reject non-UUID strings', () => {
      expect(isValidIdempotencyKey('not-a-uuid')).toBe(false);
    });

    it('should reject UUID with wrong length', () => {
      expect(isValidIdempotencyKey('550e8400-e29b-41d4-a716')).toBe(false);
    });

    it('should reject UUID with invalid characters', () => {
      expect(isValidIdempotencyKey('550e8400-e29b-41d4-a716-44665544000g')).toBe(false);
    });
  });
});
