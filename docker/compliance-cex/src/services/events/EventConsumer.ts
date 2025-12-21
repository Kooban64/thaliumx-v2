/**
 * Event Consumer for CEX Compliance Service
 * Kafka-based event consumption for compliance processing
 */

import { Kafka, Consumer, EachMessagePayload, KafkaMessage } from 'kafkajs';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import {
  BaseEvent,
  ComplianceEvent,
  EventHandler,
  EventHandlerRegistry,
  EventProcessingContext,
  EventConsumerConfig,
  EventMetrics,
} from '../../types/events';

// ==================== EVENT CONSUMER ====================

/**
 * Kafka Event Consumer - Consumes and processes compliance events
 */
export class EventConsumer {
  private kafka: Kafka | null = null;
  private consumer: Consumer | null = null;
  private isConnected = false;
  private isRunning = false;
  private connectionAttempts = 0;
  private readonly maxConnectionAttempts = 5;
  private readonly connectionRetryDelayMs = 5000;

  /**
   * Event handler registry
   */
  private handlers: EventHandlerRegistry = {};

  /**
   * Processing metrics
   */
  private metrics: EventMetrics = {
    eventsProcessed: 0,
    eventsFailed: 0,
    eventsRetried: 0,
    eventsDeadLettered: 0,
    processingLatency: { p50: 0, p95: 0, p99: 0 },
    throughput: { eventsPerSecond: 0, bytesPerSecond: 0 },
    consumerLag: {},
    circuitBreakerState: 'closed',
  };

  /**
   * Default consumer configuration
   */
  private readonly defaultConfig: EventConsumerConfig = {
    groupId: config.kafka.groupId,
    topics: [
      'cex.transactions',
      'cex.users',
      'cex.wallets',
      'compliance.events',
    ],
    fromBeginning: false,
    autoCommit: false,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
    maxPollRecords: 100,
    maxPollInterval: 300000,
  };

  /**
   * Initialize Kafka consumer
   */
  async initialize(): Promise<void> {
    if (this.consumer) {
      logger.warn('Event consumer already initialized');
      return;
    }

    try {
      const kafkaConfig: any = {
        clientId: `${config.kafka.clientId}-consumer`,
        brokers: config.kafka.brokers,
        retry: {
          initialRetryTime: 100,
          retries: 8,
        },
        connectionTimeout: 10000,
        requestTimeout: 30000,
      };

      // Add SSL configuration if enabled
      if (config.kafka.ssl) {
        kafkaConfig.ssl = true;
      }

      // Add SASL configuration if enabled
      if (config.kafka.saslMechanism && config.kafka.saslUsername && config.kafka.saslPassword) {
        kafkaConfig.sasl = {
          mechanism: config.kafka.saslMechanism,
          username: config.kafka.saslUsername,
          password: config.kafka.saslPassword,
        };
      }

      this.kafka = new Kafka(kafkaConfig);

      this.consumer = this.kafka.consumer({
        groupId: this.defaultConfig.groupId,
        sessionTimeout: this.defaultConfig.sessionTimeout,
        heartbeatInterval: this.defaultConfig.heartbeatInterval,
        maxBytesPerPartition: 1048576, // 1MB
        minBytes: 1,
        maxBytes: 10485760, // 10MB
        maxWaitTimeInMs: 5000,
      });

      // Set up event handlers
      this.consumer.on('consumer.connect', () => {
        logger.info('Kafka consumer connected');
        this.isConnected = true;
      });

      this.consumer.on('consumer.disconnect', () => {
        logger.warn('Kafka consumer disconnected');
        this.isConnected = false;
      });

      this.consumer.on('consumer.crash', (event) => {
        logger.error('Kafka consumer crashed', { error: event.payload.error });
        this.isConnected = false;
      });

      this.consumer.on('consumer.group_join', (event) => {
        logger.info('Consumer joined group', {
          groupId: event.payload.groupId,
          memberId: event.payload.memberId,
        });
      });

      this.consumer.on('consumer.rebalancing', () => {
        logger.info('Consumer group rebalancing');
      });

      // Connect consumer
      await this.consumer.connect();
      this.connectionAttempts = 0;

      logger.info('Event consumer initialized successfully', {
        brokers: config.kafka.brokers,
        groupId: this.defaultConfig.groupId,
      });
    } catch (error) {
      this.connectionAttempts++;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Failed to initialize event consumer', {
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
   * Register an event handler
   */
  registerHandler<T extends BaseEvent>(eventType: string, handler: EventHandler<T>): void {
    if (!this.handlers[eventType]) {
      this.handlers[eventType] = [];
    }
    this.handlers[eventType].push(handler as EventHandler);
    logger.debug('Event handler registered', { eventType });
  }

  /**
   * Unregister an event handler
   */
  unregisterHandler(eventType: string, handler: EventHandler): void {
    if (this.handlers[eventType]) {
      this.handlers[eventType] = this.handlers[eventType].filter((h) => h !== handler);
      logger.debug('Event handler unregistered', { eventType });
    }
  }

  /**
   * Subscribe to topics and start consuming
   */
  async start(topics?: string[]): Promise<void> {
    if (!this.consumer || !this.isConnected) {
      throw new Error('Event consumer not connected');
    }

    if (this.isRunning) {
      logger.warn('Event consumer already running');
      return;
    }

    const subscribeTopics = topics ?? this.defaultConfig.topics;

    try {
      // Subscribe to topics
      await this.consumer.subscribe({
        topics: subscribeTopics,
        fromBeginning: this.defaultConfig.fromBeginning,
      });

      logger.info('Subscribed to topics', { topics: subscribeTopics });

      // Start consuming
      this.isRunning = true;
      await this.consumer.run({
        autoCommit: this.defaultConfig.autoCommit,
        eachMessage: async (payload) => {
          await this.processMessage(payload);
        },
      });

      logger.info('Event consumer started');
    } catch (error) {
      this.isRunning = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to start event consumer', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;
    const startTime = Date.now();

    try {
      const event = this.parseMessage(message);
      if (!event) {
        logger.warn('Failed to parse message', { topic, partition, offset: message.offset });
        await this.commitOffset(payload);
        return;
      }

      const context: EventProcessingContext = {
        event,
        correlationId: event.correlationId,
        startTime: new Date(startTime),
        attempts: 1,
        maxAttempts: 3,
      };

      // Get handlers for this event type
      const handlers = this.handlers[event.type] ?? [];
      if (handlers.length === 0) {
        logger.debug('No handlers registered for event type', { type: event.type });
        await this.commitOffset(payload);
        return;
      }

      // Execute all handlers
      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (handlerError) {
          const errorMessage = handlerError instanceof Error ? handlerError.message : String(handlerError);
          logger.error('Event handler failed', {
            type: event.type,
            correlationId: event.correlationId,
            error: errorMessage,
          });
          context.lastError = handlerError instanceof Error ? handlerError : new Error(String(handlerError));
          this.metrics.eventsFailed++;
        }
      }

      // Commit offset after successful processing
      await this.commitOffset(payload);
      this.metrics.eventsProcessed++;

      const duration = Date.now() - startTime;
      this.updateLatencyMetrics(duration);

      logger.debug('Event processed', {
        type: event.type,
        correlationId: event.correlationId,
        duration,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to process message', {
        topic,
        partition,
        offset: message.offset,
        error: errorMessage,
      });
      this.metrics.eventsFailed++;

      // Still commit to avoid blocking
      await this.commitOffset(payload);
    }
  }

  /**
   * Parse Kafka message to event
   */
  private parseMessage(message: KafkaMessage): ComplianceEvent | null {
    try {
      if (!message.value) {
        return null;
      }

      const eventData = JSON.parse(message.value.toString()) as ComplianceEvent;

      // Validate required fields
      if (!eventData.id || !eventData.type || !eventData.source) {
        logger.warn('Invalid event structure', { eventData });
        return null;
      }

      // Convert timestamp string to Date
      if (typeof eventData.timestamp === 'string') {
        eventData.timestamp = new Date(eventData.timestamp);
      }

      return eventData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to parse message', { error: errorMessage });
      return null;
    }
  }

  /**
   * Commit offset for a message
   */
  private async commitOffset(payload: EachMessagePayload): Promise<void> {
    if (!this.consumer) return;

    try {
      await this.consumer.commitOffsets([
        {
          topic: payload.topic,
          partition: payload.partition,
          offset: (parseInt(payload.message.offset, 10) + 1).toString(),
        },
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to commit offset', { error: errorMessage });
    }
  }

  /**
   * Update latency metrics
   */
  private updateLatencyMetrics(duration: number): void {
    // Simple moving average for now
    // In production, use a proper percentile calculation
    this.metrics.processingLatency.p50 = 
      (this.metrics.processingLatency.p50 * 0.9) + (duration * 0.1);
    this.metrics.processingLatency.p95 = 
      Math.max(this.metrics.processingLatency.p95, duration);
    this.metrics.processingLatency.p99 = 
      Math.max(this.metrics.processingLatency.p99, duration);
  }

  /**
   * Pause consumption
   */
  async pause(topics?: string[]): Promise<void> {
    if (!this.consumer) return;

    const pauseTopics = topics ?? this.defaultConfig.topics;
    const topicPartitions = pauseTopics.map((topic) => ({ topic }));
    
    this.consumer.pause(topicPartitions);
    logger.info('Consumer paused', { topics: pauseTopics });
  }

  /**
   * Resume consumption
   */
  async resume(topics?: string[]): Promise<void> {
    if (!this.consumer) return;

    const resumeTopics = topics ?? this.defaultConfig.topics;
    const topicPartitions = resumeTopics.map((topic) => ({ topic }));
    
    this.consumer.resume(topicPartitions);
    logger.info('Consumer resumed', { topics: resumeTopics });
  }

  /**
   * Check if consumer is healthy
   */
  isHealthy(): boolean {
    return this.isConnected && this.isRunning && this.consumer !== null;
  }

  /**
   * Get consumer metrics
   */
  getMetrics(): EventMetrics {
    return { ...this.metrics };
  }

  /**
   * Get subscribed topics
   */
  getSubscribedTopics(): string[] {
    return [...this.defaultConfig.topics];
  }

  /**
   * Shutdown consumer
   */
  async shutdown(): Promise<void> {
    if (!this.consumer) {
      logger.warn('Event consumer not initialized, nothing to shutdown');
      return;
    }

    try {
      this.isRunning = false;
      await this.consumer.disconnect();
      this.consumer = null;
      this.kafka = null;
      this.isConnected = false;
      logger.info('Event consumer shutdown complete');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error shutting down event consumer', { error: errorMessage });
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
 * Singleton event consumer instance
 */
export const eventConsumer = new EventConsumer();
