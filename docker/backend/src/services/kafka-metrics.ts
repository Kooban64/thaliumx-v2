/**
 * Kafka Metrics Service
 * 
 * Collects and exposes Kafka metrics for monitoring:
 * - Consumer lag per topic/partition
 * - Producer throughput and latency
 * - Broker health metrics
 * - Topic/partition metrics
 * - Consumer group metrics
 * 
 * Integrates with Prometheus via Kafka Exporter
 */

import axios from 'axios';
import { LoggerService } from './logger';

export interface KafkaConsumerLag {
  topic: string;
  partition: number;
  consumerGroup: string;
  lag: number;
  offset: number;
  logEndOffset: number;
}

export interface KafkaTopicMetrics {
  topic: string;
  partitions: number;
  replicationFactor: number;
  messagesPerSecond: number;
  bytesInPerSecond: number;
  bytesOutPerSecond: number;
}

export interface KafkaBrokerMetrics {
  brokerId: string;
  isHealthy: boolean;
  activeControllers: number;
  offlinePartitions: number;
  underReplicatedPartitions: number;
}

export class KafkaMetricsService {
  private static exporterUrl: string;
  private static isInitialized = false;
  private static metricsInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize Kafka metrics collection
   */
  public static async initialize(): Promise<void> {
    try {
      this.exporterUrl = process.env.KAFKA_EXPORTER_URL || 'http://kafka-exporter:9308';
      
      // Test connection to exporter
      await this.testExporterConnection();
      
      // Start periodic metrics collection
      this.startMetricsCollection();
      
      this.isInitialized = true;
      LoggerService.info('✅ Kafka Metrics Service initialized');
    } catch (error) {
      LoggerService.warn('Kafka Metrics Service initialization failed (exporter may not be available)', {
        error: (error as Error).message
      });
      // Don't throw - metrics are optional
    }
  }

  /**
   * Test connection to Kafka Exporter
   */
  private static async testExporterConnection(): Promise<void> {
    try {
      const response = await axios.get(`${this.exporterUrl}/metrics`, { timeout: 5000 });
      if (response.status !== 200) {
        throw new Error(`Kafka exporter returned status ${response.status}`);
      }
      LoggerService.info('Kafka Exporter connection successful');
    } catch (error) {
      LoggerService.warn('Kafka Exporter not available', {
        url: this.exporterUrl,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Start periodic metrics collection
   */
  private static startMetricsCollection(): void {
    // Collect metrics every 30 seconds
    this.metricsInterval = setInterval(() => {
      void (async () => {
        try {
          await this.collectMetrics();
        } catch (error) {
          LoggerService.error('Kafka metrics collection failed', { error });
        }
      })();
    }, 30000);
  }

  /**
   * Collect metrics from Kafka Exporter
   */
  private static async collectMetrics(): Promise<void> {
    try {
      const response = await axios.get(`${this.exporterUrl}/metrics`, { timeout: 5000 });
      const metricsText = response.data as string;
      
      // Parse Prometheus metrics format
      const metrics = this.parsePrometheusMetrics(metricsText);
      
      // Update MetricsService with Kafka metrics
      // Note: MetricsService uses Prometheus directly, so we just log here
      // In production, you'd create custom gauges in MetricsService
      for (const metric of metrics) {
        if (metric.name.startsWith('kafka_consumer_lag')) {
          LoggerService.debug('Kafka consumer lag metric', {
            topic: metric.labels.topic || '',
            partition: metric.labels.partition || '',
            consumer_group: metric.labels.consumer_group || '',
            lag: metric.value
          });
        } else if (metric.name.startsWith('kafka_topic_partitions')) {
          LoggerService.debug('Kafka topic partitions metric', {
            topic: metric.labels.topic || '',
            partitions: metric.value
          });
        } else if (metric.name.startsWith('kafka_broker_info')) {
          LoggerService.debug('Kafka broker info metric', {
            broker_id: metric.labels.broker_id || '',
            info: metric.value
          });
        }
      }
    } catch (error) {
      // Silently fail - exporter may not be available
      LoggerService.debug('Kafka metrics collection skipped', { error: (error as Error).message });
    }
  }

  /**
   * Parse Prometheus metrics format
   */
  private static parsePrometheusMetrics(metricsText: string): Array<{
    name: string;
    value: number;
    labels: Record<string, string | undefined>;
  }> {
    const metrics: Array<{ name: string; value: number; labels: Record<string, string | undefined> }> = [];
    const lines = metricsText.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('#') || !line.trim()) continue;
      
      // Parse format: metric_name{label1="value1",label2="value2"} value
      const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\{([^}]*)\}\s+([0-9.]+)$/);
      if (match) {
        const matchResult = match;
        const name = matchResult[1];
        const labelsStr = matchResult[2];
        const valueStr = matchResult[3];
        
        if (!name || !valueStr) {
          continue;
        }
        
        const labels: Record<string, string | undefined> = {};
        
        // Parse labels
        if (labelsStr) {
          const labelPairs = labelsStr.split(',');
          for (const pair of labelPairs) {
            const [key, value] = pair.split('=');
            if (key && value) {
              labels[key.trim()] = value.trim().replace(/^"|"$/g, '');
            }
          }
        }
        
        metrics.push({
          name,
          value: parseFloat(valueStr),
          labels
        });
      }
    }
    
    return metrics;
  }

  /**
   * Get consumer lag for a specific consumer group
   */
  public static async getConsumerLag(consumerGroup: string): Promise<KafkaConsumerLag[]> {
    try {
      const response = await axios.get(`${this.exporterUrl}/metrics`, { timeout: 5000 });
      const metricsText = response.data as string;
      const metrics = this.parsePrometheusMetrics(metricsText);
      
      const lagMetrics: KafkaConsumerLag[] = [];
      
      for (const metric of metrics) {
        const labels = metric.labels || {};
        const consumerGroupLabel = labels.consumer_group;
        if (metric.name === 'kafka_consumer_lag_sum' && consumerGroupLabel === consumerGroup) {
          const topicLabel = labels.topic;
          const partitionLabel = labels.partition;
          if (typeof topicLabel === 'string' && typeof partitionLabel === 'string' && topicLabel && partitionLabel) {
            lagMetrics.push({
              topic: topicLabel,
              partition: parseInt(partitionLabel, 10),
              consumerGroup: consumerGroup,
              lag: metric.value,
              offset: 0, // Would need additional metric
              logEndOffset: 0 // Would need additional metric
            });
          }
        }
      }
      
      return lagMetrics;
    } catch (error) {
      LoggerService.error('Failed to get consumer lag', { error });
      return [];
    }
  }

  /**
   * Get topic metrics
   */
  public static async getTopicMetrics(topic: string): Promise<KafkaTopicMetrics | null> {
    try {
      const response = await axios.get(`${this.exporterUrl}/metrics`, { timeout: 5000 });
      const metricsText = response.data as string;
      const metrics = this.parsePrometheusMetrics(metricsText);
      
      let partitions = 0;
      let messagesPerSecond = 0;
      let bytesInPerSecond = 0;
      let bytesOutPerSecond = 0;
      
      for (const metric of metrics) {
        const metricTopic = metric.labels?.topic;
        if (metricTopic === topic) {
          if (metric.name === 'kafka_topic_partitions') {
            partitions = metric.value;
          } else if (metric.name === 'kafka_topic_messages_in_per_sec') {
            messagesPerSecond = metric.value;
          } else if (metric.name === 'kafka_topic_bytes_in_per_sec') {
            bytesInPerSecond = metric.value;
          } else if (metric.name === 'kafka_topic_bytes_out_per_sec') {
            bytesOutPerSecond = metric.value;
          }
        }
      }
      
      return {
        topic,
        partitions,
        replicationFactor: 3, // From HA config
        messagesPerSecond,
        bytesInPerSecond,
        bytesOutPerSecond
      };
    } catch (error) {
      LoggerService.error('Failed to get topic metrics', { error });
      return null;
    }
  }

  /**
   * Get broker health metrics
   */
  public static async getBrokerMetrics(): Promise<KafkaBrokerMetrics[]> {
    try {
      const response = await axios.get(`${this.exporterUrl}/metrics`, { timeout: 5000 });
      const metricsText = response.data as string;
      const metrics = this.parsePrometheusMetrics(metricsText);
      
      const brokerMetrics: Map<string, KafkaBrokerMetrics> = new Map();
      
      for (const metric of metrics) {
        const labels = metric.labels || {};
        const brokerId = (labels.broker_id as string) || 'unknown';
        
        if (!brokerMetrics.has(brokerId)) {
          brokerMetrics.set(brokerId, {
            brokerId,
            isHealthy: true,
            activeControllers: 0,
            offlinePartitions: 0,
            underReplicatedPartitions: 0
          });
        }
        
        const broker = brokerMetrics.get(brokerId)!;
        
        if (metric.name === 'kafka_controller_active_count') {
          broker.activeControllers = metric.value;
        } else if (metric.name === 'kafka_controller_offline_partitions_count') {
          broker.offlinePartitions = metric.value;
        } else if (metric.name === 'kafka_server_replicamanager_underreplicatedpartitions') {
          broker.underReplicatedPartitions = metric.value;
        }
        
        // Broker is healthy if no offline partitions and minimal under-replicated
        broker.isHealthy = broker.offlinePartitions === 0 && broker.underReplicatedPartitions < 5;
      }
      
      return Array.from(brokerMetrics.values());
    } catch (error) {
      LoggerService.error('Failed to get broker metrics', { error });
      return [];
    }
  }

  /**
   * Check if consumer lag exceeds threshold
   */
  public static async checkConsumerLag(consumerGroup: string, threshold: number = 10000): Promise<boolean> {
    const lagMetrics = await this.getConsumerLag(consumerGroup);
    const maxLag = Math.max(...lagMetrics.map(m => m.lag), 0);
    return maxLag > threshold;
  }

  /**
   * Close metrics collection
   */
  public static async close(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    this.isInitialized = false;
    LoggerService.info('Kafka Metrics Service closed');
  }
}
