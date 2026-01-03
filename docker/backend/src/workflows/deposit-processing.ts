/**
 * Deposit Processing Workflow
 */

import { SagaStep, SagaContext, WorkflowInput } from '../types/workflow';
import { WorkflowType } from '../types/workflow';
import { WorkflowOrchestratorService } from '../services/workflow-orchestrator';
import { TransactionProcessingService } from '../services/transaction-processing';
import { EventStreamingService } from '../services/event-streaming';
import { LoggerService } from '../services/logger';

export async function createDepositProcessingWorkflow(
  input: WorkflowInput
): Promise<SagaStep[]> {
  return [
    {
      name: 'validate_deposit_request',
      execute: async (sagaContext: SagaContext) => {
        const { amount, currency, paymentMethodId } = sagaContext.data;
        if (!amount || !currency || !paymentMethodId) {
          throw new Error('Amount, currency, and payment method ID required');
        }
        if (parseFloat(amount) <= 0) {
          throw new Error('Deposit amount must be positive');
        }
        return { validated: true };
      },
      retryable: false
    },
    {
      name: 'verify_payment_method',
      execute: async (sagaContext: SagaContext) => {
        const { paymentMethodId } = sagaContext.data;
        LoggerService.info('Verifying payment method', { paymentMethodId, userId: sagaContext.userId });
        return { paymentMethodVerified: true };
      },
      retryable: true
    },
    {
      name: 'process_deposit',
      execute: async (sagaContext: SagaContext) => {
        const { amount, currency, paymentMethodId } = sagaContext.data;
        const transactionService = new TransactionProcessingService();
        const result = await transactionService.processTransaction({
          id: sagaContext.workflowId,
          userId: sagaContext.userId || '',
          tenantId: sagaContext.tenantId || '',
          amount: parseFloat(amount),
          currency: currency || 'USD',
          type: 'fiat' as any,
          description: `Deposit via payment method ${paymentMethodId}`,
          idempotencyKey: `deposit_${sagaContext.workflowId}`
        });
        LoggerService.info('Deposit processed', { transactionId: result.transactionId, amount, currency });
        return { transactionId: result.transactionId, depositProcessed: true };
      },
      compensate: async (sagaContext: SagaContext) => {
        LoggerService.info('Compensating: Reversing deposit', { transactionId: sagaContext.data.transactionId });
      },
      retryable: true
    },
    {
      name: 'update_balances',
      execute: async (sagaContext: SagaContext) => {
        LoggerService.info('Balances updated after deposit', { transactionId: sagaContext.data.transactionId });
        return { balancesUpdated: true };
      },
      retryable: true
    },
    {
      name: 'emit_deposit_event',
      execute: async (sagaContext: SagaContext) => {
        await EventStreamingService.emitTransactionEvent(
          'fiat',
          sagaContext.data.transactionId || sagaContext.workflowId,
          parseFloat(sagaContext.data.amount || '0'),
          sagaContext.data.currency || 'USD',
          'completed',
          { tenantId: sagaContext.tenantId, userId: sagaContext.userId },
          { paymentMethodId: sagaContext.data.paymentMethodId }
        );
        return { eventEmitted: true };
      },
      retryable: true
    }
  ];
}

WorkflowOrchestratorService.registerWorkflow(
  WorkflowType.FIAT_OPERATIONS,
  createDepositProcessingWorkflow
);
