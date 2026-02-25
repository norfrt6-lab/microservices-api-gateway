import { connect, NatsConnection, StringCodec, JSONCodec, Msg, MsgHdrs, headers } from 'nats';

const sc = StringCodec();
const jc = JSONCodec();

export interface NatsClientOptions {
  url: string;
  name: string;
  onStatusChange?: (type: string, data: any) => void;
}

let connection: NatsConnection | null = null;

export async function createNatsClient(options: NatsClientOptions): Promise<NatsConnection> {
  if (connection && !connection.isClosed()) {
    return connection;
  }

  connection = await connect({
    servers: options.url,
    name: options.name,
    reconnect: true,
    maxReconnectAttempts: -1,
    reconnectTimeWait: 2000,
  });

  if (options.onStatusChange) {
    (async () => {
      for await (const s of connection!.status()) {
        options.onStatusChange!(s.type as string, s.data);
      }
    })();
  }

  return connection;
}

export function getNatsConnection(): NatsConnection | null {
  return connection;
}

export async function closeNatsClient(): Promise<void> {
  if (connection) {
    await connection.drain();
    connection = null;
  }
}

/**
 * Create NATS headers with correlation ID for distributed tracing.
 */
export function createNatsHeaders(correlationId?: string): MsgHdrs {
  const h = headers();
  if (correlationId) {
    h.set('x-correlation-id', correlationId);
  }
  return h;
}

/**
 * Extract correlation ID from NATS message headers.
 */
export function getCorrelationId(msg: Msg): string | undefined {
  return msg.headers?.get('x-correlation-id');
}

export { sc, jc, StringCodec, JSONCodec, Msg, MsgHdrs, headers };
