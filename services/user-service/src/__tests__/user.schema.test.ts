import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from '../schemas/user.schema';

describe('registerSchema', () => {
  it('should accept valid registration data', () => {
    const result = registerSchema.parse({
      email: 'test@example.com',
      password: 'securepass123',
      name: 'John Doe',
    });
    expect(result.email).toBe('test@example.com');
    expect(result.name).toBe('John Doe');
  });

  it('should reject invalid email', () => {
    expect(() =>
      registerSchema.parse({ email: 'not-an-email', password: 'securepass123', name: 'John' }),
    ).toThrow('Invalid email format');
  });

  it('should reject short password', () => {
    expect(() =>
      registerSchema.parse({ email: 'test@example.com', password: '1234567', name: 'John' }),
    ).toThrow('at least 8 characters');
  });

  it('should reject empty name', () => {
    expect(() =>
      registerSchema.parse({ email: 'test@example.com', password: 'securepass123', name: '' }),
    ).toThrow();
  });

  it('should reject name over 100 characters', () => {
    expect(() =>
      registerSchema.parse({
        email: 'test@example.com',
        password: 'securepass123',
        name: 'a'.repeat(101),
      }),
    ).toThrow();
  });
});

describe('loginSchema', () => {
  it('should accept valid login data', () => {
    const result = loginSchema.parse({ email: 'test@example.com', password: 'mypassword' });
    expect(result.email).toBe('test@example.com');
    expect(result.password).toBe('mypassword');
  });

  it('should reject invalid email', () => {
    expect(() => loginSchema.parse({ email: 'bad', password: 'pass' })).toThrow();
  });

  it('should reject empty password', () => {
    expect(() => loginSchema.parse({ email: 'test@example.com', password: '' })).toThrow();
  });

  it('should reject missing fields', () => {
    expect(() => loginSchema.parse({})).toThrow();
  });
});
