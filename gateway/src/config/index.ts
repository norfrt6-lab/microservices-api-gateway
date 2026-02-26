import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_ISSUER: z.string().min(1).optional(),
  JWT_AUDIENCE: z.string().min(1).optional(),
  TRUST_PROXY: z.union([z.string(), z.coerce.number()]).default(''),
  GATEWAY_SECRET: z.string().min(1),
  API_VERSION: z.string().default('v1'),
  REDIS_URL: z.string().url().default('redis://redis:6379'),
  NATS_URL: z.string().default('nats://nats:4222'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  RATE_LIMIT_AUTHENTICATED_MAX: z.coerce.number().default(500),
  USER_SERVICE_URL: z.string().url().default('http://user-service:3001'),
  PRODUCT_SERVICE_URL: z.string().url().default('http://product-service:3002'),
  ORDER_SERVICE_URL: z.string().url().default('http://order-service:3003'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://jaeger:4318'),
  OTEL_SERVICE_NAME: z.string().default('gateway'),
  OTEL_SERVICE_VERSION: z.string().default('1.0.0'),
  OTEL_TRACES_SAMPLER_RATIO: z.coerce.number().min(0).max(1).default(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const trustProxy = (() => {
  const value = parsed.data.TRUST_PROXY;
  if (typeof value === 'number') return value;
  if (value === '' || value === 'false') return false;
  if (value === 'true') return true;
  const asNumber = Number(value);
  if (!Number.isNaN(asNumber)) return asNumber;
  return value;
})();

export const config = {
  port: parsed.data.PORT,
  nodeEnv: parsed.data.NODE_ENV,
  trustProxy,
  jwt: {
    secret: parsed.data.JWT_SECRET,
    expiresIn: parsed.data.JWT_EXPIRES_IN,
    issuer: parsed.data.JWT_ISSUER,
    audience: parsed.data.JWT_AUDIENCE,
  },
  gatewaySecret: parsed.data.GATEWAY_SECRET,
  apiVersion: parsed.data.API_VERSION,
  redis: {
    url: parsed.data.REDIS_URL,
  },
  nats: {
    url: parsed.data.NATS_URL,
  },
  rateLimit: {
    windowMs: parsed.data.RATE_LIMIT_WINDOW_MS,
    maxRequests: parsed.data.RATE_LIMIT_MAX_REQUESTS,
    authenticatedMax: parsed.data.RATE_LIMIT_AUTHENTICATED_MAX,
  },
  services: {
    user: parsed.data.USER_SERVICE_URL,
    product: parsed.data.PRODUCT_SERVICE_URL,
    order: parsed.data.ORDER_SERVICE_URL,
  },
  otel: {
    endpoint: parsed.data.OTEL_EXPORTER_OTLP_ENDPOINT,
    serviceName: parsed.data.OTEL_SERVICE_NAME,
    serviceVersion: parsed.data.OTEL_SERVICE_VERSION,
    samplerRatio: parsed.data.OTEL_TRACES_SAMPLER_RATIO,
  },
};
