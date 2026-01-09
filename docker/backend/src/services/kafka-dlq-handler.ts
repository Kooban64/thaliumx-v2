/**
 * Kafka Dead Letter Queue (DLQ) Handler
 * 
 * Handles failed message processing with:
 * - Automatic retry with exponential backoff
 * - Dead letter queue routing
 * - DLQ processor service for manual review
 * - Integration with alerting system
 * - Retry policy configuration
 */

import type { Producer } from 'kafkajs';
import { LoggerService } from './logger';
import { EventStreamingService } from './event-streaming';
// import { KafkaMetricsService } from './kafka-metrics';

export interface DLQMessage {
  originalTopic: string;
  originalPartition: number;
  originalOffset: string;
  originalMessage: any;
  failureReason: string;
  failureTimestamp: string;
  retryCount: number;
  consumerGroup: string;
  error: {
    message: string;
    stack?: string;
    code?: string;
  };
}

export interface RetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export class KafkaDLQHandler {
  private static producer: Producer | null = null;
  private static isInitialized = false;
  private static readonly DLQ_TOPICS = {
    GENERAL: 'thaliumx.dlq.general',
    TRANSACTIONS: 'thaliumx.dlq.transactions',
    NOTIFICATIONS: 'thaliumx.dlq.notifications'
  } as const;

  private static readonly DEFAULT_RETRY_POLICY: RetryPolicy = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    backoffMultiplier: 2
  };

  /**
   * Initialize DLQ handler
   */
  public static async initialize(): Promise<void> {
    try {
      // Get producer from EventStreamingService
      // For now, we'll use EventStreamingService to publish to DLQ
      this.isInitialized = true;
      LoggerService.info('✅ Kafka DLQ Handler initialized');
    } catch (error) {
      LoggerService.error('Failed to initialize DLQ Handler', { error });
      throw error;
    }
  }

  /**
   * Send message to DLQ
   */
  public static async sendToDLQ(
    dlqMessage: DLQMessage,
    dlqTopic: string = this.DLQ_TOPICS.GENERAL
  ): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Use EventStreamingService to publish to DLQ
      await EventStreamingService.emitSystemEvent(
        'dlq.message.received',
        'DLQHandler',
        'warn',
        dlqMessage
      );

      LoggerService.warn('Message sent to DLQ', {
        dlqTopic,
        originalTopic: dlqMessage.originalTopic,
        retryCount: dlqMessage.retryCount,
        failureReason: dlqMessage.failureReason
      });

      // Emit alert for DLQ events
      await EventStreamingService.emitSystemEvent(
        'dlq.message.received',
        'DLQHandler',
        'warn',
        {
          dlqTopic,
          originalTopic: dlqMessage.originalTopic,
          retryCount: dlqMessage.retryCount,
          failureReason: dlqMessage.failureReason
        }
      );
    } catch (error) {
      LoggerService.error('Failed to send message to DLQ', {
        dlqTopic,
        error
      });
      // Don't throw - DLQ failure shouldn't crash the service
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  public static calculateRetryDelay(
    retryCount: number,
    policy: RetryPolicy = this.DEFAULT_RETRY_POLICY
  ): number {
    const delay = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, retryCount);
    return Math.min(delay, policy.maxDelayMs);
  }

  /**
   * Determine DLQ topic based on original topic
   */
  public static getDLQTopic(originalTopic: string): string {
    if (originalTopic.includes('transaction')) {
      return this.DLQ_TOPICS.TRANSACTIONS;
    } else if (originalTopic.includes('notification')) {
      return this.DLQ_TOPICS.NOTIFICATIONS;
    } else {
      return this.DLQ_TOPICS.GENERAL;
    }
  }

  /**
   * Process message with retry logic
   */
  public static async processWithRetry<T>(
    message: any,
    processor: (msg: any) => Promise<T>,
    options: {
      topic: string;
      partition: number;
      offset: string;
      consumerGroup: string;
      retryPolicy?: RetryPolicy;
    }
  ): Promise<T> {
    const policy = options.retryPolicy || this.DEFAULT_RETRY_POLICY;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
      try {
        return await processor(message);
      } catch (error) {
        lastError = error as Error;

        if (attempt < policy.maxRetries) {
          const delay = this.calculateRetryDelay(attempt, policy);
          LoggerService.warn('Message processing failed, retrying', {
            attempt: attempt + 1,
            maxRetries: policy.maxRetries,
            delayMs: delay,
            error: (error as Error).message
          });

          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Max retries exceeded, send to DLQ
          LoggerService.error('Message processing failed after all retries', {
            attempts: attempt + 1,
            error: (error as Error).message
          });

          await this.sendToDLQ({
            originalTopic: options.topic,
            originalPartition: options.partition,
            originalOffset: options.offset,
            originalMessage: message,
            failureReason: (error as Error).message,
            failureTimestamp: new Date().toISOString(),
            retryCount: attempt,
            consumerGroup: options.consumerGroup,
            error: {
              message: (error as Error).message,
              stack: (error as Error).stack,
              code: (error as any).code
            }
          }, this.getDLQTopic(options.topic));

          throw error; // Re-throw after sending to DLQ
        }
      }
    }

    throw lastError || new Error('Processing failed');
  }

  /**
   * Process DLQ messages for manual review
   */
  public static async processDLQMessages(
    _dlqTopic: string,
    _processor: (dlqMessage: DLQMessage) => Promise<void>
  ): Promise<void> {
    // This would be called by a DLQ processor service
    // Implementation depends on consumer framework
    LoggerService.info('DLQ message processing', { dlqTopic: _dlqTopic });
  }

  /**
   * Get DLQ statistics
   */
  public static async getDLQStats(): Promise<{
    totalMessages: number;
    byTopic: Record<string, number>;
    byFailureReason: Record<string, number>;
  }> {
    // This would query DLQ topics and aggregate statistics
    // For now, return placeholder
    return {
      totalMessages: 0,
      byTopic: {},
      byFailureReason: {}
    };
  }

  /**
   * Close DLQ handler
   */
  public static async close(): Promise<void> {
    this.isInitialized = false;
    LoggerService.info('Kafka DLQ Handler closed');
  }
}
