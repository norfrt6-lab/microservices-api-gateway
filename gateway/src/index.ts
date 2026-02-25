import { app } from './app';
import { config } from './config';
import { logger } from './config/logger';
import { connectRedis, disconnectRedis } from './services/redis';
import { connectNats, disconnectNats } from './services/nats';

async function start() {
  try {
    // Connect to infrastructure dependencies
    await connectRedis();
    logger.info('Redis connected');

    await connectNats();
    logger.info('NATS connected');

    const server = app.listen(config.port, () => {
      logger.info(`Gateway running on port ${config.port} [${config.nodeEnv}]`);
    });

    const shutdown = async () => {
      logger.info('Shutting down gateway...');
      server.close(async () => {
        await disconnectRedis();
        await disconnectNats();
        logger.info('Gateway stopped');
        process.exit(0);
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
