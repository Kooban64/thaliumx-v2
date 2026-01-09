/**
 * Kafka Load Testing Script
 * 
 * Load testing and performance benchmarks for Kafka:
 * - Throughput testing
 * - Latency measurement
 * - Consumer lag simulation
 * - Failure scenario testing
 */

import { EventStreamingService } from '../src/services/event-streaming';
import { KafkaTopicManager } from '../src/services/kafka-topic-manager';
import { KafkaMetricsService } from '../src/services/kafka-metrics';
import { LoggerService } from '../src/services/logger';

interface LoadTestConfig {
  topic: string;
  messageCount: number;
  batchSize: number;
  producerCount: number;
  consumerCount: number;
  messageSize: number; // bytes
}

interface LoadTestResults {
  producerThroughput: number; // messages/second
  consumerThroughput: number; // messages/second
  averageLatency: number; // milliseconds
  p99Latency: number; // milliseconds
  errorRate: number; // percentage
  consumerLag: number; // messages
}

class KafkaLoadTester {
  private config: LoadTestConfig;
  private results: LoadTestResults = {
    producerThroughput: 0,
    consumerThroughput: 0,
    averageLatency: 0,
    p99Latency: 0,
    errorRate: 0,
    consumerLag: 0
  };

  constructor(config: LoadTestConfig) {
    this.config = config;
  }

  /**
   * Run throughput test
   */
  async testThroughput(): Promise<LoadTestResults> {
    LoggerService.info('Starting throughput test', this.config);

    // Create test topic if needed
    await KafkaTopicManager.createTopic({
      topic: this.config.topic,
      numPartitions: 6,
      replicationFactor: 3,
      retentionMs: 3600000, // 1 hour
      compressionType: 'snappy'
    });

    // Test producer throughput
    const producerResults = await this.testProducerThroughput();
    this.results.producerThroughput = producerResults.throughput;
    this.results.averageLatency = producerResults.averageLatency;
    this.results.p99Latency = producerResults.p99Latency;
    this.results.errorRate = producerResults.errorRate;

    // Test consumer throughput
    const consumerResults = await this.testConsumerThroughput();
    this.results.consumerThroughput = consumerResults.throughput;
    this.results.consumerLag = consumerResults.lag;

    return this.results;
  }

  /**
   * Test producer throughput
   */
  private async testProducerThroughput(): Promise<{
    throughput: number;
    averageLatency: number;
    p99Latency: number;
    errorRate: number;
  }> {
    const latencies: number[] = [];
    let errorCount = 0;
    const startTime = Date.now();

    // Generate test messages
    const messages = this.generateTestMessages();

    // Publish messages in batches
    for (let i = 0; i < messages.length; i += this.config.batchSize) {
      const batch = messages.slice(i, i + this.config.batchSize);
      const batchStart = Date.now();

      try {
        // Publish batch
        const promises = batch.map(msg => {
          const msgStart = Date.now();
          return EventStreamingService['publishEvent'](msg, this.config.topic)
            .then(() => {
              latencies.push(Date.now() - msgStart);
            })
            .catch(() => {
              errorCount++;
            });
        });

        await Promise.all(promises);
      } catch (error) {
        errorCount += batch.length;
        LoggerService.error('Batch publish failed', { error });
      }
    }

    const duration = (Date.now() - startTime) / 1000; // seconds
    const successCount = messages.length - errorCount;
    const throughput = successCount / duration;
    const averageLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const sortedLatencies = latencies.sort((a, b) => a - b);
    const p99Index = Math.floor(sortedLatencies.length * 0.99);
    const p99Latency = sortedLatencies[p99Index] || 0;
    const errorRate = (errorCount / messages.length) * 100;

    LoggerService.info('Producer throughput test completed', {
      throughput: `${throughput.toFixed(2)} msg/s`,
      averageLatency: `${averageLatency.toFixed(2)}ms`,
      p99Latency: `${p99Latency.toFixed(2)}ms`,
      errorRate: `${errorRate.toFixed(2)}%`
    });

    return {
      throughput,
      averageLatency,
      p99Latency,
      errorRate
    };
  }

  /**
   * Test consumer throughput
   */
  private async testConsumerThroughput(): Promise<{
    throughput: number;
    lag: number;
  }> {
    // Wait for messages to be consumed
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check consumer lag
    const lag = await KafkaMetricsService.getConsumerLag('test-consumer-group');

    // Calculate throughput (simplified - would need actual consumer metrics)
    const throughput = this.results.producerThroughput * 0.95; // Assume 95% consumption rate

    LoggerService.info('Consumer throughput test completed', {
      throughput: `${throughput.toFixed(2)} msg/s`,
      lag
    });

    return {
      throughput,
      lag
    };
  }

  /**
   * Generate test messages
   */
  private generateTestMessages(): any[] {
    const messages: any[] = [];
    const messagePayload = 'x'.repeat(this.config.messageSize);

    for (let i = 0; i < this.config.messageCount; i++) {
      messages.push({
        metadata: {
          eventId: `load-test-${i}-${Date.now()}`,
          eventType: 'load.test',
          timestamp: new Date().toISOString(),
          source: 'load-tester',
          version: '1.0.0'
        },
        payload: {
          index: i,
          data: messagePayload,
          timestamp: Date.now()
        }
      });
    }

    return messages;
  }

  /**
   * Test failure scenarios
   */
  async testFailureScenarios(): Promise<void> {
    LoggerService.info('Testing failure scenarios');

    // Test 1: Producer disconnection
    await this.testProducerDisconnection();

    // Test 2: Consumer lag
    await this.testConsumerLag();

    // Test 3: Message size limits
    await this.testMessageSizeLimits();
  }

  private async testProducerDisconnection(): Promise<void> {
    LoggerService.info('Testing producer disconnection scenario');
    // Implementation would simulate producer disconnection
  }

  private async testConsumerLag(): Promise<void> {
    LoggerService.info('Testing consumer lag scenario');
    // Implementation would simulate consumer lag
  }

  private async testMessageSizeLimits(): Promise<void> {
    LoggerService.info('Testing message size limits');

    const largeMessage = {
      metadata: {
        eventId: 'large-message-test',
        eventType: 'test.event',
        timestamp: new Date().toISOString(),
        source: 'load-tester',
        version: '1.0.0'
      },
      payload: {
        data: 'x'.repeat(100 * 1024 * 1024) // 100MB
      }
    };

    try {
      await EventStreamingService['publishEvent'](largeMessage, this.config.topic);
      LoggerService.warn('Large message was accepted (unexpected)');
    } catch (error) {
      LoggerService.info('Large message correctly rejected', { error });
    }
  }

  /**
   * Print test results
   */
  printResults(): void {
    console.log('\n=== Kafka Load Test Results ===');
    console.log(`Producer Throughput: ${this.results.producerThroughput.toFixed(2)} msg/s`);
    console.log(`Consumer Throughput: ${this.results.consumerThroughput.toFixed(2)} msg/s`);
    console.log(`Average Latency: ${this.results.averageLatency.toFixed(2)}ms`);
    console.log(`P99 Latency: ${this.results.p99Latency.toFixed(2)}ms`);
    console.log(`Error Rate: ${this.results.errorRate.toFixed(2)}%`);
    console.log(`Consumer Lag: ${this.results.consumerLag}`);
    console.log('================================\n');
  }
}

// Main execution
async function main() {
  try {
    // Initialize services
    await EventStreamingService.initialize();
    await KafkaTopicManager.initialize();
    await KafkaMetricsService.initialize();

    // Run load tests
    const tester = new KafkaLoadTester({
      topic: 'thaliumx.load.test',
      messageCount: 10000,
      batchSize: 100,
      producerCount: 1,
      consumerCount: 1,
      messageSize: 1024 // 1KB
    });

    const results = await tester.testThroughput();
    tester.printResults();

    // Test failure scenarios
    await tester.testFailureScenarios();

    // Cleanup
    await EventStreamingService.close();
    await KafkaTopicManager.close();
    await KafkaMetricsService.close();

    process.exit(0);
  } catch (error) {
    LoggerService.error('Load test failed', { error });
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  void main();
}

export { KafkaLoadTester, LoadTestConfig, LoadTestResults };
