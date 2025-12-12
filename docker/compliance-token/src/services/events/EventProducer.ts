/**
 * Event Producer for Token Compliance Service
 * Kafka event publishing
 */

import { Kafka, Producer, ProducerRecord } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { getConfig } from '../../config';
import { createComponentLogger } from '../../utils/logger';
import { TOKEN_COMPLIANCE_TOPICS } from '../../types/events';
import type {
  BaseEvent,
  TokenRiskAssessmentCreatedEvent,
  TokenHighRiskAlertEvent,
  TokenTravelRuleCreatedEvent,
  TokenTravelRuleSentEvent,
  TokenCARFReportGeneratedEvent,
  WalletScreenedEvent,
  SanctionsMatchDetectedEvent,
  LargeTransferAlertEvent,
  WhaleMovementDetectedEvent,
} from '../../types/events';

const logger = createComponentLogger('event-producer');

/**
 * Event Producer class
 */
export class EventProducer {
  private kafka: Kafka;
  private producer: Producer;
  private connected = false;

  constructor() {
    const config = getConfig();

    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
    });

    this.producer = this.kafka.producer();
  }

  /**
   * Connect to Kafka
   */
  async connect(): Promise<void> {
    if (this.connected) {
      logger.warn('Producer already connected');
      return;
    }

    try {
      await this.producer.connect();
      this.connected = true;
      logger.info('Event producer connected');
    } catch (error) {
      logger.error('Failed to connect event producer', error as Error);
      throw error;
    }
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.producer.disconnect();
      this.connected = false;
      logger.info('Event producer disconnected');
    }
  }

  /**
   * Check if producer is healthy
   */
  isHealthy(): boolean {
    return this.connected;
  }

  /**
   * Publish an event
   */
  async publish(topic: string, event: BaseEvent): Promise<void> {
    if (!this.connected) {
      throw new Error('Producer not connected');
    }

    const record: ProducerRecord = {
      topic,
      messages: [
        {
          key: event['eventId'] as string,
          value: JSON.stringify(event),
          headers: {
            'content-type': 'application/json',
            'event-type': event['eventType'] as string,
          },
        },
      ],
    };

    try {
      await this.producer.send(record);
      logger.logKafkaEvent('published', topic, {
        eventId: event['eventId'] as string,
        eventType: event['eventType'] as string,
      });
    } catch (error) {
      logger.error('Failed to publish event', {
        topic,
        eventId: event['eventId'] as string,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Publish risk assessment created event
   */
  async publishRiskAssessmentCreated(
    assessmentId: string,
    transferId: string,
    transactionHash: string,
    contractAddress: string,
    fromAddress: string,
    toAddress: string,
    amount: string,
    amountUSD: string,
    riskScore: number,
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    flags: string[],
    recommendations: string[],
    reviewRequired: boolean,
    tenantId: string,
    brokerId?: string,
    userId?: string
  ): Promise<void> {
    const event: TokenRiskAssessmentCreatedEvent = {
      eventId: uuidv4(),
      eventType: 'token.risk_assessment.created',
      timestamp: new Date(),
      version: '1.0',
      source: 'token-compliance-service',
      tenantId,
      brokerId,
      payload: {
        assessmentId,
        transferId,
        transactionHash,
        contractAddress,
        fromAddress,
        toAddress,
        amount,
        amountUSD,
        riskScore,
        riskLevel,
        flags,
        recommendations,
        reviewRequired,
        userId,
      },
    };

    await this.publish(TOKEN_COMPLIANCE_TOPICS.TOKEN_RISK_ASSESSMENTS, event);
  }

  /**
   * Publish high risk alert event
   */
  async publishHighRiskAlert(
    assessmentId: string,
    transferId: string,
    transactionHash: string,
    contractAddress: string,
    fromAddress: string,
    toAddress: string,
    amount: string,
    amountUSD: string,
    riskScore: number,
    riskLevel: 'high' | 'critical',
    flags: string[],
    urgency: 'immediate' | 'high' | 'medium',
    recommendedActions: string[],
    tenantId: string,
    brokerId?: string
  ): Promise<void> {
    const event: TokenHighRiskAlertEvent = {
      eventId: uuidv4(),
      eventType: 'token.risk_assessment.high_risk_alert',
      timestamp: new Date(),
      version: '1.0',
      source: 'token-compliance-service',
      tenantId,
      brokerId,
      payload: {
        assessmentId,
        transferId,
        transactionHash,
        contractAddress,
        fromAddress,
        toAddress,
        amount,
        amountUSD,
        riskScore,
        riskLevel,
        flags,
        urgency,
        recommendedActions,
      },
    };

    await this.publish(TOKEN_COMPLIANCE_TOPICS.TOKEN_HIGH_RISK_ALERTS, event);
  }

  /**
   * Publish Travel Rule created event
   */
  async publishTravelRuleCreated(
    travelRuleId: string,
    transferId: string,
    transactionHash: string,
    contractAddress: string,
    tokenSymbol: string,
    chainId: number,
    fromAddress: string,
    toAddress: string,
    amountUSD: string,
    messageId: string,
    tenantId: string,
    brokerId?: string,
    originatorVASP?: string,
    beneficiaryVASP?: string
  ): Promise<void> {
    const event: TokenTravelRuleCreatedEvent = {
      eventId: uuidv4(),
      eventType: 'token.travel_rule.created',
      timestamp: new Date(),
      version: '1.0',
      source: 'token-compliance-service',
      tenantId,
      brokerId,
      payload: {
        travelRuleId,
        transferId,
        transactionHash,
        contractAddress,
        tokenSymbol,
        chainId,
        fromAddress,
        toAddress,
        amountUSD,
        messageId,
        originatorVASP,
        beneficiaryVASP,
      },
    };

    await this.publish(TOKEN_COMPLIANCE_TOPICS.TOKEN_TRAVEL_RULE, event);
  }

  /**
   * Publish Travel Rule sent event
   */
  async publishTravelRuleSent(
    travelRuleId: string,
    transferId: string,
    messageId: string,
    recipientVASP: string,
    tenantId: string,
    brokerId?: string
  ): Promise<void> {
    const event: TokenTravelRuleSentEvent = {
      eventId: uuidv4(),
      eventType: 'token.travel_rule.sent',
      timestamp: new Date(),
      version: '1.0',
      source: 'token-compliance-service',
      tenantId,
      brokerId,
      payload: {
        travelRuleId,
        transferId,
        messageId,
        sentAt: new Date(),
        recipientVASP,
      },
    };

    await this.publish(TOKEN_COMPLIANCE_TOPICS.TOKEN_TRAVEL_RULE, event);
  }

  /**
   * Publish CARF report generated event
   */
  async publishCARFReportGenerated(
    carfId: string,
    reportId: string,
    walletAddress: string,
    reportingPeriodStart: Date,
    reportingPeriodEnd: Date,
    totalTransferInUSD: string,
    totalTransferOutUSD: string,
    netGainLossUSD: string,
    transactionCount: number,
    version: string,
    tenantId: string,
    brokerId?: string,
    userId?: string
  ): Promise<void> {
    const event: TokenCARFReportGeneratedEvent = {
      eventId: uuidv4(),
      eventType: 'token.carf.report_generated',
      timestamp: new Date(),
      version: '1.0',
      source: 'token-compliance-service',
      tenantId,
      brokerId,
      payload: {
        carfId,
        reportId,
        walletAddress,
        userId,
        reportingPeriodStart,
        reportingPeriodEnd,
        totalTransferInUSD,
        totalTransferOutUSD,
        netGainLossUSD,
        transactionCount,
        version,
      },
    };

    await this.publish(TOKEN_COMPLIANCE_TOPICS.TOKEN_CARF, event);
  }

  /**
   * Publish wallet screened event
   */
  async publishWalletScreened(
    screeningId: string,
    walletAddress: string,
    chainId: number,
    provider: string,
    riskScore: number,
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    flags: string[],
    sanctionsMatch: boolean,
    mixerExposure: number,
    darknetExposure: number,
    tenantId: string,
    brokerId?: string
  ): Promise<void> {
    const event: WalletScreenedEvent = {
      eventId: uuidv4(),
      eventType: 'token.wallet.screened',
      timestamp: new Date(),
      version: '1.0',
      source: 'token-compliance-service',
      tenantId,
      brokerId,
      payload: {
        screeningId,
        walletAddress,
        chainId,
        provider,
        riskScore,
        riskLevel,
        flags,
        sanctionsMatch,
        mixerExposure,
        darknetExposure,
      },
    };

    await this.publish(TOKEN_COMPLIANCE_TOPICS.TOKEN_WALLET_SCREENINGS, event);
  }

  /**
   * Publish sanctions match detected event
   */
  async publishSanctionsMatchDetected(
    screeningId: string,
    walletAddress: string,
    chainId: number,
    matchedLists: string[],
    matchScore: number,
    entityName: string,
    recommendedActions: string[],
    tenantId: string,
    brokerId?: string
  ): Promise<void> {
    const event: SanctionsMatchDetectedEvent = {
      eventId: uuidv4(),
      eventType: 'token.wallet.sanctions_match',
      timestamp: new Date(),
      version: '1.0',
      source: 'token-compliance-service',
      tenantId,
      brokerId,
      payload: {
        screeningId,
        walletAddress,
        chainId,
        matchedLists,
        matchScore,
        entityName,
        urgency: 'immediate',
        recommendedActions,
      },
    };

    await this.publish(TOKEN_COMPLIANCE_TOPICS.TOKEN_SANCTIONS_ALERTS, event);
  }

  /**
   * Publish large transfer alert event
   */
  async publishLargeTransferAlert(
    transferId: string,
    transactionHash: string,
    contractAddress: string,
    tokenSymbol: string,
    fromAddress: string,
    toAddress: string,
    amount: string,
    amountUSD: string,
    thresholdUSD: string,
    urgency: 'immediate' | 'high' | 'medium',
    tenantId: string,
    brokerId?: string
  ): Promise<void> {
    const event: LargeTransferAlertEvent = {
      eventId: uuidv4(),
      eventType: 'token.transfer.large_transfer_alert',
      timestamp: new Date(),
      version: '1.0',
      source: 'token-compliance-service',
      tenantId,
      brokerId,
      payload: {
        transferId,
        transactionHash,
        contractAddress,
        tokenSymbol,
        fromAddress,
        toAddress,
        amount,
        amountUSD,
        thresholdUSD,
        urgency,
      },
    };

    await this.publish(TOKEN_COMPLIANCE_TOPICS.TOKEN_LARGE_TRANSFER_ALERTS, event);
  }

  /**
   * Publish whale movement detected event
   */
  async publishWhaleMovementDetected(
    holderId: string,
    contractAddress: string,
    chainId: number,
    holderAddress: string,
    movementType: 'accumulation' | 'distribution',
    amount: string,
    amountUSD: string,
    percentageOfSupply: number,
    transactionHash: string,
    tenantId: string,
    brokerId?: string
  ): Promise<void> {
    const event: WhaleMovementDetectedEvent = {
      eventId: uuidv4(),
      eventType: 'token.holder.whale_movement',
      timestamp: new Date(),
      version: '1.0',
      source: 'token-compliance-service',
      tenantId,
      brokerId,
      payload: {
        holderId,
        contractAddress,
        chainId,
        holderAddress,
        movementType,
        amount,
        amountUSD,
        percentageOfSupply,
        transactionHash,
      },
    };

    await this.publish(TOKEN_COMPLIANCE_TOPICS.TOKEN_WHALE_ALERTS, event);
  }
}

/**
 * Singleton event producer instance
 */
let eventProducerInstance: EventProducer | null = null;

/**
 * Get event producer instance
 */
export function getEventProducer(): EventProducer {
  if (!eventProducerInstance) {
    eventProducerInstance = new EventProducer();
  }
  return eventProducerInstance;
}

/**
 * Reset event producer (for testing)
 */
export function resetEventProducer(): void {
  eventProducerInstance = null;
}

export default getEventProducer;
