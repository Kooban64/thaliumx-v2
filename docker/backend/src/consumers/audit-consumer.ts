/**
 * Audit Consumer
 * 
 * Consumes audit events for compliance and security:
 * - Audit trail events (thaliumx.audit)
 * - Transaction events (thaliumx.transactions)
 * 
 * Stores events in audit database for compliance reporting
 */

import type { EachMessagePayload } from 'kafkajs';
import { BaseKafkaConsumer } from '../services/kafka-consumer-framework';
import type { MessageContext } from '../services/kafka-consumer-framework';
import { LoggerService } from '../services/logger';
import { DatabaseService } from '../services/database';
import { EventStreamingService } from '../services/event-streaming';

export class AuditConsumer extends BaseKafkaConsumer {
  constructor() {
    super({
      groupId: 'thaliumx-audit-consumer',
      topics: [
        'thaliumx.audit',
        'thaliumx.transactions'
      ],
      fromBeginning: false,
      maxPollRecords: 100,
      enableAutoCommit: false
    });
  }

  protected async handleMessage(payload: EachMessagePayload): Promise<void> {
    await this.processMessage(payload, async (message: any, context: MessageContext) => {
      switch (context.topic) {
        case 'thaliumx.audit':
          await this.handleAuditEvent(message, context);
          break;
        case 'thaliumx.transactions':
          await this.handleTransactionEvent(message, context);
          break;
        default:
          LoggerService.warn('Unknown audit topic', { topic: context.topic });
      }
    });
  }

  private async handleAuditEvent(message: any, _context: MessageContext): Promise<void> {
    try {
      LoggerService.debug('Processing audit event', {
        eventId: message.metadata?.eventId,
        action: message.metadata?.action,
        resource: message.metadata?.resource
      });

      // Store in audit database
      const AuditModel: any = DatabaseService.getModel('AuditLog');
      if (AuditModel) {
        await AuditModel.create({
          eventId: message.metadata?.eventId,
          eventType: message.metadata?.eventType,
          action: message.metadata?.action,
          resource: message.metadata?.resource,
          resourceId: message.metadata?.resourceId,
          userId: message.metadata?.userId,
          tenantId: message.metadata?.tenantId,
          timestamp: message.metadata?.timestamp || new Date(),
          payload: message.payload,
          ipAddress: message.metadata?.ipAddress,
          userAgent: message.metadata?.userAgent,
          source: message.metadata?.source || 'thaliumx-backend'
        });
      }

      // Check for compliance triggers
      if (message.metadata?.action?.includes('transaction') || message.metadata?.action?.includes('kyc')) {
        await EventStreamingService.emitComplianceEvent(
          'AML',
          'transaction_monitoring',
          message.payload,
          'pending',
          { correlationId: message.metadata?.correlationId }
        );
      }
    } catch (error) {
      LoggerService.error('Failed to process audit event', {
        eventId: message.metadata?.eventId,
        error
      });
      throw error;
    }
  }

  private async handleTransactionEvent(message: any, _context: MessageContext): Promise<void> {
    try {
      LoggerService.debug('Processing transaction event', {
        eventId: message.metadata?.eventId,
        transactionType: message.metadata?.transactionType,
        transactionId: message.payload?.transactionId
      });

      // Store in transaction audit log
      const TransactionAuditModel: any = DatabaseService.getModel('TransactionAudit');
      if (TransactionAuditModel) {
        await TransactionAuditModel.create({
          eventId: message.metadata?.eventId,
          transactionId: message.payload?.transactionId,
          transactionType: message.metadata?.transactionType,
          amount: message.payload?.amount,
          currency: message.payload?.currency,
          status: message.payload?.status,
          userId: message.metadata?.userId,
          tenantId: message.metadata?.tenantId,
          timestamp: message.metadata?.timestamp || new Date(),
          metadata: message.payload?.metadata
        });
      }

      // Trigger high-value transaction review
      if (message.payload?.amount > 10000) {
        await EventStreamingService.emitComplianceEvent(
          'AML',
          'high_value_transaction',
          message.payload,
          'pending',
          { correlationId: message.metadata?.correlationId },
          'High-value transaction requires additional review'
        );
      }
    } catch (error) {
      LoggerService.error('Failed to process transaction event', {
        eventId: message.metadata?.eventId,
        error
      });
      throw error;
    }
  }
}
