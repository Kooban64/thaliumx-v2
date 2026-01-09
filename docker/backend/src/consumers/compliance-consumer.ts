/**
 * Compliance Consumer
 * 
 * Consumes compliance and regulatory events:
 * - Compliance events (thaliumx.compliance)
 * - KYC requests (thaliumx.kyc.requests)
 * - KYC results (thaliumx.kyc.results)
 * - AML screening (thaliumx.aml.screening)
 * - Risk assessment (thaliumx.risk.assessment)
 */

import type { EachMessagePayload } from 'kafkajs';
import type { MessageContext } from '../services/kafka-consumer-framework';
import { BaseKafkaConsumer } from '../services/kafka-consumer-framework';
import { LoggerService } from '../services/logger';
import { EventStreamingService } from '../services/event-streaming';

export class ComplianceConsumer extends BaseKafkaConsumer {
  constructor() {
    super({
      groupId: 'thaliumx-compliance-consumer',
      topics: [
        'thaliumx.compliance',
        'thaliumx.kyc.requests',
        'thaliumx.kyc.results',
        'thaliumx.aml.screening',
        'thaliumx.risk.assessment'
      ],
      fromBeginning: false,
      maxPollRecords: 50,
      enableAutoCommit: false
    });
  }

  protected async handleMessage(payload: EachMessagePayload): Promise<void> {
    await this.processMessage(payload, async (message: any, context: MessageContext) => {
      switch (context.topic) {
        case 'thaliumx.compliance':
          await this.handleComplianceEvent(message, context);
          break;
        case 'thaliumx.kyc.requests':
          await this.handleKYCRequest(message, context);
          break;
        case 'thaliumx.kyc.results':
          await this.handleKYCResult(message, context);
          break;
        case 'thaliumx.aml.screening':
          await this.handleAMLScreening(message, context);
          break;
        case 'thaliumx.risk.assessment':
          await this.handleRiskAssessment(message, context);
          break;
        default:
          LoggerService.warn('Unknown compliance topic', { topic: context.topic });
      }
    });
  }

  private async handleComplianceEvent(message: any, _context: MessageContext): Promise<void> {
    LoggerService.info('Processing compliance event', {
      regulation: message.metadata?.regulation,
      requirement: message.metadata?.requirement,
      status: message.payload?.status
    });

    // Store in compliance database
    // Trigger compliance workflows if needed
    if (message.payload?.status === 'non-compliant') {
      await EventStreamingService.emitSystemEvent(
        'compliance.violation.detected',
        'ComplianceConsumer',
        'error',
        {
          regulation: message.metadata?.regulation,
          requirement: message.metadata?.requirement,
          data: message.payload?.data
        }
      );
    }
  }

  private async handleKYCRequest(message: any, _context: MessageContext): Promise<void> {
    LoggerService.info('Processing KYC request', {
      userId: message.userId,
      kycLevel: message.kycLevel,
      requestId: message.requestId
    });

    // Queue for KYC processing
    // This would trigger Ballerine workflow
  }

  private async handleKYCResult(message: any, _context: MessageContext): Promise<void> {
    LoggerService.info('Processing KYC result', {
      userId: message.userId,
      status: message.status,
      kycLevel: message.kycLevel
    });

    // Update user KYC status
    // Trigger post-KYC workflows
  }

  private async handleAMLScreening(message: any, _context: MessageContext): Promise<void> {
    LoggerService.info('Processing AML screening', {
      userId: message.userId,
      screeningType: message.screeningType,
      result: message.result
    });

    // Store screening results
    // Trigger alerts if matches found
    if (message.result === 'match') {
      await EventStreamingService.emitComplianceEvent(
        'AML',
        'sanctions_screening',
        message,
        'non-compliant',
        { correlationId: message.correlationId },
        'Potential sanctions list match detected'
      );
    }
  }

  private async handleRiskAssessment(message: any, _context: MessageContext): Promise<void> {
    LoggerService.info('Processing risk assessment', {
      userId: message.userId,
      riskScore: message.riskScore,
      riskLevel: message.riskLevel
    });

    // Update user risk profile
    // Trigger risk-based controls
  }
}
