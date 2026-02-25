import { describe, it, expect } from 'vitest';
import { NATS_SUBJECTS, SERVICES, PORTS, HEADERS } from '../constants';

describe('constants', () => {
  describe('NATS_SUBJECTS', () => {
    it('should define user subjects', () => {
      expect(NATS_SUBJECTS.USER_GET).toBe('user.get');
      expect(NATS_SUBJECTS.USER_VERIFY).toBe('user.verify');
    });

    it('should define product subjects', () => {
      expect(NATS_SUBJECTS.PRODUCT_CHECK_STOCK).toBe('product.checkStock');
      expect(NATS_SUBJECTS.PRODUCT_RESERVE_STOCK).toBe('product.reserveStock');
      expect(NATS_SUBJECTS.PRODUCT_RELEASE_STOCK).toBe('product.releaseStock');
    });

    it('should define order subjects', () => {
      expect(NATS_SUBJECTS.ORDER_CREATED).toBe('order.created');
      expect(NATS_SUBJECTS.ORDER_CONFIRMED).toBe('order.confirmed');
      expect(NATS_SUBJECTS.ORDER_CANCELLED).toBe('order.cancelled');
    });

    it('should define health subject', () => {
      expect(NATS_SUBJECTS.HEALTH_PING).toBe('health.ping');
    });
  });

  describe('SERVICES', () => {
    it('should define all service names', () => {
      expect(SERVICES.GATEWAY).toBe('gateway');
      expect(SERVICES.USER).toBe('user-service');
      expect(SERVICES.PRODUCT).toBe('product-service');
      expect(SERVICES.ORDER).toBe('order-service');
    });
  });

  describe('PORTS', () => {
    it('should define unique ports for each service', () => {
      expect(PORTS.GATEWAY).toBe(3000);
      expect(PORTS.USER).toBe(3001);
      expect(PORTS.PRODUCT).toBe(3002);
      expect(PORTS.ORDER).toBe(3003);
    });

    it('should have no duplicate ports', () => {
      const ports = Object.values(PORTS);
      expect(new Set(ports).size).toBe(ports.length);
    });
  });

  describe('HEADERS', () => {
    it('should define standard headers', () => {
      expect(HEADERS.CORRELATION_ID).toBe('x-correlation-id');
      expect(HEADERS.GATEWAY_SECRET).toBe('x-gateway-secret');
      expect(HEADERS.IDEMPOTENCY_KEY).toBe('idempotency-key');
    });
  });
});
