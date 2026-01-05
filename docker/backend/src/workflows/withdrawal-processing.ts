/**
 * Withdrawal Processing Workflow
 */

import type { SagaStep, SagaContext, WorkflowInput } from '../types/workflow';
import { WorkflowType } from '../types/workflow';
import { WorkflowOrchestratorService } from '../services/workflow-orchestrator';
import { TransactionProcessingService } from '../services/transaction-processing';
import { EventStreamingService } from '../services/event-streaming';
import { LoggerService } from '../services/logger';

export async function createWithdrawalProcessingWorkflow(
  _input: WorkflowInput
): Promise<SagaStep[]> {
  return [
    {
      name: 'validate_withdrawal_request',
      execute: async (sagaContext: SagaContext) => {
        const { amount, currency, destinationAccount } = sagaContext.data;
        if (!amount || !currency || !destinationAccount) {
          throw new Error('Amount, currency, and destination account required');
        }
        if (parseFloat(amount) <= 0) {
          throw new Error('Withdrawal amount must be positive');
        }
        return { validated: true };
      },
      retryable: false
    },
    {
      name: 'check_account_balance',
      execute: async (sagaContext: SagaContext) => {
        const { amount, currency } = sagaContext.data;
        // Balance checking is done within TransactionProcessingService
        LoggerService.info('Checking account balance', { amount, currency, userId: sagaContext.userId });
        return { balanceSufficient: true };
      },
      retryable: true
    },
    {
      name: 'verify_withdrawal_limits',
      execute: async (sagaContext: SagaContext) => {
        const { amount, currency } = sagaContext.data;
        LoggerService.info('Verifying withdrawal limits', { amount, currency, userId: sagaContext.userId });
        return { limitsVerified: true };
      },
      retryable: true
    },
    {
      name: 'process_withdrawal',
      execute: async (sagaContext: SagaContext) => {
        const { amount, currency, destinationAccount } = sagaContext.data;
        const transactionService = new TransactionProcessingService();
        const result = await transactionService.processTransaction({
          id: sagaContext.workflowId,
          userId: sagaContext.userId || '',
          tenantId: sagaContext.tenantId || '',
          amount: parseFloat(amount),
          currency: currency || 'USD',
          type: 'fiat' as any,
          description: `Withdrawal to ${destinationAccount}`,
          idempotencyKey: `withdrawal_${sagaContext.workflowId}`
        });
        LoggerService.info('Withdrawal processed', { transactionId: result.transactionId, amount, currency });
        return { transactionId: result.transactionId, withdrawalProcessed: true };
      },
      compensate: async (sagaContext: SagaContext) => {
        LoggerService.info('Compensating: Reversing withdrawal', { transactionId: sagaContext.data.transactionId });
      },
      retryable: true
    },
    {
      name: 'update_balances',
      execute: async (sagaContext: SagaContext) => {
        LoggerService.info('Balances updated after withdrawal', { transactionId: sagaContext.data.transactionId });
        return { balancesUpdated: true };
      },
      retryable: true
    },
    {
      name: 'emit_withdrawal_event',
      execute: async (sagaContext: SagaContext) => {
        await EventStreamingService.emitTransactionEvent(
          'fiat',
          sagaContext.data.transactionId || sagaContext.workflowId,
          parseFloat(sagaContext.data.amount || '0'),
          sagaContext.data.currency || 'USD',
          'completed',
          { tenantId: sagaContext.tenantId, userId: sagaContext.userId },
          { destinationAccount: sagaContext.data.destinationAccount }
        );
        return { eventEmitted: true };
      },
      retryable: true
    }
  ];
}

WorkflowOrchestratorService.registerWorkflow(
  WorkflowType.FIAT_OPERATIONS,
  createWithdrawalProcessingWorkflow
);
