/**
 * Workflow Event Consumer
 * 
 * Handles workflow-related events from Kafka:
 * - Ballerine webhook events (KYC completion) - handled via KYC routes
 * - Service events (order filled, payment completed)
 * - Workflow state updates
 * 
 * This consumer processes events that trigger workflow continuation
 * and updates workflow state accordingly.
 * 
 * Note: EventStreamingService already handles Kafka consumption.
 * This service provides workflow-specific event handlers.
 */

import { WorkflowOrchestratorService } from '../services/workflow-orchestrator';
import { LoggerService } from '../services/logger';
import { WorkflowType } from '../types/workflow';

export class WorkflowConsumer {
  private static isInitialized = false;

  /**
   * Initialize workflow consumer
   * 
   * Note: Event consumption is handled by EventStreamingService.
   * This initializes workflow-specific handlers.
   */
  public static async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    LoggerService.info('Initializing Workflow Consumer...');

    // Workflow event handling is done via:
    // 1. Ballerine webhooks -> KYC routes -> WorkflowOrchestratorService.continueWorkflow
    // 2. Service events -> EventStreamingService -> This consumer's handle methods
    // 3. Direct API calls -> Workflow routes -> WorkflowOrchestratorService

    this.isInitialized = true;
    LoggerService.info('✅ Workflow Consumer initialized successfully');
  }

  /**
   * Handle incoming Kafka message
   */
  private static async handleMessage(topic: string, message: any): Promise<void> {
    const { metadata, payload } = message;

    if (!metadata || !metadata.eventType) {
      LoggerService.warn('Message missing eventType', { topic, message });
      return;
    }

    LoggerService.info('Processing workflow event', {
      topic,
      eventType: metadata.eventType,
      workflowId: payload.workflowId
    });

    // Handle workflow events
    if (metadata.eventType.startsWith('workflow.')) {
      await this.handleWorkflowEvent(metadata.eventType, payload);
      return;
    }

    // Handle service events that trigger workflow continuation
    switch (metadata.eventType) {
      case 'exchange.order.filled':
        await this.handleOrderFilled(payload);
        break;
      case 'transaction.completed':
        await this.handleTransactionCompleted(payload);
        break;
      case 'ballerine.workflow.completed':
        await this.handleBallerineWorkflowCompleted(payload);
        break;
      default:
        LoggerService.debug('Unhandled event type', {
          eventType: metadata.eventType,
          topic
        });
    }
  }

  /**
   * Handle workflow-specific events
   */
  private static async handleWorkflowEvent(eventType: string, payload: any): Promise<void> {
    const { workflowId } = payload;

    if (!workflowId) {
      LoggerService.warn('Workflow event missing workflowId', { eventType, payload });
      return;
    }

    switch (eventType) {
      case 'workflow.step.completed':
        // Step completed - workflow will continue automatically
        LoggerService.info('Workflow step completed', { workflowId });
        break;
      case 'workflow.completed':
        LoggerService.info('Workflow completed', { workflowId });
        break;
      case 'workflow.failed':
        LoggerService.warn('Workflow failed', { workflowId, error: payload.error });
        break;
      default:
        LoggerService.debug('Unhandled workflow event', { eventType, workflowId });
    }
  }

  /**
   * Handle order filled event - continue trading order workflow
   */
  private static async handleOrderFilled(payload: any): Promise<void> {
    const { orderId, filledQuantity, averagePrice } = payload;

    if (!orderId) {
      return;
    }

    LoggerService.info('Order filled event received', {
      orderId,
      filledQuantity,
      averagePrice
    });

    // Find workflow waiting for this order
    // In production, you'd query workflow_states table
    // For now, we'll use a simplified approach
    try {
      // The orderId should match the workflowId or be stored in workflow data
      // This is a simplified implementation - in production, you'd need proper lookup
      const workflows = await WorkflowOrchestratorService.getWorkflowsByUser(
        payload.userId || '',
        {
          status: 'running' as any,
          workflowType: WorkflowType.TRADING_ORDER
        }
      );

      for (const workflow of workflows) {
        if (workflow.data?.orderId === orderId) {
          await WorkflowOrchestratorService.continueWorkflow(
            workflow.workflowId,
            {
              orderFilled: true,
              filledQuantity,
              averagePrice
            },
            'settle_funds'
          );
          break;
        }
      }
    } catch (error: any) {
      LoggerService.error('Failed to continue workflow after order fill', {
        orderId,
        error: error.message
      });
    }
  }

  /**
   * Handle transaction completed event - continue payment workflow
   */
  private static async handleTransactionCompleted(payload: any): Promise<void> {
    const { transactionId } = payload;

    if (!transactionId) {
      return;
    }

    LoggerService.info('Transaction completed event received', {
      transactionId
    });

    // Find workflow waiting for this transaction
    try {
      const workflows = await WorkflowOrchestratorService.getWorkflowsByUser(
        payload.userId || '',
        {
          status: 'running' as any,
          workflowType: WorkflowType.PAYMENT_PROCESSING
        }
      );

      for (const workflow of workflows) {
        if (workflow.workflowId === transactionId || workflow.data?.transactionId === transactionId) {
          await WorkflowOrchestratorService.continueWorkflow(
            workflow.workflowId,
            {
              transactionCompleted: true,
              transactionId
            },
            'verify_settlement'
          );
          break;
        }
      }
    } catch (error: any) {
      LoggerService.error('Failed to continue workflow after transaction', {
        transactionId,
        error: error.message
      });
    }
  }

  /**
   * Handle Ballerine workflow completed event
   */
  private static async handleBallerineWorkflowCompleted(payload: any): Promise<void> {
    const { workflowId, caseId, status, decision } = payload;

    LoggerService.info('Ballerine workflow completed event received', {
      workflowId,
      caseId,
      status
    });

    // This is handled by KYCService.processBallerineWebhook
    // But we can also handle it here for workflow continuation
    // The KYC service will call WorkflowOrchestratorService.continueWorkflow
  }

  /**
   * Close consumer
   */
  public static async close(): Promise<void> {
    this.isInitialized = false;
    LoggerService.info('Workflow Consumer closed');
  }
}
