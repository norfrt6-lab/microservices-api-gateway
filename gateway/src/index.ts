import { app } from './app';
import { config } from './config';
import { logger } from './config/logger';

const server = app.listen(config.port, () => {
  logger.info(`Gateway running on port ${config.port} [${config.nodeEnv}]`);
});

const shutdown = async () => {
  logger.info('Shutting down gateway...');
  server.close(() => {
    logger.info('Gateway stopped');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
