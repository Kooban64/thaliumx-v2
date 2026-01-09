/**
 * Workflow Event Consumer
 * 
 * Handles workflow-related events from Kafka with saga pattern support:
 * - Workflow events (workflow.step.completed, workflow.completed, workflow.failed)
 * - Service events (order filled, payment completed, transaction completed)
 * - Saga compensation events
 * - Workflow state transitions via Kafka events
 * 
 * Integrates with WorkflowOrchestratorService for saga execution
 */

import type { EachMessagePayload } from 'kafkajs';
import type { MessageContext } from '../services/kafka-consumer-framework';
import { BaseKafkaConsumer } from '../services/kafka-consumer-framework';
import { WorkflowOrchestratorService } from '../services/workflow-orchestrator';
import { LoggerService } from '../services/logger';
import { EventStreamingService } from '../services/event-streaming';
import { WorkflowType } from '../types/workflow';

export class WorkflowConsumer extends BaseKafkaConsumer {
  constructor() {
    super({
      groupId: 'thaliumx-workflow-consumer',
      topics: [
        'thaliumx.workflows',
        'thaliumx.workflows.saga',
        'thaliumx.workflows.compensation',
        'thaliumx.transactions', // For transaction completion events
        'trades', // For order filled events
        'orders' // For order status updates
      ],
      fromBeginning: false,
      maxPollRecords: 50,
      enableAutoCommit: false,
      retryPolicy: {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2
      }
    });
  }

  protected async handleMessage(payload: EachMessagePayload): Promise<void> {
    await this.processMessage(payload, async (message: any, context: MessageContext) => {
      const eventType = message.metadata?.eventType || message.eventType;

      // Handle workflow-specific events
      if (eventType?.startsWith('workflow.')) {
        await this.handleWorkflowEvent(message, context);
        return;
      }

      // Handle saga events
      if (context.topic.includes('saga') || eventType?.includes('saga')) {
        await this.handleSagaEvent(message, context);
        return;
      }

      // Handle compensation events
      if (context.topic.includes('compensation') || eventType?.includes('compensation')) {
        await this.handleCompensationEvent(message, context);
        return;
      }

      // Handle service events that trigger workflow continuation
      switch (eventType) {
        case 'exchange.order.filled':
        case 'order.filled':
          await this.handleOrderFilled(message, context);
          break;
        case 'transaction.completed':
          await this.handleTransactionCompleted(message, context);
          break;
        case 'ballerine.workflow.completed':
          await this.handleBallerineWorkflowCompleted(message, context);
          break;
        default:
          LoggerService.debug('Unhandled workflow event type', {
            eventType,
            topic: context.topic
          });
      }
    });
  }

  /**
   * Handle workflow-specific events
   */
  private async handleWorkflowEvent(message: any, _context: MessageContext): Promise<void> {
    const eventType = message.metadata?.eventType || message.eventType;
    const payload = message.payload || message;
    const { workflowId } = payload;

    if (!workflowId) {
      LoggerService.warn('Workflow event missing workflowId', { eventType, payload });
      return;
    }

    switch (eventType) {
      case 'workflow.step.completed':
        await this.handleStepCompleted(workflowId, payload);
        break;
      case 'workflow.completed':
        await this.handleWorkflowCompleted(workflowId, payload);
        break;
      case 'workflow.failed':
        await this.handleWorkflowFailed(workflowId, payload);
        break;
      case 'workflow.step.started':
        LoggerService.info('Workflow step started', { workflowId, step: payload.step });
        break;
      default:
        LoggerService.debug('Unhandled workflow event', { eventType, workflowId });
    }
  }

  /**
   * Handle saga events (choreography-based sagas)
   */
  private async handleSagaEvent(message: any, _context: MessageContext): Promise<void> {
    const payload = message.payload || message;
    const { sagaId, step, action, data } = payload;

      LoggerService.info('Processing saga event', {
        sagaId,
        step,
        action,
        topic: _context.topic
      });

    // Emit saga step event to trigger next step
    await EventStreamingService.emitSystemEvent(
      `saga.${step}.${action}`,
      'WorkflowConsumer',
      'info',
      {
        sagaId,
        step,
        action,
        data
      }
    );
  }

  /**
   * Handle compensation events (saga rollback)
   */
  private async handleCompensationEvent(message: any, _context: MessageContext): Promise<void> {
    const payload = message.payload || message;
    const { workflowId, step, reason } = payload;

    LoggerService.warn('Processing compensation event', {
      workflowId,
      step,
      reason
    });

    // Trigger compensation via WorkflowOrchestratorService
    try {
      await WorkflowOrchestratorService.compensateWorkflow(workflowId, step, reason);
    } catch (error) {
      LoggerService.error('Failed to compensate workflow', {
        workflowId,
        step,
        error
      });
      throw error;
    }
  }

  /**
   * Handle workflow step completed
   */
  private async handleStepCompleted(workflowId: string, payload: any): Promise<void> {
    LoggerService.info('Workflow step completed', {
      workflowId,
      step: payload.step,
      result: payload.result
    });

    // Continue workflow to next step
    try {
      await WorkflowOrchestratorService.continueWorkflow(
        workflowId,
        payload.result || {},
        payload.nextStep
      );
    } catch (error) {
      LoggerService.error('Failed to continue workflow after step completion', {
        workflowId,
        error
      });
      throw error;
    }
  }

  /**
   * Handle workflow completed
   */
  private async handleWorkflowCompleted(workflowId: string, payload: any): Promise<void> {
    LoggerService.info('Workflow completed', {
      workflowId,
      result: payload.result
    });

    // Emit completion event
    await EventStreamingService.emitSystemEvent(
      'workflow.completed',
      'WorkflowConsumer',
      'info',
      {
        workflowId,
        result: payload.result
      }
    );
  }

  /**
   * Handle workflow failed
   */
  private async handleWorkflowFailed(workflowId: string, payload: any): Promise<void> {
    LoggerService.warn('Workflow failed', {
      workflowId,
      error: payload.error,
      step: payload.step
    });

    // Trigger compensation if enabled
    if (payload.enableCompensation) {
      await EventStreamingService.emitSystemEvent(
        'workflow.compensation.required',
        'WorkflowConsumer',
        'error',
        {
          workflowId,
          step: payload.step,
          error: payload.error
        }
      );
    }
  }

  /**
   * Handle order filled event - continue trading order workflow
   */
  private async handleOrderFilled(message: any, _context: MessageContext): Promise<void> {
    const payload = message.payload || message;
    const { orderId, filledQuantity, averagePrice, userId } = payload;

    if (!orderId) {
      return;
    }

    LoggerService.info('Order filled event received', {
      orderId,
      filledQuantity,
      averagePrice
    });

    try {
      // Find workflow waiting for this order
      const workflows = await WorkflowOrchestratorService.getWorkflowsByUser(
        userId || '',
        {
          status: 'running' as any,
          workflowType: WorkflowType.TRADING_ORDER
        }
      );

      for (const workflow of workflows) {
        if (workflow.data?.orderId === orderId || workflow.workflowId === orderId) {
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
      throw error;
    }
  }

  /**
   * Handle transaction completed event - continue payment workflow
   */
  private async handleTransactionCompleted(message: any, _context: MessageContext): Promise<void> {
    const payload = message.payload || message;
    const { transactionId, userId } = payload;

    if (!transactionId) {
      return;
    }

    LoggerService.info('Transaction completed event received', {
      transactionId
    });

    try {
      const workflows = await WorkflowOrchestratorService.getWorkflowsByUser(
        userId || '',
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
      throw error;
    }
  }

  /**
   * Handle Ballerine workflow completed event
   */
  private async handleBallerineWorkflowCompleted(message: any, _context: MessageContext): Promise<void> {
    const payload = message.payload || message;
    const { workflowId, caseId, status, userId } = payload;

    LoggerService.info('Ballerine workflow completed event received', {
      workflowId,
      caseId,
      status
    });

    // Find KYC workflow and continue
    try {
      const workflows = await WorkflowOrchestratorService.getWorkflowsByUser(
        userId || '',
        {
          status: 'running' as any,
          workflowType: WorkflowType.KYC_VERIFICATION
        }
      );

      for (const workflow of workflows) {
        if (workflow.data?.caseId === caseId || workflow.data?.ballerineWorkflowId === workflowId) {
          await WorkflowOrchestratorService.continueWorkflow(
            workflow.workflowId,
            {
              kycCompleted: true,
              status,
              caseId,
              ballerineWorkflowId: workflowId
            },
            'update_kyc_status'
          );
          break;
        }
      }
    } catch (error: any) {
      LoggerService.error('Failed to continue workflow after KYC completion', {
        workflowId,
        caseId,
        error: error.message
      });
      throw error;
    }
  }
}
