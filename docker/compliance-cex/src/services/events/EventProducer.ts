/**
 * Event Producer for CEX Compliance Service
 * Kafka-based event publishing for compliance events
 */

import { Kafka, Producer, ProducerRecord, RecordMetadata, CompressionTypes } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { BaseEvent, ComplianceEvent, EventProducerConfig } from '../../types/events';

// ==================== EVENT PRODUCER ====================

/**
 * Kafka Event Producer - Publishes compliance events
 */
export class EventProducer {
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private isConnected = false;
  private connectionAttempts = 0;
  private readonly maxConnectionAttempts = 5;
  private readonly connectionRetryDelayMs = 5000;

  /**
   * Default producer configuration
   */
  private readonly defaultConfig: EventProducerConfig = {
    topic: 'compliance.events',
    compression: 'gzip',
    acks: -1, // Wait for all replicas
    retries: 3,
    batchSize: 16384,
    lingerMs: 5,
  };

  /**
   * Initialize Kafka producer
   */
  async initialize(): Promise<void> {
    if (this.producer) {
      logger.warn('Event producer already initialized');
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
        connectionTimeout: 10000,
        requestTimeout: 30000,
      });

      this.producer = this.kafka.producer({
        allowAutoTopicCreation: true,
        transactionTimeout: 30000,
        idempotent: true,
      });

      // Set up event handlers
      this.producer.on('producer.connect', () => {
        logger.info('Kafka producer connected');
        this.isConnected = true;
      });

      this.producer.on('producer.disconnect', () => {
        logger.warn('Kafka producer disconnected');
        this.isConnected = false;
      });

      this.producer.on('producer.network.request_timeout', (payload) => {
        logger.error('Kafka producer request timeout', { payload });
      });

      // Connect producer
      await this.producer.connect();
      this.connectionAttempts = 0;

      logger.info('Event producer initialized successfully', {
        brokers: config.kafka.brokers,
        clientId: config.kafka.clientId,
      });
    } catch (error) {
      this.connectionAttempts++;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Failed to initialize event producer', {
        error: errorMessage,
        attempt: this.connectionAttempts,
        maxAttempts: this.maxConnectionAttempts,
      });

      if (this.connectionAttempts < this.maxConnectionAttempts) {
        logger.info(`Retrying Kafka connection in ${this.connectionRetryDelayMs}ms...`);
        await this.delay(this.connectionRetryDelayMs);
        return this.initialize();
      }

      throw new Error(`Failed to connect to Kafka after ${this.maxConnectionAttempts} attempts: ${errorMessage}`);
    }
  }

  /**
   * Publish a single event
   */
  async publish<T extends BaseEvent>(
    event: T,
    topic?: string
  ): Promise<RecordMetadata[]> {
    if (!this.producer || !this.isConnected) {
      throw new Error('Event producer not connected');
    }

    const targetTopic = topic ?? this.defaultConfig.topic;
    const eventWithMetadata = this.enrichEvent(event);

    const record: ProducerRecord = {
      topic: targetTopic,
      messages: [
        {
          key: event.correlationId,
          value: JSON.stringify(eventWithMetadata),
          headers: {
            'event-type': event.type,
            'event-source': event.source,
            'event-version': event.version,
            'correlation-id': event.correlationId,
            'tenant-id': event.tenantId,
            'timestamp': event.timestamp.toISOString(),
          },
        },
      ],
      compression: CompressionTypes.GZIP,
      acks: this.defaultConfig.acks,
    };

    try {
      const result = await this.producer.send(record);
      
      logger.debug('Event published', {
        topic: targetTopic,
        type: event.type,
        correlationId: event.correlationId,
        partition: result[0]?.partition,
        offset: result[0]?.offset,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to publish event', {
        topic: targetTopic,
        type: event.type,
        correlationId: event.correlationId,
        error: errorMessage,
      });
      throw error;
    }
  }

  /**
   * Publish multiple events in a batch
   */
  async publishBatch<T extends BaseEvent>(
    events: T[],
    topic?: string
  ): Promise<RecordMetadata[]> {
    if (!this.producer || !this.isConnected) {
      throw new Error('Event producer not connected');
    }

    if (events.length === 0) {
      return [];
    }

    const targetTopic = topic ?? this.defaultConfig.topic;
    const messages = events.map((event) => {
      const eventWithMetadata = this.enrichEvent(event);
      return {
        key: event.correlationId,
        value: JSON.stringify(eventWithMetadata),
        headers: {
          'event-type': event.type,
          'event-source': event.source,
          'event-version': event.version,
          'correlation-id': event.correlationId,
          'tenant-id': event.tenantId,
          'timestamp': event.timestamp.toISOString(),
        },
      };
    });

    const record: ProducerRecord = {
      topic: targetTopic,
      messages,
      compression: CompressionTypes.GZIP,
      acks: this.defaultConfig.acks,
    };

    try {
      const result = await this.producer.send(record);
      
      logger.debug('Batch events published', {
        topic: targetTopic,
        count: events.length,
        partition: result[0]?.partition,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to publish batch events', {
        topic: targetTopic,
        count: events.length,
        error: errorMessage,
      });
      throw error;
    }
  }

  /**
   * Publish to multiple topics
   */
  async publishToTopics<T extends BaseEvent>(
    event: T,
    topics: string[]
  ): Promise<RecordMetadata[][]> {
    const results: RecordMetadata[][] = [];
    for (const topic of topics) {
      const result = await this.publish(event, topic);
      results.push(result);
    }
    return results;
  }

  /**
   * Create a compliance event
   */
  createEvent<T extends ComplianceEvent>(
    type: T['type'],
    source: T['source'],
    tenantId: string,
    data: T['data'],
    correlationId?: string,
    causationId?: string
  ): T {
    return {
      id: uuidv4(),
      type,
      source,
      version: '1.0',
      timestamp: new Date(),
      correlationId: correlationId ?? uuidv4(),
      causationId,
      tenantId,
      metadata: {},
      data,
    } as T;
  }

  /**
   * Enrich event with additional metadata
   */
  private enrichEvent<T extends BaseEvent>(event: T): T {
    return {
      ...event,
      metadata: {
        ...event.metadata,
        publishedAt: new Date().toISOString(),
        producer: config.serviceName,
        environment: config.environment,
      },
    };
  }

  /**
   * Check if producer is healthy
   */
  isHealthy(): boolean {
    return this.isConnected && this.producer !== null;
  }

  /**
   * Get producer metrics
   */
  async getMetrics(): Promise<{
    connected: boolean;
    pendingMessages: number;
  }> {
    return {
      connected: this.isConnected,
      pendingMessages: 0, // KafkaJS doesn't expose this directly
    };
  }

  /**
   * Shutdown producer
   */
  async shutdown(): Promise<void> {
    if (!this.producer) {
      logger.warn('Event producer not initialized, nothing to shutdown');
      return;
    }

    try {
      await this.producer.disconnect();
      this.producer = null;
      this.kafka = null;
      this.isConnected = false;
      logger.info('Event producer shutdown complete');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error shutting down event producer', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Helper method for delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ==================== SINGLETON INSTANCE ====================

/**
 * Singleton event producer instance
 */
export const eventProducer = new EventProducer();
