import { getNatsConnection, jc, createNatsHeaders, getCorrelationId } from './client';
import { Msg, Subscription } from 'nats';

const DEFAULT_TIMEOUT = 5000; // 5 seconds

/**
 * Send a NATS request and wait for a reply (synchronous RPC pattern).
 * Propagates correlation ID via headers.
 */
export async function natsRequest<TReq, TRes>(
  subject: string,
  data: TReq,
  correlationId?: string,
  timeout = DEFAULT_TIMEOUT,
): Promise<TRes> {
  const nc = getNatsConnection();
  if (!nc) throw new Error('NATS not connected');

  const headers = createNatsHeaders(correlationId);
  const msg = await nc.request(subject, jc.encode(data), {
    timeout,
    headers,
  });

  return jc.decode(msg.data) as TRes;
}

/**
 * Publish an event to a NATS subject (fire-and-forget).
 * Propagates correlation ID via headers.
 */
export function natsPublish<T>(
  subject: string,
  data: T,
  correlationId?: string,
): void {
  const nc = getNatsConnection();
  if (!nc) throw new Error('NATS not connected');

  const headers = createNatsHeaders(correlationId);
  nc.publish(subject, jc.encode(data), { headers });
}

/**
 * Subscribe to a NATS subject and handle messages.
 * Extracts correlation ID from headers and passes to handler.
 */
export function natsSubscribe<T>(
  subject: string,
  handler: (data: T, correlationId: string | undefined, msg: Msg) => Promise<void> | void,
  queue?: string,
): Subscription {
  const nc = getNatsConnection();
  if (!nc) throw new Error('NATS not connected');

  const sub = nc.subscribe(subject, { queue });

  (async () => {
    for await (const msg of sub) {
      try {
        const data = jc.decode(msg.data) as T;
        const correlationId = getCorrelationId(msg);
        await handler(data, correlationId, msg);
      } catch (err) {
        // Publish to dead letter queue
        publishToDeadLetter(subject, msg, err);
      }
    }
  })();

  return sub;
}

/**
 * Subscribe to a NATS subject for request/reply pattern.
 * Automatically sends reply with handler return value.
 */
export function natsRespond<TReq, TRes>(
  subject: string,
  handler: (data: TReq, correlationId: string | undefined) => Promise<TRes>,
  queue?: string,
): Subscription {
  const nc = getNatsConnection();
  if (!nc) throw new Error('NATS not connected');

  const sub = nc.subscribe(subject, { queue });

  (async () => {
    for await (const msg of sub) {
      try {
        const data = jc.decode(msg.data) as TReq;
        const correlationId = getCorrelationId(msg);
        const result = await handler(data, correlationId);
        const headers = createNatsHeaders(correlationId);
        msg.respond(jc.encode(result), { headers });
      } catch (err) {
        // Reply with error
        const errorPayload = {
          error: true,
          message: err instanceof Error ? err.message : 'Unknown error',
        };
        msg.respond(jc.encode(errorPayload));
        publishToDeadLetter(subject, msg, err);
      }
    }
  })();

  return sub;
}

// --- Dead Letter Queue ---

const DLQ_SUBJECT = 'dlq';

interface DeadLetterMessage {
  originalSubject: string;
  data: string;
  error: string;
  timestamp: string;
  correlationId?: string;
}

/**
 * Publish a failed message to the dead letter queue.
 */
function publishToDeadLetter(subject: string, msg: Msg, err: unknown): void {
  try {
    const nc = getNatsConnection();
    if (!nc) return;

    const dlqMessage: DeadLetterMessage = {
      originalSubject: subject,
      data: Buffer.from(msg.data).toString('utf-8'),
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
      correlationId: getCorrelationId(msg),
    };

    nc.publish(DLQ_SUBJECT, jc.encode(dlqMessage));
  } catch {
    // Silently fail — can't do much if DLQ publish fails
  }
}
