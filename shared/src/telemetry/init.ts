import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';
import client from 'prom-client';

let sdk: NodeSDK | null = null;
let metricsRegister: client.Registry | null = null;

/**
 * Initialize OpenTelemetry SDK for a service.
 * Must be called before any other imports (Express, Prisma, NATS).
 */
export function initTelemetry(serviceName: string): void {
  const traceExporter = new OTLPTraceExporter({
    url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://jaeger:4318'}/v1/traces`,
  });

  const serviceVersion = process.env.OTEL_SERVICE_VERSION || '1.0.0';
  const samplerRatioEnv = Number(process.env.OTEL_TRACES_SAMPLER_RATIO ?? '1');
  const samplerRatio = Number.isFinite(samplerRatioEnv) ? Math.max(0, Math.min(1, samplerRatioEnv)) : 1;

  sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
    }),
    traceExporter,
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(samplerRatio),
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });

  sdk.start();

  // Prometheus metrics
  metricsRegister = new client.Registry();
  client.collectDefaultMetrics({ register: metricsRegister });

  process.on('SIGTERM', () => {
    sdk?.shutdown().catch(console.error);
  });
}

/**
 * Get the Prometheus metrics registry for this service.
 */
export function getMetricsRegister(): client.Registry {
  if (!metricsRegister) {
    metricsRegister = new client.Registry();
    client.collectDefaultMetrics({ register: metricsRegister });
  }
  return metricsRegister;
}

/**
 * Shutdown the OTel SDK.
 */
export async function shutdownTelemetry(): Promise<void> {
  await sdk?.shutdown();
}
