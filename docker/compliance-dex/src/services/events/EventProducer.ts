/**
 * Event Producer for DEX Compliance Service
 * Kafka producer for publishing compliance events
 */

import { Kafka, Producer, ProducerRecord, RecordMetadata } from 'kafkajs';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { DEXComplianceEvent } from '../../types/events';

// ==================== KAFKA TOPICS ====================

export const DEX_COMPLIANCE_TOPICS = {
  // DEX Transaction Events
  DEX_SWAP: 'dex.compliance.swap',
  DEX_LIQUIDITY: 'dex.compliance.liquidity',
  DEX_BRIDGE: 'dex.compliance.bridge',
  DEX_BRIDGE_COMPLETED: 'dex.compliance.bridge.completed',

  // Wallet Events
  WALLET_CONNECTED: 'dex.compliance.wallet.connected',
  WALLET_SCREENING_REQUESTED: 'dex.compliance.wallet.screening.requested',
  WALLET_SCREENING_COMPLETED: 'dex.compliance.wallet.screening.completed',

  // Compliance Events
  RISK_ASSESSMENT_COMPLETED: 'dex.compliance.risk_assessment.completed',
  TRAVEL_RULE_GENERATED: 'dex.compliance.travel_rule.generated',
  TRAVEL_RULE_SENT: 'dex.compliance.travel_rule.sent',
  CARF_REPORT_GENERATED: 'dex.compliance.carf.generated',
  CARF_REPORT_SUBMITTED: 'dex.compliance.carf.submitted',

  // Protocol Events
  PROTOCOL_ASSESSED: 'dex.compliance.protocol.assessed',

  // Alert Events
  HIGH_RISK_ALERT: 'dex.compliance.alert.high_risk',
  SANCTIONS_MATCH_ALERT: 'dex.compliance.alert.sanctions_match',
} as const;

// ==================== EVENT PRODUCER ====================

/**
 * Kafka event producer for DEX compliance events
 */
export class EventProducer {
  private static instance: EventProducer;
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private isConnected = false;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): EventProducer {
    if (!EventProducer.instance) {
      EventProducer.instance = new EventProducer();
    }
    return EventProducer.instance;
  }

  /**
   * Initialize Kafka producer
   */
  public async initialize(): Promise<void> {
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
      });

      this.producer = this.kafka.producer({
        allowAutoTopicCreation: true,
        transactionTimeout: 30000,
      });

      await this.producer.connect();
      this.isConnected = true;

      logger.info('Event producer initialized', {
        brokers: config.kafka.brokers,
        clientId: config.kafka.clientId,
      });
    } catch (error) {
      logger.error('Failed to initialize event producer', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Publish a single event
   */
  public async publish(
    topic: string,
    event: DEXComplianceEvent
  ): Promise<RecordMetadata[]> {
    if (!this.producer) {
      throw new Error('Event producer not initialized');
    }

    const record: ProducerRecord = {
      topic,
      messages: [
        {
          key: event.id,
          value: JSON.stringify(event),
          headers: {
            'event-type': event.type,
            'tenant-id': event.tenantId,
            'timestamp': event.timestamp.toISOString(),
            ...(event.correlationId ? { 'correlation-id': event.correlationId } : {}),
          },
        },
      ],
    };

    const startTime = Date.now();
    try {
      const result = await this.producer.send(record);
      const duration = Date.now() - startTime;

      logger.debug('Event published', {
        topic,
        eventType: event.type,
        eventId: event.id,
        duration,
      });

      return result;
    } catch (error) {
      logger.error('Failed to publish event', {
        topic,
        eventType: event.type,
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Publish multiple events in batch
   */
  public async publishBatch(
    topic: string,
    events: DEXComplianceEvent[]
  ): Promise<RecordMetadata[]> {
    if (!this.producer) {
      throw new Error('Event producer not initialized');
    }

    const record: ProducerRecord = {
      topic,
      messages: events.map((event) => ({
        key: event.id,
        value: JSON.stringify(event),
        headers: {
          'event-type': event.type,
          'tenant-id': event.tenantId,
          'timestamp': event.timestamp.toISOString(),
          ...(event.correlationId ? { 'correlation-id': event.correlationId } : {}),
        },
      })),
    };

    const startTime = Date.now();
    try {
      const result = await this.producer.send(record);
      const duration = Date.now() - startTime;

      logger.debug('Batch events published', {
        topic,
        count: events.length,
        duration,
      });

      return result;
    } catch (error) {
      logger.error('Failed to publish batch events', {
        topic,
        count: events.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Publish DEX swap event
   */
  public async publishSwapEvent(event: DEXComplianceEvent): Promise<RecordMetadata[]> {
    return this.publish(DEX_COMPLIANCE_TOPICS.DEX_SWAP, event);
  }

  /**
   * Publish DEX liquidity event
   */
  public async publishLiquidityEvent(event: DEXComplianceEvent): Promise<RecordMetadata[]> {
    return this.publish(DEX_COMPLIANCE_TOPICS.DEX_LIQUIDITY, event);
  }

  /**
   * Publish bridge transaction event
   */
  public async publishBridgeEvent(event: DEXComplianceEvent): Promise<RecordMetadata[]> {
    return this.publish(DEX_COMPLIANCE_TOPICS.DEX_BRIDGE, event);
  }

  /**
   * Publish wallet screening completed event
   */
  public async publishWalletScreeningCompleted(event: DEXComplianceEvent): Promise<RecordMetadata[]> {
    return this.publish(DEX_COMPLIANCE_TOPICS.WALLET_SCREENING_COMPLETED, event);
  }

  /**
   * Publish risk assessment completed event
   */
  public async publishRiskAssessmentCompleted(event: DEXComplianceEvent): Promise<RecordMetadata[]> {
    return this.publish(DEX_COMPLIANCE_TOPICS.RISK_ASSESSMENT_COMPLETED, event);
  }

  /**
   * Publish high risk alert event
   */
  public async publishHighRiskAlert(event: DEXComplianceEvent): Promise<RecordMetadata[]> {
    return this.publish(DEX_COMPLIANCE_TOPICS.HIGH_RISK_ALERT, event);
  }

  /**
   * Publish sanctions match alert event
   */
  public async publishSanctionsMatchAlert(event: DEXComplianceEvent): Promise<RecordMetadata[]> {
    return this.publish(DEX_COMPLIANCE_TOPICS.SANCTIONS_MATCH_ALERT, event);
  }

  /**
   * Get connection status
   */
  public getStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Close producer connection
   */
  public async close(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
      this.producer = null;
      this.kafka = null;
      this.isConnected = false;
      logger.info('Event producer closed');
    }
  }
}

// ==================== EXPORT ====================

export const eventProducer = EventProducer.getInstance();
