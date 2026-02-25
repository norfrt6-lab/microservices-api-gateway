import { getNatsConnection } from './nats';
import { NATS_SUBJECTS, SERVICES } from '@microservices/shared';
import { jc } from '@microservices/shared';
import { logger } from '../config/logger';

interface ServiceInstance {
  name: string;
  url: string;
  lastHeartbeat: number;
  status: 'healthy' | 'unhealthy';
}

const registry: Map<string, ServiceInstance> = new Map();
const HEARTBEAT_INTERVAL = 10000; // 10 seconds
const HEARTBEAT_TIMEOUT = 30000; // 30 seconds — mark unhealthy after 3 missed beats
let heartbeatChecker: NodeJS.Timeout | null = null;

/**
 * Start listening for service heartbeats via NATS.
 * Services publish to health.ping with their name and URL.
 */
export async function startServiceDiscovery(): Promise<void> {
  const nc = getNatsConnection();
  if (!nc) {
    logger.warn('NATS not connected — service discovery not started');
    return;
  }

  const sub = nc.subscribe(NATS_SUBJECTS.HEALTH_PING);
  logger.info('Service discovery started — listening for heartbeats');

  (async () => {
    for await (const msg of sub) {
      try {
        const data = jc.decode(msg.data) as { name: string; url: string };
        registry.set(data.name, {
          name: data.name,
          url: data.url,
          lastHeartbeat: Date.now(),
          status: 'healthy',
        });

        logger.debug({ service: data.name }, 'Heartbeat received');
      } catch (err) {
        logger.error({ err }, 'Failed to decode heartbeat message');
      }
    }
  })();

  // Periodically check for stale heartbeats
  heartbeatChecker = setInterval(() => {
    const now = Date.now();
    for (const [name, instance] of registry) {
      if (now - instance.lastHeartbeat > HEARTBEAT_TIMEOUT) {
        if (instance.status !== 'unhealthy') {
          instance.status = 'unhealthy';
          logger.warn({ service: name, lastHeartbeat: instance.lastHeartbeat }, 'Service heartbeat timeout');
        }
      }
    }
  }, HEARTBEAT_INTERVAL);
}

/**
 * Stop service discovery listener.
 */
export function stopServiceDiscovery(): void {
  if (heartbeatChecker) {
    clearInterval(heartbeatChecker);
    heartbeatChecker = null;
  }
}

/**
 * Get all registered services with their health status.
 */
export function getRegisteredServices(): ServiceInstance[] {
  return Array.from(registry.values());
}

/**
 * Check if a specific service is registered and healthy.
 */
export function isServiceHealthy(name: string): boolean {
  const instance = registry.get(name);
  return instance?.status === 'healthy';
}
