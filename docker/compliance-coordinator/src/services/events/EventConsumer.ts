/**
 * Event Consumer Service
 * Consumes compliance events from all platform services via Kafka
 */

import { Kafka, Consumer, EachMessagePayload, KafkaMessage } from 'kafkajs';
import { getConfig } from '../../config';
import { createComponentLogger, logEventProcessing } from '../../utils/logger';
import { getAggregationService } from '../aggregation';
import type { ComplianceServiceType } from '../../types/coordinator';
import type {
  RiskAssessmentInput,
  TravelRuleInput,
} from '../aggregation';

const logger = createComponentLogger('event-consumer');

/**
 * Compliance event types
 */
export type ComplianceEventType =
  | 'risk_assessment_created'
  | 'risk_assessment_updated'
  | 'travel_rule_created'
  | 'travel_rule_updated'
  | 'carf_report_created'
  | 'carf_report_updated'
  | 'alert_created'
  | 'service_health_update';

/**
 * Base compliance event
 */
export interface ComplianceEvent {
  eventId: string;
  eventType: ComplianceEventType;
  sourceService: ComplianceServiceType;
  timestamp: string;
  tenantId: string;
  brokerId?: string | undefined;
  correlationId?: string | undefined;
  payload: Record<string, unknown>;
}

/**
 * Risk assessment event payload
 */
export interface RiskAssessmentEventPayload {
  assessmentId: string;
  entityType: string;
  entityId: string;
  transactionHash?: string | undefined;
  userId?: string | undefined;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  recommendations: string[];
  reviewRequired: boolean;
  assessmentDate: string;
}

/**
 * Travel rule event payload
 */
export interface TravelRuleEventPayload {
  travelRuleId: string;
  entityType: string;
  entityId: string;
  transactionHash?: string | undefined;
  fromAddress: string;
  toAddress: string;
  amount: string;
  amountUSD: string;
  asset: string;
  status: 'pending' | 'sent' | 'received' | 'acknowledged' | 'failed';
  messageId: string;
  originatorInfo?: Record<string, unknown> | undefined;
  beneficiaryInfo?: Record<string, unknown> | undefined;
  vaspInfo?: Record<string, unknown> | undefined;
  userId?: string | undefined;
}

/**
 * CARF event payload
 */
export interface CARFEventPayload {
  carfId: string;
  reportId: string;
  userId?: string | undefined;
  periodStart: string;
  periodEnd: string;
  fiscalYear?: string | undefined;
  totalVolumeUSD: string;
  netGainLossUSD: string;
  transactionCount: number;
  status: 'draft' | 'pending' | 'submitted' | 'acknowledged' | 'rejected';
  serviceData: Record<string, unknown>;
}

/**
 * Alert event payload
 */
export interface AlertEventPayload {
  alertId: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  entityType: string;
  entityId: string;
  title: string;
  description: string;
  details: Record<string, unknown>;
  userId?: string | undefined;
}

/**
 * Service health event payload
 */
export interface ServiceHealthEventPayload {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  version: string;
  metrics: {
    pendingAssessments: number;
    highRiskAlerts: number;
    pendingTravelRule: number;
    pendingCARF: number;
  };
}

/**
 * Event Consumer class
 */
export class EventConsumer {
  private kafka: Kafka;
  private consumer: Consumer | null = null;
  private isRunning = false;
  private readonly topics: string[];

  constructor() {
    const config = getConfig();

    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    // Subscribe to all compliance service topics
    this.topics = [
      'compliance.cex.events',
      'compliance.dex.events',
      'compliance.nft.events',
      'compliance.token.events',
    ];
  }

  /**
   * Start consuming events
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Event consumer is already running');
      return;
    }

    const config = getConfig();

    try {
      this.consumer = this.kafka.consumer({
        groupId: config.kafka.groupId,
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
        maxBytesPerPartition: 1048576, // 1MB
        retry: {
          initialRetryTime: 100,
          retries: 8,
        },
      });

      await this.consumer.connect();
      logger.info('Kafka consumer connected');

      // Subscribe to all topics
      for (const topic of this.topics) {
        await this.consumer.subscribe({ topic, fromBeginning: false });
        logger.info(`Subscribed to topic: ${topic}`);
      }

      // Start consuming
      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          await this.handleMessage(payload);
        },
      });

      this.isRunning = true;
      logger.info('Event consumer started');
    } catch (error) {
      logger.error('Failed to start event consumer', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Stop consuming events
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.consumer) {
      return;
    }

    try {
      await this.consumer.disconnect();
      this.isRunning = false;
      logger.info('Event consumer stopped');
    } catch (error) {
      logger.error('Error stopping event consumer', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;
    const startTime = Date.now();

    try {
      const event = this.parseMessage(message);
      if (!event) {
        logger.warn('Failed to parse message', { topic, partition });
        return;
      }

      logger.debug('Processing event', {
        eventId: event.eventId,
        eventType: event.eventType,
        sourceService: event.sourceService,
      });

      await this.processEvent(event);

      const duration = Date.now() - startTime;
      logEventProcessing(event.eventType, event.sourceService, duration, true);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Error processing message', {
        topic,
        partition,
        error: error instanceof Error ? error.message : String(error),
      });
      logEventProcessing('unknown', 'cex', duration, false, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Parse Kafka message to ComplianceEvent
   */
  private parseMessage(message: KafkaMessage): ComplianceEvent | null {
    if (!message.value) {
      return null;
    }

    try {
      const data = JSON.parse(message.value.toString()) as ComplianceEvent;
      return data;
    } catch (error) {
      logger.error('Failed to parse message', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Process compliance event
   */
  private async processEvent(event: ComplianceEvent): Promise<void> {
    switch (event.eventType) {
      case 'risk_assessment_created':
      case 'risk_assessment_updated':
        await this.handleRiskAssessmentEvent(event);
        break;

      case 'travel_rule_created':
      case 'travel_rule_updated':
        await this.handleTravelRuleEvent(event);
        break;

      case 'carf_report_created':
      case 'carf_report_updated':
        await this.handleCARFEvent(event);
        break;

      case 'alert_created':
        await this.handleAlertEvent(event);
        break;

      case 'service_health_update':
        await this.handleServiceHealthEvent(event);
        break;

      default:
        logger.warn('Unknown event type', { eventType: event.eventType });
    }
  }

  /**
   * Handle risk assessment event
   */
  private async handleRiskAssessmentEvent(event: ComplianceEvent): Promise<void> {
    const payload = event.payload as unknown as RiskAssessmentEventPayload;
    const aggregationService = getAggregationService();

    const input: RiskAssessmentInput = {
      sourceService: event.sourceService,
      sourceAssessmentId: payload.assessmentId,
      entityType: payload.entityType,
      entityId: payload.entityId,
      transactionHash: payload.transactionHash,
      userId: payload.userId,
      tenantId: event.tenantId,
      brokerId: event.brokerId,
      riskScore: payload.riskScore,
      riskLevel: payload.riskLevel,
      flags: payload.flags,
      recommendations: payload.recommendations,
      reviewRequired: payload.reviewRequired,
      assessmentDate: new Date(payload.assessmentDate),
    };

    await aggregationService.aggregateRiskAssessment(input);

    logger.info('Risk assessment aggregated', {
      sourceService: event.sourceService,
      assessmentId: payload.assessmentId,
    });
  }

  /**
   * Handle travel rule event
   */
  private async handleTravelRuleEvent(event: ComplianceEvent): Promise<void> {
    const payload = event.payload as unknown as TravelRuleEventPayload;
    const aggregationService = getAggregationService();

    const input: TravelRuleInput = {
      sourceService: event.sourceService,
      sourceTravelRuleId: payload.travelRuleId,
      entityType: payload.entityType,
      entityId: payload.entityId,
      transactionHash: payload.transactionHash,
      fromAddress: payload.fromAddress,
      toAddress: payload.toAddress,
      amount: payload.amount,
      amountUSD: payload.amountUSD,
      asset: payload.asset,
      status: payload.status,
      messageId: payload.messageId,
      originatorInfo: payload.originatorInfo,
      beneficiaryInfo: payload.beneficiaryInfo,
      vaspInfo: payload.vaspInfo,
      tenantId: event.tenantId,
      brokerId: event.brokerId,
      userId: payload.userId,
    };

    await aggregationService.aggregateTravelRule(input);

    logger.info('Travel rule aggregated', {
      sourceService: event.sourceService,
      travelRuleId: payload.travelRuleId,
    });
  }

  /**
   * Handle CARF event
   */
  private async handleCARFEvent(event: ComplianceEvent): Promise<void> {
    const payload = event.payload as unknown as CARFEventPayload;
    
    // For now, log the event - full CARF aggregation would be implemented
    // in a dedicated CARF aggregation service
    logger.info('CARF event received', {
      sourceService: event.sourceService,
      carfId: payload.carfId,
      reportId: payload.reportId,
      status: payload.status,
    });

    // TODO: Implement CARF aggregation when needed
  }

  /**
   * Handle alert event
   */
  private async handleAlertEvent(event: ComplianceEvent): Promise<void> {
    const payload = event.payload as unknown as AlertEventPayload;
    
    // Forward to alerts service
    logger.info('Alert event received', {
      sourceService: event.sourceService,
      alertId: payload.alertId,
      alertType: payload.alertType,
      severity: payload.severity,
    });

    // TODO: Forward to AlertsService when implemented
  }

  /**
   * Handle service health event
   */
  private async handleServiceHealthEvent(event: ComplianceEvent): Promise<void> {
    const payload = event.payload as unknown as ServiceHealthEventPayload;
    
    logger.info('Service health update received', {
      sourceService: event.sourceService,
      status: payload.status,
      latency: payload.latency,
      version: payload.version,
    });

    // TODO: Update service status tracking when implemented
  }

  /**
   * Check if consumer is running
   */
  isConsumerRunning(): boolean {
    return this.isRunning;
  }
}

/**
 * Singleton instance
 */
let eventConsumerInstance: EventConsumer | null = null;

export function getEventConsumer(): EventConsumer {
  if (!eventConsumerInstance) {
    eventConsumerInstance = new EventConsumer();
  }
  return eventConsumerInstance;
}

export default getEventConsumer;
