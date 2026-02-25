import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../config/logger';

let client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!client) {
    client = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 5) return null;
        return Math.min(times * 500, 3000);
      },
    });

    client.on('connect', () => logger.info('Redis connected'));
    client.on('error', (err) => logger.error({ err }, 'Redis error'));
    client.on('close', () => logger.warn('Redis connection closed'));
  }

  return client;
}

export async function connectRedis(): Promise<void> {
  const redis = getRedisClient();
  await redis.connect();
}

export async function isRedisHealthy(): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
