import client from 'prom-client';

// Create a global registry
const register = new client.Registry();

// Default metrics (CPU, memory, event loop lag, etc.)
client.collectDefaultMetrics({ register });

// --- HTTP Metrics ---

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// --- Circuit Breaker Metrics ---

export const circuitBreakerState = new client.Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=open, 2=half_open)',
  labelNames: ['service'] as const,
  registers: [register],
});

// --- NATS Metrics ---

export const natsMessagesTotal = new client.Counter({
  name: 'nats_messages_total',
  help: 'Total NATS messages',
  labelNames: ['subject', 'direction'] as const,
  registers: [register],
});

// --- Rate Limiter Metrics ---

export const rateLimitHitsTotal = new client.Counter({
  name: 'rate_limit_hits_total',
  help: 'Total rate limit hits (429 responses)',
  labelNames: ['tier'] as const,
  registers: [register],
});

// --- Cache Metrics ---

export const cacheHitsTotal = new client.Counter({
  name: 'cache_hits_total',
  help: 'Total cache hits',
  registers: [register],
});

export const cacheMissesTotal = new client.Counter({
  name: 'cache_misses_total',
  help: 'Total cache misses',
  registers: [register],
});

// --- Business Metrics ---

export const ordersCreatedTotal = new client.Counter({
  name: 'orders_created_total',
  help: 'Total orders created',
  registers: [register],
});

export const usersRegisteredTotal = new client.Counter({
  name: 'users_registered_total',
  help: 'Total users registered',
  registers: [register],
});

export { register };
