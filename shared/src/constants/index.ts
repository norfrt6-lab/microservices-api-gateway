// NATS Subjects
export const NATS_SUBJECTS = {
  // User Service
  USER_GET: 'user.get',
  USER_VERIFY: 'user.verify',

  // Product Service
  PRODUCT_CHECK_STOCK: 'product.checkStock',
  PRODUCT_RESERVE_STOCK: 'product.reserveStock',
  PRODUCT_RELEASE_STOCK: 'product.releaseStock',
  PRODUCT_GET: 'product.get',
  PRODUCT_UPDATED: 'product.updated',

  // Order Service
  ORDER_CREATED: 'order.created',
  ORDER_CONFIRMED: 'order.confirmed',
  ORDER_CANCELLED: 'order.cancelled',

  // Health
  HEALTH_PING: 'health.ping',
} as const;

// Service Names
export const SERVICES = {
  GATEWAY: 'gateway',
  USER: 'user-service',
  PRODUCT: 'product-service',
  ORDER: 'order-service',
} as const;

// Service Ports
export const PORTS = {
  GATEWAY: 3000,
  USER: 3001,
  PRODUCT: 3002,
  ORDER: 3003,
} as const;

// HTTP Headers
export const HEADERS = {
  CORRELATION_ID: 'x-correlation-id',
  GATEWAY_SECRET: 'x-gateway-secret',
  IDEMPOTENCY_KEY: 'idempotency-key',
} as const;
