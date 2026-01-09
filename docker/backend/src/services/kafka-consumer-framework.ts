/**
 * Kafka Consumer Framework
 * 
 * Reusable consumer base class with:
 * - Automatic offset management
 * - Consumer group coordination
 * - Graceful shutdown handling
 * - Circuit breaker pattern
 * - Error handling and DLQ routing
 * - Metrics and monitoring
 */

import type { Consumer, EachMessagePayload, ConsumerConfig } from 'kafkajs';
import { Kafka } from 'kafkajs';
import { LoggerService } from './logger';
import { ConfigService } from './config';
import { KafkaDLQHandler } from './kafka-dlq-handler';
import { KafkaMetricsService } from './kafka-metrics';

export interface ConsumerOptions {
  groupId: string;
  topics: string[];
  fromBeginning?: boolean;
  maxPollRecords?: number;
  sessionTimeout?: number;
  heartbeatInterval?: number;
  enableAutoCommit?: boolean;
  retryPolicy?: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
}

export interface MessageContext {
  topic: string;
  partition: number;
  offset: string;
  timestamp: string;
  headers: Record<string, string>;
}

export abstract class BaseKafkaConsumer {
  protected consumer: Consumer | null = null;
  protected kafka: Kafka;
  protected options: ConsumerOptions;
  protected isRunning = false;
  protected isShuttingDown = false;
  protected circuitBreakerState: 'closed' | 'open' | 'half-open' = 'closed';
  protected failureCount = 0;
  protected readonly circuitBreakerThreshold = 5;
  protected readonly circuitBreakerResetTimeout = 60000; // 1 minute

  constructor(options: ConsumerOptions) {
    const config = ConfigService.getConfig();
    
    const kafkaConfig: any = {
      clientId: `thaliumx-consumer-${options.groupId}`,
      brokers: config.kafka?.brokers || ['kafka-1:9094', 'kafka-2:9094', 'kafka-3:9094'],
      retry: {
        initialRetryTime: 100,
        retries: 8
      },
      connectionTimeout: 3000,
      requestTimeout: 25000
    };

    // SSL configuration
    if (config.kafka?.ssl) {
      const fs = require('fs');
      kafkaConfig.ssl = {
        rejectUnauthorized: true,
        ca: config.kafka.sslCaPath && fs.existsSync(config.kafka.sslCaPath) ? fs.readFileSync(config.kafka.sslCaPath) : undefined,
        cert: config.kafka.sslCertPath && fs.existsSync(config.kafka.sslCertPath) ? fs.readFileSync(config.kafka.sslCertPath) : undefined,
        key: config.kafka.sslKeyPath && fs.existsSync(config.kafka.sslKeyPath) ? fs.readFileSync(config.kafka.sslKeyPath) : undefined
      };
    }

    this.kafka = new Kafka(kafkaConfig);
    this.options = {
      fromBeginning: false,
      maxPollRecords: 100,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
      enableAutoCommit: false,
      ...options
    };
  }

  /**
   * Initialize and start consumer
   */
  public async start(): Promise<void> {
    try {
      if (this.isRunning) {
        LoggerService.warn('Consumer already running', { groupId: this.options.groupId });
        return;
      }

      const consumerConfig: ConsumerConfig = {
        groupId: this.options.groupId,
        sessionTimeout: this.options.sessionTimeout || 30000,
        heartbeatInterval: this.options.heartbeatInterval || 3000,
        maxBytesPerPartition: 2097152, // 2MB per partition (optimized for throughput)
        maxBytes: 52428800, // 50MB total (optimized for batch processing)
        maxWaitTimeInMs: 100, // Lower wait time for lower latency
        minBytes: 1024, // 1KB minimum for better batching
        maxInFlightRequests: 1,
        retry: {
          initialRetryTime: 100,
          retries: 8
        },
        // Offset commit optimization
        allowAutoTopicCreation: false, // Topics should be pre-created
        // Performance tuning
        readUncommitted: false // Only read committed messages
      };

      this.consumer = this.kafka.consumer(consumerConfig);
      await this.consumer.connect();

      await this.consumer.subscribe({
        topics: this.options.topics,
        fromBeginning: this.options.fromBeginning || false
      });

      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          await this.handleMessage(payload);
        },
        eachBatch: async ({ batch, resolveOffset, heartbeat }) => {
          // Batch processing can be implemented by subclasses
          for (const message of batch.messages) {
            await this.handleMessage({
              topic: batch.topic,
              partition: batch.partition,
              message
            } as EachMessagePayload);
            resolveOffset(message.offset);
            await heartbeat();
          }
        }
      });

      this.isRunning = true;
      LoggerService.info('Consumer started', {
        groupId: this.options.groupId,
        topics: this.options.topics
      });

      // Setup graceful shutdown
      this.setupGracefulShutdown();
    } catch (error) {
      LoggerService.error('Failed to start consumer', {
        groupId: this.options.groupId,
        error
      });
      throw error;
    }
  }

  /**
   * Handle incoming message (to be implemented by subclasses)
   */
  protected abstract handleMessage(payload: EachMessagePayload): Promise<void>;

  /**
   * Process message with error handling and retry logic
   */
  protected async processMessage(
    payload: EachMessagePayload,
    processor: (message: any, context: MessageContext) => Promise<void>
  ): Promise<void> {
    const startTime = Date.now();
    let message: any;

    try {
      // Parse message
      if (!payload.message.value) {
        LoggerService.warn('Message has no value', {
          topic: payload.topic,
          partition: payload.partition
        });
        return;
      }

      message = JSON.parse(payload.message.value.toString());

      // Build context
      const context: MessageContext = {
        topic: payload.topic,
        partition: payload.partition,
        offset: payload.message.offset,
        timestamp: payload.message.timestamp || new Date().toISOString(),
        headers: this.parseHeaders(payload.message.headers)
      };

      // Check circuit breaker
      if (this.circuitBreakerState === 'open') {
        throw new Error('Circuit breaker is open - too many failures');
      }

      // Process message
      await processor(message, context);

      // Reset circuit breaker on success
      if (this.circuitBreakerState === 'half-open') {
        this.circuitBreakerState = 'closed';
        this.failureCount = 0;
        LoggerService.info('Circuit breaker closed after successful message processing');
      }

      const duration = Date.now() - startTime;
      LoggerService.debug('Message processed successfully', {
        topic: payload.topic,
        partition: payload.partition,
        offset: payload.message.offset,
        durationMs: duration
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.failureCount++;

      LoggerService.error('Message processing failed', {
        topic: payload.topic,
        partition: payload.partition,
        offset: payload.message.offset,
        durationMs: duration,
        error: (error as Error).message,
        failureCount: this.failureCount
      });

      // Check circuit breaker threshold
      if (this.failureCount >= this.circuitBreakerThreshold) {
        this.circuitBreakerState = 'open';
        LoggerService.warn('Circuit breaker opened due to repeated failures', {
          failureCount: this.failureCount,
          threshold: this.circuitBreakerThreshold
        });

        // Schedule reset
        setTimeout(() => {
          this.circuitBreakerState = 'half-open';
          LoggerService.info('Circuit breaker moved to half-open state');
        }, this.circuitBreakerResetTimeout);
      }

      // Send to DLQ with retry logic
      await KafkaDLQHandler.processWithRetry(
        message,
        async (_msg) => {
          // This would be the processor that failed
          throw error;
        },
        {
          topic: payload.topic,
          partition: payload.partition,
          offset: payload.message.offset,
          consumerGroup: this.options.groupId,
          retryPolicy: this.options.retryPolicy
        }
      );
    }
  }

  /**
   * Parse message headers
   */
  private parseHeaders(headers: any): Record<string, string> {
    const parsed: Record<string, string> = {};
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        if (value) {
          if (Buffer.isBuffer(value)) {
            parsed[key] = value.toString();
          } else if (typeof value === 'string') {
            parsed[key] = value;
          } else if (Array.isArray(value)) {
            parsed[key] = value.map(v => Buffer.isBuffer(v) ? v.toString() : String(v)).join(',');
          }
        }
      }
    }
    return parsed;
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      LoggerService.info(`Received ${signal}, shutting down consumer gracefully`, {
        groupId: this.options.groupId
      });

      try {
        if (this.consumer) {
          await this.consumer.disconnect();
        }
        LoggerService.info('Consumer disconnected gracefully');
      } catch (error) {
        LoggerService.error('Error during consumer shutdown', { error });
      }
    };

    process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
    process.on('SIGINT', () => { void shutdown('SIGINT'); });
  }

  /**
   * Stop consumer
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isShuttingDown = true;
    this.isRunning = false;

    try {
      if (this.consumer) {
        await this.consumer.disconnect();
      }
      LoggerService.info('Consumer stopped', { groupId: this.options.groupId });
    } catch (error) {
      LoggerService.error('Error stopping consumer', { error });
      throw error;
    }
  }

  /**
   * Get consumer lag
   */
  public async getLag(): Promise<number> {
    try {
      const lagMetrics = await KafkaMetricsService.getConsumerLag(this.options.groupId);
      return lagMetrics.reduce((sum, metric) => sum + metric.lag, 0);
    } catch (error) {
      LoggerService.error('Failed to get consumer lag', { error });
      return 0;
    }
  }

  /**
   * Check if consumer is healthy
   */
  public isHealthy(): boolean {
    return this.isRunning && !this.isShuttingDown && this.circuitBreakerState !== 'open';
  }
}
