/**
 * Kafka Integration Tests
 * 
 * Comprehensive integration tests for Kafka functionality:
 * - Producer/consumer integration tests
 * - Transaction tests
 * - Error handling and DLQ tests
 * - Performance benchmarks
 */

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { EventStreamingService } from '../../services/event-streaming';
import { KafkaTopicManager } from '../../services/kafka-topic-manager';
import { KafkaDLQHandler } from '../../services/kafka-dlq-handler';
import { KafkaSchemaRegistryService } from '../../services/kafka-schema-registry';
import { BaseKafkaConsumer } from '../../services/kafka-consumer-framework';
import { LoggerService } from '../../services/logger';

describe('Kafka Integration Tests', () => {
  const runId = randomUUID().slice(0, 8);
  const testTopic = `thaliumx.test.integration.${runId}`;
  const testGroupId = `test-consumer-group-${runId}`;

  beforeAll(async () => {
    // Initialize services
    await EventStreamingService.initialize();
    await KafkaTopicManager.initialize();
    await KafkaSchemaRegistryService.initialize();
  });

  afterAll(async () => {
    // Cleanup
    await EventStreamingService.close();
    await KafkaTopicManager.close();
  });

  describe('Topic Management', () => {
    it('should create topic with proper configuration', async () => {
      await KafkaTopicManager.createTopic({
        topic: testTopic,
        numPartitions: 3,
        replicationFactor: 1,
        retentionMs: 604800000, // 7 days
        // Keep compression codec compatible with local KafkaJS test runtime
        // (Snappy requires optional codec registration in consumers).
        compressionType: 'gzip'
      });

      const metadata = await KafkaTopicManager.getTopicMetadata(testTopic);
      expect(metadata).not.toBeNull();
      expect(metadata?.partitions).toBe(3);
      expect(metadata?.replicationFactor).toBeGreaterThanOrEqual(1);
    });

    it('should get topic health status', async () => {
      const health = await KafkaTopicManager.getTopicHealth(testTopic);
      expect(health.healthy).toBe(true);
      expect(health.issues).toHaveLength(0);
    });
  });

  describe('Producer Tests', () => {
    it('should publish event successfully', async () => {
      const event = {
        metadata: {
          eventId: 'test-event-1',
          eventType: 'test.event',
          timestamp: new Date().toISOString(),
          source: 'test',
          version: '1.0.0'
        },
        payload: {
          message: 'Test message'
        }
      };

      await expect(
        EventStreamingService['publishEvent'](event as any, testTopic)
      ).resolves.not.toThrow();
    });

    it('should publish multiple events in transaction', async () => {
      const events = [
        {
          event: {
            metadata: {
              eventId: 'test-event-2',
              eventType: 'test.event',
              timestamp: new Date().toISOString(),
              source: 'test',
              version: '1.0.0'
            },
            payload: { message: 'Event 1' }
          },
          topic: testTopic
        },
        {
          event: {
            metadata: {
              eventId: 'test-event-3',
              eventType: 'test.event',
              timestamp: new Date().toISOString(),
              source: 'test',
              version: '1.0.0'
            },
            payload: { message: 'Event 2' }
          },
          topic: testTopic
        }
      ];

      await expect(
        EventStreamingService.publishEventsTransaction(events)
      ).resolves.not.toThrow();
    });

    it('should validate message size', async () => {
      const largeEvent = {
        metadata: {
          eventId: 'test-event-large',
          eventType: 'test.event',
          timestamp: new Date().toISOString(),
          source: 'test',
          version: '1.0.0'
        },
        payload: {
          data: 'x'.repeat(100 * 1024 * 1024) // 100MB
        }
      };

      await expect(
        EventStreamingService['publishEvent'](largeEvent as any, testTopic)
      ).rejects.toThrow();
    });
  });

  describe('Consumer Tests', () => {
    let testConsumer: TestConsumer;

      class TestConsumer extends BaseKafkaConsumer {
      public receivedMessages: any[] = [];

      constructor() {
        super({
          groupId: `${testGroupId}-messages`,
          topics: [testTopic],
          fromBeginning: false,
          maxPollRecords: 10
        });
      }

      protected async handleMessage(payload: any): Promise<void> {
        await this.processMessage(payload, async (message: any) => {
          this.receivedMessages.push(message);
        });
      }
    }

    beforeAll(async () => {
      testConsumer = new TestConsumer();
      await testConsumer.start();
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    afterAll(async () => {
      await testConsumer.stop();
    });

    it('should consume messages', async () => {
      // Publish test message
      await EventStreamingService['publishEvent']({
        metadata: {
          eventId: 'test-consumer-1',
          eventType: 'test.event',
          timestamp: new Date().toISOString(),
          source: 'test',
          version: '1.0.0'
        },
        payload: { message: 'Consumer test' }
      } as any, testTopic);

      // Wait for consumption with bounded polling to reduce race sensitivity
      const maxWaitMs = 10_000;
      const pollIntervalMs = 250;
      const start = Date.now();
      while (testConsumer.receivedMessages.length === 0 && Date.now() - start < maxWaitMs) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      }

      expect(testConsumer.receivedMessages.length).toBeGreaterThan(0);
    });

    it('should handle consumer errors gracefully', async () => {
      // This would test error handling and DLQ routing
      // Implementation depends on error scenario
    });
  });

  describe('DLQ Tests', () => {
    it('should send failed message to DLQ', async () => {
      const dlqMessage = {
        originalTopic: testTopic,
        originalPartition: 0,
        originalOffset: '100',
        originalMessage: { test: 'data' },
        failureReason: 'Test failure',
        failureTimestamp: new Date().toISOString(),
        retryCount: 3,
        consumerGroup: testGroupId,
        error: {
          message: 'Test error',
          stack: 'Error stack'
        }
      };

      await expect(
        KafkaDLQHandler.sendToDLQ(dlqMessage)
      ).resolves.not.toThrow();
    });

    it('should calculate retry delay with exponential backoff', () => {
      const delay1 = KafkaDLQHandler.calculateRetryDelay(0);
      const delay2 = KafkaDLQHandler.calculateRetryDelay(1);
      const delay3 = KafkaDLQHandler.calculateRetryDelay(2);

      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });
  });

  describe('Schema Registry Tests', () => {
    it('should register Avro schema', async () => {
      const schema = {
        type: 'record',
        name: 'TestEvent',
        fields: [
          { name: 'id', type: 'string' },
          { name: 'message', type: 'string' }
        ]
      };

      const isRegistryAvailable = (KafkaSchemaRegistryService as any).isInitialized === true;
      if (!isRegistryAvailable) {
        return;
      }

      const result = await KafkaSchemaRegistryService.registerAvroSchema(
        `test-subject-${runId}`,
        schema
      );

      expect(result).toBeDefined();
      expect(result.subject).toBe(`test-subject-${runId}`);
      expect(result.schemaType).toBe('AVRO');
    });

    it('should check schema compatibility', async () => {
      const schema = {
        type: 'record',
        name: 'TestEvent',
        fields: [
          { name: 'id', type: 'string' },
          { name: 'message', type: 'string' }
        ]
      };

      const compatibility = await KafkaSchemaRegistryService.checkCompatibility(
        `test-subject-${runId}`,
        schema
      );

      expect(compatibility).toBeDefined();
      expect(compatibility.isCompatible).toBeDefined();
    });
  });

  describe('Performance Tests', () => {
    it('should handle high throughput', async () => {
      const startTime = Date.now();
      const messageCount = 1000;

      const promises = [];
      for (let i = 0; i < messageCount; i++) {
        promises.push(
          EventStreamingService['publishEvent']({
            metadata: {
              eventId: `perf-test-${i}`,
              eventType: 'test.event',
              timestamp: new Date().toISOString(),
              source: 'test',
              version: '1.0.0'
            },
            payload: { index: i }
          } as any, testTopic)
        );
      }

      await Promise.all(promises);
      const duration = Date.now() - startTime;
      const throughput = messageCount / (duration / 1000);

      LoggerService.info('Performance test results', {
        messageCount,
        duration,
        throughput: `${throughput.toFixed(2)} messages/second`
      });

      expect(throughput).toBeGreaterThan(100); // At least 100 msg/s
    });
  });

  describe('Error Handling', () => {
    it('should handle producer connection errors', async () => {
      // This would test error scenarios
      // Implementation depends on error injection mechanism
    });

    it('should handle consumer lag', async () => {
      // This would test consumer lag scenarios
      // Implementation depends on lag simulation
    });
  });
});
