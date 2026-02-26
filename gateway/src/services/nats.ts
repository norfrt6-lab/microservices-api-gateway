import { connect, NatsConnection, StringCodec } from 'nats';
import { config } from '../config';
import { logger } from '../config/logger';
import { natsMessagesTotal } from '../telemetry/meter';

let connection: NatsConnection | null = null;
const sc = StringCodec();

export async function connectNats(): Promise<NatsConnection> {
  if (!connection) {
    connection = await connect({
      servers: config.nats.url,
      name: 'gateway',
      reconnect: true,
      maxReconnectAttempts: -1,
      reconnectTimeWait: 2000,
    });

    logger.info(`NATS connected to ${config.nats.url}`);

    // Track NATS messages via subscription callback
    const origPublish = connection.publish.bind(connection);
    connection.publish = (
      subject: string,
      ...args: Parameters<typeof origPublish> extends [string, ...infer Rest] ? Rest : never
    ) => {
      natsMessagesTotal.inc({ subject, direction: 'outbound' });
      return origPublish(subject, ...args);
    };

    (async () => {
      const status = connection!.status();
      for await (const s of status) {
        logger.info({ type: s.type, data: s.data }, 'NATS status change');
      }
    })();
  }

  return connection;
}

export function getNatsConnection(): NatsConnection | null {
  return connection;
}

export async function isNatsHealthy(): Promise<boolean> {
  try {
    if (!connection || connection.isClosed()) return false;
    // Flush to verify connection is responsive
    await connection.flush();
    return true;
  } catch {
    return false;
  }
}

export async function disconnectNats(): Promise<void> {
  if (connection) {
    await connection.drain();
    connection = null;
  }
}

export { sc, StringCodec };
