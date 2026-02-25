import { getNatsConnection, jc } from './client';
import { NATS_SUBJECTS } from '../constants';

let heartbeatTimer: NodeJS.Timeout | null = null;

/**
 * Start sending heartbeats to the gateway via NATS.
 * Publishes service name and URL every 10 seconds.
 */
export function startHeartbeat(serviceName: string, serviceUrl: string): void {
  const INTERVAL = 10000; // 10 seconds

  const sendHeartbeat = () => {
    const nc = getNatsConnection();
    if (nc && !nc.isClosed()) {
      nc.publish(
        NATS_SUBJECTS.HEALTH_PING,
        jc.encode({ name: serviceName, url: serviceUrl }),
      );
    }
  };

  // Send immediately, then on interval
  sendHeartbeat();
  heartbeatTimer = setInterval(sendHeartbeat, INTERVAL);
}

/**
 * Stop sending heartbeats.
 */
export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
