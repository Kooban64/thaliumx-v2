/**
 * Kafka Event Consumer for NFT Compliance Service
 * Consumes NFT events from Kafka topics for compliance processing
 */

import { Kafka, Consumer, EachMessagePayload, ConsumerSubscribeTopics } from 'kafkajs';
import { getConfig } from '../../config';
import { createComponentLogger } from '../../utils/logger';
import {
  NFTComplianceEvent,
  NFT_COMPLIANCE_TOPICS,
  NFTComplianceTopic,
} from '../../types/events';

const logger = createComponentLogger('event-consumer');

/**
 * Message handler type
 */
export type MessageHandler = (event: NFTComplianceEvent, metadata: MessageMetadata) => Promise<void>;

/**
 * Message metadata
 */
export interface MessageMetadata {
  topic: string;
  partition: number;
  offset: string;
  timestamp: string;
  key: string | null;
  headers: Record<string, string>;
}

/**
 * Event Consumer class
 */
export class EventConsumer {
  private kafka: Kafka | null = null;
  private consumer: Consumer | null = null;
  private isConnected = false;
  private isRunning = false;
  private handlers: Map<string, MessageHandler[]> = new Map();

  /**
   * Initialize Kafka consumer
   */
  async connect(): Promise<void> {
    if (this.consumer) {
      logger.warn('Kafka consumer already initialized');
      return;
    }

    const config = getConfig();

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

    try {
      await this.consumer.connect();
      this.isConnected = true;
      logger.info('Kafka consumer connected', {
        brokers: config.kafka.brokers,
        groupId: config.kafka.groupId,
      });
    } catch (error) {
      logger.error('Failed to connect Kafka consumer', error as Error);
      throw error;
    }
  }

  /**
   * Disconnect Kafka consumer
   */
  async disconnect(): Promise<void> {
    if (this.consumer) {
      this.isRunning = false;
      await this.consumer.disconnect();
      this.consumer = null;
      this.kafka = null;
      this.isConnected = false;
      logger.info('Kafka consumer disconnected');
    }
  }

  /**
   * Check if connected
   */
  isHealthy(): boolean {
    return this.isConnected && this.consumer !== null;
  }

  /**
   * Get consumer instance
   */
  private getConsumer(): Consumer {
    if (!this.consumer) {
      throw new Error('Kafka consumer not initialized. Call connect() first.');
    }
    return this.consumer;
  }

  /**
   * Subscribe to topics
   */
  async subscribe(topics: NFTComplianceTopic[]): Promise<void> {
    const consumer = this.getConsumer();

    const subscribeTopics: ConsumerSubscribeTopics = {
      topics,
      fromBeginning: false,
    };

    await consumer.subscribe(subscribeTopics);
    logger.info('Subscribed to topics', { topics });
  }

  /**
   * Register a message handler for a specific event type
   */
  registerHandler(eventType: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
    logger.debug('Registered handler for event type', { eventType });
  }

  /**
   * Register a handler for all events
   */
  registerGlobalHandler(handler: MessageHandler): void {
    this.registerHandler('*', handler);
  }

  /**
   * Start consuming messages
   */
  async start(): Promise<void> {
    const consumer = this.getConsumer();

    if (this.isRunning) {
      logger.warn('Consumer is already running');
      return;
    }

    this.isRunning = true;

    await consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        await this.handleMessage(payload);
      },
    });

    logger.info('Consumer started');
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;
    const startTime = Date.now();

    try {
      // Parse message value
      if (!message.value) {
        logger.warn('Received message with no value', { topic, partition });
        return;
      }

      const event: NFTComplianceEvent = JSON.parse(message.value.toString());

      // Parse headers
      const headers: Record<string, string> = {};
      if (message.headers) {
        for (const [key, value] of Object.entries(message.headers)) {
          if (value) {
            headers[key] = value.toString();
          }
        }
      }

      const metadata: MessageMetadata = {
        topic,
        partition,
        offset: message.offset,
        timestamp: message.timestamp,
        key: message.key?.toString() || null,
        headers,
      };

      logger.logKafkaEvent('consumed', topic, {
        eventType: event.eventType,
        eventId: event.eventId,
        partition,
        offset: message.offset,
      });

      // Get handlers for this event type
      const eventHandlers = this.handlers.get(event.eventType) || [];
      const globalHandlers = this.handlers.get('*') || [];
      const allHandlers = [...eventHandlers, ...globalHandlers];

      if (allHandlers.length === 0) {
        logger.debug('No handlers registered for event type', {
          eventType: event.eventType,
        });
        return;
      }

      // Execute all handlers
      await Promise.all(
        allHandlers.map(async (handler) => {
          try {
            await handler(event, metadata);
          } catch (handlerError) {
            logger.error('Handler error', {
              eventType: event.eventType,
              eventId: event.eventId,
              error: (handlerError as Error).message,
            });
          }
        })
      );

      const duration = Date.now() - startTime;
      logger.debug('Message processed', {
        topic,
        eventType: event.eventType,
        durationMs: duration,
      });
    } catch (error) {
      logger.error('Failed to process message', {
        topic,
        partition,
        offset: message.offset,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Pause consumption
   */
  async pause(topics: NFTComplianceTopic[]): Promise<void> {
    const consumer = this.getConsumer();
    consumer.pause(topics.map((topic) => ({ topic })));
    logger.info('Paused consumption', { topics });
  }

  /**
   * Resume consumption
   */
  async resume(topics: NFTComplianceTopic[]): Promise<void> {
    const consumer = this.getConsumer();
    consumer.resume(topics.map((topic) => ({ topic })));
    logger.info('Resumed consumption', { topics });
  }

  /**
   * Seek to specific offset
   */
  async seek(topic: NFTComplianceTopic, partition: number, offset: string): Promise<void> {
    const consumer = this.getConsumer();
    consumer.seek({ topic, partition, offset });
    logger.info('Seeked to offset', { topic, partition, offset });
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
export async function resetEventConsumer(): Promise<void> {
  if (eventConsumerInstance) {
    await eventConsumerInstance.disconnect();
    eventConsumerInstance = null;
  }
}

/**
 * Subscribe to NFT marketplace events
 */
export async function subscribeToNFTEvents(consumer: EventConsumer): Promise<void> {
  await consumer.subscribe([
    NFT_COMPLIANCE_TOPICS.NFT_COLLECTIONS,
    NFT_COMPLIANCE_TOPICS.NFT_TOKENS,
    NFT_COMPLIANCE_TOPICS.NFT_SALES,
    NFT_COMPLIANCE_TOPICS.NFT_LISTINGS,
    NFT_COMPLIANCE_TOPICS.NFT_BIDS,
    NFT_COMPLIANCE_TOPICS.NFT_TRANSFERS,
  ]);
}

/**
 * Subscribe to compliance events
 */
export async function subscribeToComplianceEvents(consumer: EventConsumer): Promise<void> {
  await consumer.subscribe([
    NFT_COMPLIANCE_TOPICS.NFT_COMPLIANCE_EVENTS,
    NFT_COMPLIANCE_TOPICS.NFT_WASH_TRADING,
    NFT_COMPLIANCE_TOPICS.NFT_CONTENT_SCREENING,
    NFT_COMPLIANCE_TOPICS.NFT_RISK_ASSESSMENTS,
    NFT_COMPLIANCE_TOPICS.NFT_TRAVEL_RULE,
    NFT_COMPLIANCE_TOPICS.NFT_CARF,
    NFT_COMPLIANCE_TOPICS.NFT_ROYALTIES,
  ]);
}

export default getEventConsumer;
