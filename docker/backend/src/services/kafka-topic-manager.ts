/**
 * Kafka Topic Manager Service
 * 
 * Automated topic management with:
 * - Topic creation with optimal configurations
 * - Partition count optimization based on throughput
 * - Retention policy management
 * - Compression configuration
 * - Topic cleanup and archival
 * - Topic health monitoring
 */

import type { Admin } from 'kafkajs';
import { Kafka } from 'kafkajs';
import { LoggerService } from './logger';
import { ConfigService } from './config';
// import { EventStreamingService } from './event-streaming';

export interface TopicConfig {
  topic: string;
  numPartitions: number;
  replicationFactor: number;
  retentionMs: number;
  compressionType: 'snappy' | 'lz4' | 'gzip' | 'zstd' | 'uncompressed' | 'producer';
  cleanupPolicy?: 'delete' | 'compact' | 'compact,delete';
  maxMessageBytes?: number;
  segmentBytes?: number;
}

export interface TopicMetadata {
  topic: string;
  partitions: number;
  replicationFactor: number;
  config: Record<string, string>;
  partitionsMetadata: Array<{
    partition: number;
    leader: number;
    replicas: number[];
    isr: number[];
  }>;
}

export class KafkaTopicManager {
  private static admin: Admin | null = null;
  private static kafka: Kafka | null = null;
  private static isInitialized = false;

  /**
   * Initialize topic manager
   */
  public static async initialize(): Promise<void> {
    try {
      const config = ConfigService.getConfig();
      
      // Get Kafka instance from EventStreamingService or create new one
      this.kafka = new Kafka({
        clientId: 'thaliumx-topic-manager',
        brokers: config.kafka?.brokers || ['kafka-1:9094', 'kafka-2:9094', 'kafka-3:9094'],
        retry: {
          initialRetryTime: 100,
          retries: 8
        },
        connectionTimeout: 3000,
        requestTimeout: 25000
      });

      this.admin = this.kafka.admin();
      await this.admin.connect();

      this.isInitialized = true;
      LoggerService.info('✅ Kafka Topic Manager initialized');
    } catch (error) {
      LoggerService.error('Failed to initialize Kafka Topic Manager', { error });
      throw error;
    }
  }

  /**
   * Create topic with optimal configuration
   */
  public static async createTopic(config: TopicConfig): Promise<void> {
    try {
      if (!this.admin) {
        await this.initialize();
      }

      const existingTopics = await this.admin!.listTopics();
      if (existingTopics.includes(config.topic)) {
        LoggerService.debug('Topic already exists', { topic: config.topic });
        return;
      }

      const configEntries: Array<{ name: string; value: string }> = [
        { name: 'retention.ms', value: config.retentionMs.toString() },
        { name: 'compression.type', value: config.compressionType }
      ];

      if (config.cleanupPolicy) {
        configEntries.push({ name: 'cleanup.policy', value: config.cleanupPolicy });
      }

      if (config.maxMessageBytes) {
        configEntries.push({ name: 'max.message.bytes', value: config.maxMessageBytes.toString() });
      }

      if (config.segmentBytes) {
        configEntries.push({ name: 'segment.bytes', value: config.segmentBytes.toString() });
      }

      await this.admin!.createTopics({
        topics: [{
          topic: config.topic,
          numPartitions: config.numPartitions,
          replicationFactor: config.replicationFactor,
          configEntries
        }]
      });

      LoggerService.info('Topic created successfully', {
        topic: config.topic,
        partitions: config.numPartitions,
        replicationFactor: config.replicationFactor
      });
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        LoggerService.debug('Topic already exists', { topic: config.topic });
        return;
      }
      LoggerService.error('Failed to create topic', {
        topic: config.topic,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get topic metadata
   */
  public static async getTopicMetadata(topic: string): Promise<TopicMetadata | null> {
    try {
      if (!this.admin) {
        await this.initialize();
      }

      // Use fetchTopicMetadata instead of describeTopics
      const metadata = await this.admin!.fetchTopicMetadata({ topics: [topic] });
      const topicMetadata = metadata.topics.find((t: any) => t.name === topic);

      if (!topicMetadata) {
        return null;
      }

      const config = await this.admin!.describeConfigs({
        resources: [{
          type: 2, // Topic resource type
          name: topic
        }],
        includeSynonyms: false
      });

      const configMap: Record<string, string> = {};
      const resource = config.resources[0];
      if (resource && 'configEntries' in resource) {
        const entries = resource.configEntries as unknown as Array<{ name: string; value: string }>;
        for (const entry of entries) {
          if (entry && typeof entry === 'object' && 'name' in entry && 'value' in entry) {
            configMap[entry.name] = entry.value;
          }
        }
      }

      return {
        topic,
        partitions: topicMetadata.partitions?.length || 0,
        replicationFactor: topicMetadata.partitions?.[0]?.replicas?.length || 0,
        config: configMap,
        partitionsMetadata: (topicMetadata.partitions || []).map((p: any) => ({
          partition: p.partitionId,
          leader: p.leader || -1,
          replicas: p.replicas || [],
          isr: p.isr || []
        }))
      };
    } catch (error) {
      LoggerService.error('Failed to get topic metadata', { topic, error });
      return null;
    }
  }

  /**
   * Update topic configuration
   */
  public static async updateTopicConfig(
    topic: string,
    configUpdates: Record<string, string>
  ): Promise<void> {
    try {
      if (!this.admin) {
        await this.initialize();
      }

      await this.admin!.alterConfigs({
        validateOnly: false,
        resources: [{
          type: 2, // Topic resource type
          name: topic,
          configEntries: Object.entries(configUpdates).map(([name, value]) => ({
            name,
            value
          }))
        }]
      });

      LoggerService.info('Topic configuration updated', { topic, configUpdates });
    } catch (error) {
      LoggerService.error('Failed to update topic configuration', { topic, error });
      throw error;
    }
  }

  /**
   * Optimize partition count based on expected throughput
   */
  public static calculateOptimalPartitions(
    expectedMessagesPerSecond: number,
    targetMessagesPerPartitionPerSecond: number = 10000
  ): number {
    const partitions = Math.ceil(expectedMessagesPerSecond / targetMessagesPerPartitionPerSecond);
    // Round up to nearest power of 2 for better distribution
    return Math.pow(2, Math.ceil(Math.log2(Math.max(partitions, 1))));
  }

  /**
   * Custom partitioner for tenant isolation
   * Partitions messages by tenantId to ensure tenant data isolation
   */
  public static createTenantPartitioner(): (args: {
    topic: string;
    partitionMetadata: any[];
    message: any;
  }) => number {
    return ({ topic: _topic, partitionMetadata, message }) => {
      // Extract tenantId from message key or headers
      const tenantId = message.headers?.tenantId || message.key?.toString().split('_')[0];
      
      if (tenantId) {
        // Hash tenantId to partition
        const hash = this.hashString(tenantId);
        return hash % partitionMetadata.length;
      }
      
      // Fallback to default partitioner (hash of key)
      const keyHash = message.key ? this.hashString(message.key.toString()) : 0;
      return keyHash % partitionMetadata.length;
    };
  }

  /**
   * Simple string hash function
   */
  private static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * List all topics
   */
  public static async listTopics(): Promise<string[]> {
    try {
      if (!this.admin) {
        await this.initialize();
      }

      return await this.admin!.listTopics();
    } catch (error) {
      LoggerService.error('Failed to list topics', { error });
      return [];
    }
  }

  /**
   * Delete topic (use with caution)
   */
  public static async deleteTopic(topic: string): Promise<void> {
    try {
      if (!this.admin) {
        await this.initialize();
      }

      await this.admin!.deleteTopics({
        topics: [topic],
        timeout: 30000
      });

      LoggerService.warn('Topic deleted', { topic });
    } catch (error) {
      LoggerService.error('Failed to delete topic', { topic, error });
      throw error;
    }
  }

  /**
   * Archive old topics (set retention to minimum and mark for deletion)
   */
  public static async archiveTopic(topic: string): Promise<void> {
    try {
      await this.updateTopicConfig(topic, {
        'retention.ms': '86400000', // 1 day
        'cleanup.policy': 'delete'
      });
      LoggerService.info('Topic archived', { topic });
    } catch (error) {
      LoggerService.error('Failed to archive topic', { topic, error });
      throw error;
    }
  }

  /**
   * Get topic health status
   */
  public static async getTopicHealth(topic: string): Promise<{
    healthy: boolean;
    issues: string[];
  }> {
    try {
      const metadata = await this.getTopicMetadata(topic);
      if (!metadata) {
        return { healthy: false, issues: ['Topic does not exist'] };
      }

      const issues: string[] = [];
      const config = ConfigService.getConfig();
      const expectedReplicationFactor = config.kafka?.replicationFactor || 3;

      // Check replication factor
      if (metadata.replicationFactor < expectedReplicationFactor) {
        issues.push(`Replication factor ${metadata.replicationFactor} is below expected ${expectedReplicationFactor}`);
      }

      // Check for offline partitions
      const offlinePartitions = metadata.partitionsMetadata.filter(p => p.isr.length < expectedReplicationFactor);
      if (offlinePartitions.length > 0) {
        issues.push(`${offlinePartitions.length} partitions have insufficient replicas in sync`);
      }

      // Check for leaderless partitions
      const leaderlessPartitions = metadata.partitionsMetadata.filter(p => p.leader === -1);
      if (leaderlessPartitions.length > 0) {
        issues.push(`${leaderlessPartitions.length} partitions have no leader`);
      }

      return {
        healthy: issues.length === 0,
        issues
      };
    } catch (error) {
      LoggerService.error('Failed to check topic health', { topic, error });
      return { healthy: false, issues: [`Health check failed: ${(error as Error).message}`] };
    }
  }

  /**
   * Close admin connection
   */
  public static async close(): Promise<void> {
    if (this.admin) {
      await this.admin.disconnect();
      this.admin = null;
    }
    this.isInitialized = false;
    LoggerService.info('Kafka Topic Manager closed');
  }
}
