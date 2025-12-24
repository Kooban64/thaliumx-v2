/**
 * Event consumer for Kafka integration
 */

import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('event-consumer');

export class EventConsumer {
  async start(): Promise<void> {
    logger.info('Starting event consumer (placeholder)');
    // Placeholder - no actual Kafka connection
  }

  async stop(): Promise<void> {
    logger.info('Stopping event consumer (placeholder)');
  }
}

let eventConsumer: EventConsumer | null = null;

export function getEventConsumer(): EventConsumer {
  if (!eventConsumer) {
    eventConsumer = new EventConsumer();
  }
  return eventConsumer;
}