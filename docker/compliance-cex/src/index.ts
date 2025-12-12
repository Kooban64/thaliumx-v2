#!/usr/bin/env node

/**
 * CEX Compliance Service Entry Point
 * Enterprise-grade compliance processing for ThaliumX CEX
 */

import 'dotenv/config';
import { CEXComplianceService } from './services/CEXComplianceService';
import { logger } from './utils/logger';
import { config } from './config';

async function main(): Promise<void> {
  try {
    logger.info('Starting CEX Compliance Service', {
      version: config.version,
      environment: config.environment,
      port: config.port,
    });

    const service = new CEXComplianceService();

    // Initialize service
    await service.initialize();

    // Start service
    await service.start();

    // Graceful shutdown handling
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, initiating graceful shutdown...');
      await service.shutdown();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, initiating graceful shutdown...');
      await service.shutdown();
      process.exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start CEX Compliance Service', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Start the service
main().catch((error) => {
  console.error('Critical error during startup:', error);
  process.exit(1);
});