/**
 * Event Consumer for Token Compliance Service
 * Kafka event consumption and processing
 */

import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { getConfig } from '../../config';
import { createComponentLogger } from '../../utils/logger';
import { TOKEN_COMPLIANCE_TOPICS } from '../../types/events';
import type { TokenComplianceEvent, TokenComplianceEventType } from '../../types/events';

const logger = createComponentLogger('event-consumer');

/**
 * Event handler type
 */
type EventHandler = (event: TokenComplianceEvent) => Promise<void>;

/**
 * Event Consumer class
 */
export class EventConsumer {
  private kafka: Kafka;
  private consumer: Consumer;
  private connected = false;
  private handlers: Map<string, EventHandler[]> = new Map();

  constructor() {
    const config = getConfig();

    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
    });

    this.consumer = this.kafka.consumer({
      groupId: config.kafka.groupId,
    });
  }

  /**
   * Connect to Kafka
   */
  async connect(): Promise<void> {
    if (this.connected) {
      logger.warn('Consumer already connected');
      return;
    }

    try {
      await this.consumer.connect();
      this.connected = true;
      logger.info('Event consumer connected');
    } catch (error) {
      logger.error('Failed to connect event consumer', error as Error);
      throw error;
    }
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.consumer.disconnect();
      this.connected = false;
      logger.info('Event consumer disconnected');
    }
  }

  /**
   * Check if consumer is healthy
   */
  isHealthy(): boolean {
    return this.connected;
  }

  /**
   * Subscribe to topics
   */
  async subscribe(topics: string[]): Promise<void> {
    if (!this.connected) {
      throw new Error('Consumer not connected');
    }

    for (const topic of topics) {
      await this.consumer.subscribe({ topic, fromBeginning: false });
      logger.info('Subscribed to topic', { topic });
    }
  }

  /**
   * Register event handler
   */
  registerHandler(eventType: TokenComplianceEventType, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType) ?? [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
    logger.debug('Registered handler for event type', { eventType });
  }

  /**
   * Start consuming messages
   */
  async start(): Promise<void> {
    if (!this.connected) {
      throw new Error('Consumer not connected');
    }

    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        await this.handleMessage(payload);
      },
    });

    logger.info('Event consumer started');
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;

    if (!message.value) {
      logger.warn('Received message with no value', { topic, partition });
      return;
    }

    try {
      const event = JSON.parse(message.value.toString()) as TokenComplianceEvent;
      const eventType = event.eventType;

      logger.logKafkaEvent('received', topic, {
        eventId: event.eventId,
        eventType,
        partition,
      });

      const handlers = this.handlers.get(eventType);
      if (handlers && handlers.length > 0) {
        for (const handler of handlers) {
          try {
            await handler(event);
          } catch (error) {
            logger.error('Event handler failed', {
              eventType,
              eventId: event.eventId,
              error: (error as Error).message,
            });
          }
        }
      } else {
        logger.debug('No handlers registered for event type', { eventType });
      }
    } catch (error) {
      logger.error('Failed to process message', {
        topic,
        partition,
        error: (error as Error).message,
      });
    }
  }
}

/**
 * Singleton event consumer instance
 */
let eventConsumerInstance: EventConsumer | null = null;

/**
 * Get event consumer instance
 */
export function getEventConsumer(): EventConsumer {
  if (!eventConsumerInstance) {
    eventConsumerInstance = new EventConsumer();
  }
  return eventConsumerInstance;
}

/**
 * Reset event consumer (for testing)
 */
export function resetEventConsumer(): void {
  eventConsumerInstance = null;
}

/**
 * Subscribe to token events
 */
export async function subscribeToTokenEvents(consumer: EventConsumer): Promise<void> {
  await consumer.subscribe([
    TOKEN_COMPLIANCE_TOPICS.TOKEN_CONTRACTS,
    TOKEN_COMPLIANCE_TOPICS.TOKEN_TRANSFERS,
    TOKEN_COMPLIANCE_TOPICS.TOKEN_APPROVALS,
    TOKEN_COMPLIANCE_TOPICS.TOKEN_HOLDERS,
    TOKEN_COMPLIANCE_TOPICS.TOKEN_PRESALES,
  ]);
}

/**
 * Subscribe to compliance events
 */
export async function subscribeToComplianceEvents(consumer: EventConsumer): Promise<void> {
  await consumer.subscribe([
    TOKEN_COMPLIANCE_TOPICS.TOKEN_COMPLIANCE_EVENTS,
    TOKEN_COMPLIANCE_TOPICS.TOKEN_WALLET_SCREENINGS,
    TOKEN_COMPLIANCE_TOPICS.TOKEN_RISK_ASSESSMENTS,
    TOKEN_COMPLIANCE_TOPICS.TOKEN_TRAVEL_RULE,
    TOKEN_COMPLIANCE_TOPICS.TOKEN_CARF,
  ]);
}

export default getEventConsumer;
