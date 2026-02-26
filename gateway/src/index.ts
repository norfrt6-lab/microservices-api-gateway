// OTel tracer must be imported before other modules for auto-instrumentation
import './telemetry/tracer';
import './types/express';
import { app } from './app';
import { config } from './config';
import { logger } from './config/logger';
import { connectRedis, disconnectRedis } from './services/redis';
import { connectNats, disconnectNats } from './services/nats';
import { startServiceDiscovery, stopServiceDiscovery } from './services/discovery';

async function start() {
  try {
    // Connect to infrastructure dependencies
    await connectRedis();
    logger.info('Redis connected');

    await connectNats();
    logger.info('NATS connected');

    // Start listening for service heartbeats
    await startServiceDiscovery();
    logger.info('Service discovery started');

    const server = app.listen(config.port, () => {
      logger.info(`Gateway running on port ${config.port} [${config.nodeEnv}]`);
    });

    const shutdown = async () => {
      logger.info('Shutting down gateway...');
      const forceExit = setTimeout(() => process.exit(1), 10000);
      stopServiceDiscovery();
      server.close(async () => {
        try {
          await disconnectRedis();
          await disconnectNats();
          logger.info('Gateway stopped');
        } finally {
          clearTimeout(forceExit);
          process.exit(0);
        }
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    logger.fatal({ err }, 'Failed to start gateway');
    process.exit(1);
  }
}

start();
