/**
 * Kafka Event Producer for NFT Compliance Service
 * Publishes compliance events to Kafka topics
 */

import { Kafka, Producer, ProducerRecord, RecordMetadata } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { getConfig } from '../../config';
import { createComponentLogger } from '../../utils/logger';
import {
  NFTComplianceEvent,
  NFT_COMPLIANCE_TOPICS,
  NFTComplianceTopic,
  EventMetadata,
} from '../../types/events';

const logger = createComponentLogger('event-producer');

/**
 * Event Producer class
 */
export class EventProducer {
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private isConnected = false;

  /**
   * Initialize Kafka producer
   */
  async connect(): Promise<void> {
    if (this.producer) {
      logger.warn('Kafka producer already initialized');
      return;
    }

    const config = getConfig();

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

    try {
      await this.producer.connect();
      this.isConnected = true;
      logger.info('Kafka producer connected', {
        brokers: config.kafka.brokers,
        clientId: config.kafka.clientId,
      });
    } catch (error) {
      logger.error('Failed to connect Kafka producer', error as Error);
      throw error;
    }
  }

  /**
   * Disconnect Kafka producer
   */
  async disconnect(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
      this.producer = null;
      this.kafka = null;
      this.isConnected = false;
      logger.info('Kafka producer disconnected');
    }
  }

  /**
   * Check if connected
   */
  isHealthy(): boolean {
    return this.isConnected && this.producer !== null;
  }

  /**
   * Get producer instance
   */
  private getProducer(): Producer {
    if (!this.producer) {
      throw new Error('Kafka producer not initialized. Call connect() first.');
    }
    return this.producer;
  }

  /**
   * Send a single event
   */
  async send(
    topic: NFTComplianceTopic,
    event: NFTComplianceEvent,
    key?: string
  ): Promise<RecordMetadata[]> {
    const producer = this.getProducer();
    const config = getConfig();

    const metadata: EventMetadata = {
      producedAt: new Date(),
      producedBy: config.serviceName,
    };

    const record: ProducerRecord = {
      topic,
      messages: [
        {
          key: key || event.eventId,
          value: JSON.stringify({
            ...event,
            metadata,
          }),
          headers: {
            eventType: event.eventType,
            eventId: event.eventId,
            timestamp: event.timestamp.toISOString(),
            source: event.source,
            tenantId: event.tenantId,
          },
        },
      ],
    };

    try {
      const result = await producer.send(record);
      logger.logKafkaEvent('produced', topic, {
        eventType: event.eventType,
        eventId: event.eventId,
        tenantId: event.tenantId,
      });
      return result;
    } catch (error) {
      logger.error('Failed to produce event', {
        topic,
        eventType: event.eventType,
        eventId: event.eventId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Send multiple events in batch
   */
  async sendBatch(
    events: Array<{ topic: NFTComplianceTopic; event: NFTComplianceEvent; key?: string }>
  ): Promise<RecordMetadata[]> {
    const producer = this.getProducer();
    const config = getConfig();

    const topicMessages = new Map<string, ProducerRecord['messages']>();

    for (const { topic, event, key } of events) {
      const metadata: EventMetadata = {
        producedAt: new Date(),
        producedBy: config.serviceName,
      };

      const message = {
        key: key || event.eventId,
        value: JSON.stringify({
          ...event,
          metadata,
        }),
        headers: {
          eventType: event.eventType,
          eventId: event.eventId,
          timestamp: event.timestamp.toISOString(),
          source: event.source,
          tenantId: event.tenantId,
        },
      };

      const existing = topicMessages.get(topic) || [];
      existing.push(message);
      topicMessages.set(topic, existing);
    }

    const records: ProducerRecord[] = Array.from(topicMessages.entries()).map(
      ([topic, messages]) => ({
        topic,
        messages,
      })
    );

    try {
      const results = await producer.sendBatch({ topicMessages: records });
      logger.logKafkaEvent('batch_produced', 'multiple', {
        eventCount: events.length,
        topicCount: records.length,
      });
      return results;
    } catch (error) {
      logger.error('Failed to produce batch events', {
        eventCount: events.length,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // ==================== NFT COLLECTION EVENTS ====================

  /**
   * Publish collection created event
   */
  async publishCollectionCreated(
    collectionId: string,
    contractAddress: string,
    chainId: number,
    name: string,
    symbol: string,
    creatorAddress: string,
    creatorFee: number,
    totalSupply: number,
    verified: boolean,
    tenantId: string,
    brokerId?: string
  ): Promise<RecordMetadata[]> {
    const event = {
      eventId: uuidv4(),
      eventType: 'nft.collection.created' as const,
      timestamp: new Date(),
      version: '1.0',
      source: 'nft-compliance-service',
      tenantId,
      brokerId,
      payload: {
        collectionId,
        contractAddress,
        chainId,
        name,
        symbol,
        creatorAddress,
        creatorFee,
        totalSupply,
        verified,
      },
    };

    return this.send(NFT_COMPLIANCE_TOPICS.NFT_COLLECTIONS, event, contractAddress);
  }

  /**
   * Publish collection flagged event
   */
  async publishCollectionFlagged(
    collectionId: string,
    contractAddress: string,
    chainId: number,
    flagReason: string,
    flaggedBy: string,
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    tenantId: string,
    brokerId?: string
  ): Promise<RecordMetadata[]> {
    const event = {
      eventId: uuidv4(),
      eventType: 'nft.collection.flagged' as const,
      timestamp: new Date(),
      version: '1.0',
      source: 'nft-compliance-service',
      tenantId,
      brokerId,
      payload: {
        collectionId,
        contractAddress,
        chainId,
        flagReason,
        flaggedBy,
        riskLevel,
      },
    };

    return this.send(NFT_COMPLIANCE_TOPICS.NFT_COMPLIANCE_EVENTS, event, contractAddress);
  }

  // ==================== NFT SALE EVENTS ====================

  /**
   * Publish sale compliance checked event
   */
  async publishSaleComplianceChecked(
    saleId: string,
    transactionHash: string,
    riskScore: number,
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    flags: string[],
    recommendations: string[],
    travelRuleRequired: boolean,
    blocked: boolean,
    tenantId: string,
    brokerId?: string,
    blockReason?: string
  ): Promise<RecordMetadata[]> {
    const event = {
      eventId: uuidv4(),
      eventType: 'nft.sale.compliance_checked' as const,
      timestamp: new Date(),
      version: '1.0',
      source: 'nft-compliance-service',
      tenantId,
      brokerId,
      payload: {
        saleId,
        transactionHash,
        riskScore,
        riskLevel,
        flags,
        recommendations,
        travelRuleRequired,
        blocked,
        blockReason,
      },
    };

    return this.send(NFT_COMPLIANCE_TOPICS.NFT_COMPLIANCE_EVENTS, event, transactionHash);
  }

  // ==================== WASH TRADING EVENTS ====================

  /**
   * Publish wash trading detected event
   */
  async publishWashTradingDetected(
    detectionId: string,
    contractAddress: string,
    tokenId: string,
    chainId: number,
    confidence: number,
    indicators: string[],
    relatedTransactions: string[],
    relatedAddresses: string[],
    priceManipulation: boolean,
    tenantId: string,
    brokerId?: string,
    volumeInflation?: string
  ): Promise<RecordMetadata[]> {
    const event = {
      eventId: uuidv4(),
      eventType: 'nft.wash_trading.detected' as const,
      timestamp: new Date(),
      version: '1.0',
      source: 'nft-compliance-service',
      tenantId,
      brokerId,
      payload: {
        detectionId,
        contractAddress,
        tokenId,
        chainId,
        confidence,
        indicators,
        relatedTransactions,
        relatedAddresses,
        volumeInflation,
        priceManipulation,
      },
    };

    return this.send(NFT_COMPLIANCE_TOPICS.NFT_WASH_TRADING, event, `${contractAddress}:${tokenId}`);
  }

  // ==================== CONTENT SCREENING EVENTS ====================

  /**
   * Publish content screened event
   */
  async publishContentScreened(
    screeningId: string,
    contractAddress: string,
    tokenId: string,
    chainId: number,
    contentType: 'image' | 'video' | 'audio' | '3d_model' | 'other',
    contentUrl: string,
    isFlagged: boolean,
    flagReasons: string[],
    moderationScore: number,
    categories: string[],
    manualReviewRequired: boolean,
    tenantId: string,
    brokerId?: string
  ): Promise<RecordMetadata[]> {
    const event = {
      eventId: uuidv4(),
      eventType: 'nft.content.screened' as const,
      timestamp: new Date(),
      version: '1.0',
      source: 'nft-compliance-service',
      tenantId,
      brokerId,
      payload: {
        screeningId,
        contractAddress,
        tokenId,
        chainId,
        contentType,
        contentUrl,
        isFlagged,
        flagReasons,
        moderationScore,
        categories,
        manualReviewRequired,
      },
    };

    return this.send(NFT_COMPLIANCE_TOPICS.NFT_CONTENT_SCREENING, event, `${contractAddress}:${tokenId}`);
  }

  // ==================== RISK ASSESSMENT EVENTS ====================

  /**
   * Publish risk assessment created event
   */
  async publishRiskAssessmentCreated(
    assessmentId: string,
    transactionId: string,
    transactionHash: string,
    contractAddress: string,
    tokenId: string,
    sellerAddress: string,
    buyerAddress: string,
    riskScore: number,
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    flags: string[],
    recommendations: string[],
    reviewRequired: boolean,
    tenantId: string,
    brokerId?: string,
    userId?: string
  ): Promise<RecordMetadata[]> {
    const event = {
      eventId: uuidv4(),
      eventType: 'nft.risk_assessment.created' as const,
      timestamp: new Date(),
      version: '1.0',
      source: 'nft-compliance-service',
      tenantId,
      brokerId,
      payload: {
        assessmentId,
        transactionId,
        transactionHash,
        contractAddress,
        tokenId,
        sellerAddress,
        buyerAddress,
        riskScore,
        riskLevel,
        flags,
        recommendations,
        reviewRequired,
        userId,
      },
    };

    return this.send(NFT_COMPLIANCE_TOPICS.NFT_RISK_ASSESSMENTS, event, transactionHash);
  }

  /**
   * Publish high risk alert event
   */
  async publishHighRiskAlert(
    assessmentId: string,
    transactionId: string,
    transactionHash: string,
    contractAddress: string,
    tokenId: string,
    riskScore: number,
    riskLevel: 'high' | 'critical',
    flags: string[],
    urgency: 'immediate' | 'high' | 'medium',
    recommendedActions: string[],
    tenantId: string,
    brokerId?: string
  ): Promise<RecordMetadata[]> {
    const event = {
      eventId: uuidv4(),
      eventType: 'nft.risk_assessment.high_risk_alert' as const,
      timestamp: new Date(),
      version: '1.0',
      source: 'nft-compliance-service',
      tenantId,
      brokerId,
      payload: {
        assessmentId,
        transactionId,
        transactionHash,
        contractAddress,
        tokenId,
        riskScore,
        riskLevel,
        flags,
        urgency,
        recommendedActions,
      },
    };

    return this.send(NFT_COMPLIANCE_TOPICS.NFT_HIGH_RISK_ALERTS, event, transactionHash);
  }

  // ==================== TRAVEL RULE EVENTS ====================

  /**
   * Publish Travel Rule created event
   */
  async publishTravelRuleCreated(
    travelRuleId: string,
    saleId: string,
    contractAddress: string,
    tokenId: string,
    chainId: number,
    sellerAddress: string,
    buyerAddress: string,
    priceUSD: string,
    messageId: string,
    tenantId: string,
    brokerId?: string,
    originatorVASP?: string,
    beneficiaryVASP?: string
  ): Promise<RecordMetadata[]> {
    const event = {
      eventId: uuidv4(),
      eventType: 'nft.travel_rule.created' as const,
      timestamp: new Date(),
      version: '1.0',
      source: 'nft-compliance-service',
      tenantId,
      brokerId,
      payload: {
        travelRuleId,
        saleId,
        contractAddress,
        tokenId,
        chainId,
        sellerAddress,
        buyerAddress,
        priceUSD,
        messageId,
        originatorVASP,
        beneficiaryVASP,
      },
    };

    return this.send(NFT_COMPLIANCE_TOPICS.NFT_TRAVEL_RULE, event, saleId);
  }

  /**
   * Publish Travel Rule sent event
   */
  async publishTravelRuleSent(
    travelRuleId: string,
    saleId: string,
    messageId: string,
    recipientVASP: string,
    tenantId: string,
    brokerId?: string
  ): Promise<RecordMetadata[]> {
    const event = {
      eventId: uuidv4(),
      eventType: 'nft.travel_rule.sent' as const,
      timestamp: new Date(),
      version: '1.0',
      source: 'nft-compliance-service',
      tenantId,
      brokerId,
      payload: {
        travelRuleId,
        saleId,
        messageId,
        sentAt: new Date(),
        recipientVASP,
      },
    };

    return this.send(NFT_COMPLIANCE_TOPICS.NFT_TRAVEL_RULE, event, saleId);
  }

  /**
   * Publish Travel Rule failed event
   */
  async publishTravelRuleFailed(
    travelRuleId: string,
    saleId: string,
    messageId: string,
    errorMessage: string,
    retryCount: number,
    willRetry: boolean,
    tenantId: string,
    brokerId?: string
  ): Promise<RecordMetadata[]> {
    const event = {
      eventId: uuidv4(),
      eventType: 'nft.travel_rule.failed' as const,
      timestamp: new Date(),
      version: '1.0',
      source: 'nft-compliance-service',
      tenantId,
      brokerId,
      payload: {
        travelRuleId,
        saleId,
        messageId,
        failedAt: new Date(),
        errorMessage,
        retryCount,
        willRetry,
      },
    };

    return this.send(NFT_COMPLIANCE_TOPICS.NFT_TRAVEL_RULE, event, saleId);
  }

  // ==================== CARF EVENTS ====================

  /**
   * Publish CARF report generated event
   */
  async publishCARFReportGenerated(
    carfId: string,
    reportId: string,
    walletAddress: string,
    reportingPeriodStart: Date,
    reportingPeriodEnd: Date,
    totalSalesVolumeUSD: string,
    totalPurchasesVolumeUSD: string,
    netGainLossUSD: string,
    transactionCount: number,
    version: string,
    tenantId: string,
    brokerId?: string,
    userId?: string
  ): Promise<RecordMetadata[]> {
    const event = {
      eventId: uuidv4(),
      eventType: 'nft.carf.report_generated' as const,
      timestamp: new Date(),
      version: '1.0',
      source: 'nft-compliance-service',
      tenantId,
      brokerId,
      payload: {
        carfId,
        reportId,
        walletAddress,
        userId,
        reportingPeriodStart,
        reportingPeriodEnd,
        totalSalesVolumeUSD,
        totalPurchasesVolumeUSD,
        netGainLossUSD,
        transactionCount,
        version,
      },
    };

    return this.send(NFT_COMPLIANCE_TOPICS.NFT_CARF, event, reportId);
  }

  /**
   * Publish CARF report submitted event
   */
  async publishCARFReportSubmitted(
    carfId: string,
    reportId: string,
    submittedTo: string,
    tenantId: string,
    brokerId?: string,
    submissionReference?: string
  ): Promise<RecordMetadata[]> {
    const event = {
      eventId: uuidv4(),
      eventType: 'nft.carf.report_submitted' as const,
      timestamp: new Date(),
      version: '1.0',
      source: 'nft-compliance-service',
      tenantId,
      brokerId,
      payload: {
        carfId,
        reportId,
        submittedAt: new Date(),
        submittedTo,
        submissionReference,
      },
    };

    return this.send(NFT_COMPLIANCE_TOPICS.NFT_CARF, event, reportId);
  }

  // ==================== ROYALTY EVENTS ====================

  /**
   * Publish royalty paid event
   */
  async publishRoyaltyPaid(
    saleId: string,
    contractAddress: string,
    tokenId: string,
    chainId: number,
    collectionId: string,
    royaltyAmount: string,
    royaltyRecipient: string,
    transactionHash: string,
    tenantId: string,
    brokerId?: string
  ): Promise<RecordMetadata[]> {
    const event = {
      eventId: uuidv4(),
      eventType: 'nft.royalty.paid' as const,
      timestamp: new Date(),
      version: '1.0',
      source: 'nft-compliance-service',
      tenantId,
      brokerId,
      payload: {
        saleId,
        contractAddress,
        tokenId,
        chainId,
        collectionId,
        royaltyAmount,
        royaltyRecipient,
        transactionHash,
      },
    };

    return this.send(NFT_COMPLIANCE_TOPICS.NFT_ROYALTIES, event, transactionHash);
  }

  /**
   * Publish royalty compliance check event
   */
  async publishRoyaltyComplianceCheck(
    collectionId: string,
    contractAddress: string,
    chainId: number,
    isCompliant: boolean,
    totalRoyaltiesPaid: string,
    totalRoyaltiesOwed: string,
    unpaidRoyalties: string,
    enforcementType: 'on_chain' | 'marketplace' | 'none',
    tenantId: string,
    brokerId?: string
  ): Promise<RecordMetadata[]> {
    const event = {
      eventId: uuidv4(),
      eventType: 'nft.royalty.compliance_check' as const,
      timestamp: new Date(),
      version: '1.0',
      source: 'nft-compliance-service',
      tenantId,
      brokerId,
      payload: {
        collectionId,
        contractAddress,
        chainId,
        isCompliant,
        totalRoyaltiesPaid,
        totalRoyaltiesOwed,
        unpaidRoyalties,
        enforcementType,
      },
    };

    return this.send(NFT_COMPLIANCE_TOPICS.NFT_ROYALTIES, event, collectionId);
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
export async function resetEventProducer(): Promise<void> {
  if (eventProducerInstance) {
    await eventProducerInstance.disconnect();
    eventProducerInstance = null;
  }
}

export default getEventProducer;
