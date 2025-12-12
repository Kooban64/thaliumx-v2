/**
 * Event Consumer for DEX Compliance Service
 * Kafka consumer for processing compliance events
 */

import { Kafka, Consumer, EachMessagePayload, ConsumerSubscribeTopics } from 'kafkajs';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { DEXComplianceEvent } from '../../types/events';
import { DEX_COMPLIANCE_TOPICS } from './EventProducer';

// ==================== EVENT HANDLER TYPE ====================

export type EventHandler<T extends DEXComplianceEvent = DEXComplianceEvent> = (
  event: T
) => Promise<void>;

// ==================== EVENT CONSUMER ====================

/**
 * Kafka event consumer for DEX compliance events
 */
export class EventConsumer {
  private static instance: EventConsumer;
  private kafka: Kafka | null = null;
  private consumer: Consumer | null = null;
  private isConnected = false;
  private handlers: Map<string, EventHandler[]> = new Map();

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): EventConsumer {
    if (!EventConsumer.instance) {
      EventConsumer.instance = new EventConsumer();
    }
    return EventConsumer.instance;
  }

  /**
   * Initialize Kafka consumer
   */
  public async initialize(): Promise<void> {
    if (this.consumer) {
      logger.warn('Event consumer already initialized');
      return;
    }

    try {
      this.kafka = new Kafka({
        clientId: config.kafka.clientId,
        brokers: config.kafka.brokers,
        retry: {
          initialRetryTime: 100,
          retries: 8,
        },
      });

      this.consumer = this.kafka.consumer({
        groupId: config.kafka.groupId,
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
      });

      await this.consumer.connect();
      this.isConnected = true;

      logger.info('Event consumer initialized', {
        brokers: config.kafka.brokers,
        groupId: config.kafka.groupId,
      });
    } catch (error) {
      logger.error('Failed to initialize event consumer', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Subscribe to topics
   */
  public async subscribe(topics: string[]): Promise<void> {
    if (!this.consumer) {
      throw new Error('Event consumer not initialized');
    }

    const subscribeTopics: ConsumerSubscribeTopics = {
      topics,
      fromBeginning: false,
    };

    await this.consumer.subscribe(subscribeTopics);

    logger.info('Subscribed to topics', { topics });
  }

  /**
   * Subscribe to all DEX compliance topics
   */
  public async subscribeToAllTopics(): Promise<void> {
    const topics = Object.values(DEX_COMPLIANCE_TOPICS);
    await this.subscribe(topics);
  }

  /**
   * Register an event handler
   */
  public registerHandler(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);

    logger.debug('Event handler registered', { eventType });
  }

  /**
   * Start consuming messages
   */
  public async start(): Promise<void> {
    if (!this.consumer) {
      throw new Error('Event consumer not initialized');
    }

    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        await this.processMessage(payload);
      },
    });

    logger.info('Event consumer started');
  }

  /**
   * Process a single message
   */
  private async processMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;
    const startTime = Date.now();

    try {
      if (!message.value) {
        logger.warn('Received message with no value', { topic, partition });
        return;
      }

      const event = JSON.parse(message.value.toString()) as DEXComplianceEvent;
      const eventType = event.type;

      logger.debug('Processing event', {
        topic,
        partition,
        eventType,
        eventId: event.id,
      });

      // Get handlers for this event type
      const handlers = this.handlers.get(eventType) || [];

      if (handlers.length === 0) {
        logger.debug('No handlers registered for event type', { eventType });
        return;
      }

      // Execute all handlers
      await Promise.all(handlers.map((handler) => handler(event)));

      const duration = Date.now() - startTime;
      logger.debug('Event processed', {
        topic,
        eventType,
        eventId: event.id,
        duration,
        handlerCount: handlers.length,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to process event', {
        topic,
        partition,
        offset: message.offset,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't rethrow - we don't want to crash the consumer
    }
  }

  /**
   * Pause consumption
   */
  public async pause(topics: string[]): Promise<void> {
    if (!this.consumer) {
      throw new Error('Event consumer not initialized');
    }

    this.consumer.pause(topics.map((topic) => ({ topic })));
    logger.info('Consumer paused', { topics });
  }

  /**
   * Resume consumption
   */
  public async resume(topics: string[]): Promise<void> {
    if (!this.consumer) {
      throw new Error('Event consumer not initialized');
    }

    this.consumer.resume(topics.map((topic) => ({ topic })));
    logger.info('Consumer resumed', { topics });
  }

  /**
   * Get connection status
   */
  public getStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Get registered topics
   */
  public getRegisteredHandlers(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Close consumer connection
   */
  public async close(): Promise<void> {
    if (this.consumer) {
      await this.consumer.disconnect();
      this.consumer = null;
      this.kafka = null;
      this.isConnected = false;
      this.handlers.clear();
      logger.info('Event consumer closed');
    }
  }
}

// ==================== EXPORT ====================

export const eventConsumer = EventConsumer.getInstance();
