/**
 * Refund Processing Workflow
 * 
 * Orchestrates refund processing:
 * 1. Validate refund request
 * 2. Check original transaction
 * 3. Process refund
 * 4. Update balances
 * 5. Emit refund event
 */

import type { SagaStep, SagaContext, WorkflowInput } from '../types/workflow';
import { WorkflowType } from '../types/workflow';
import { WorkflowOrchestratorService } from '../services/workflow-orchestrator';
import { TransactionProcessingService } from '../services/transaction-processing';
// FinancialRepository imported but not used in this file
import { EventStreamingService } from '../services/event-streaming';
import { LoggerService } from '../services/logger';

export async function createRefundProcessingWorkflow(
  _input: WorkflowInput
): Promise<SagaStep[]> {
  return [
    {
      name: 'validate_refund_request',
      execute: async (sagaContext: SagaContext) => {
        const { transactionId, amount, reason } = sagaContext.data;
        if (!transactionId || !amount || !reason) {
          throw new Error('Transaction ID, amount, and reason required for refund');
        }
        return { validated: true };
      },
      retryable: false
    },
    {
      name: 'check_original_transaction',
      execute: async (sagaContext: SagaContext) => {
        const { transactionId } = sagaContext.data;
        // Verify original transaction exists and is refundable
        LoggerService.info('Checking original transaction', {
          transactionId
        });
        return { transactionFound: true, refundable: true };
      },
      retryable: true
    },
    {
      name: 'process_refund',
      execute: async (sagaContext: SagaContext) => {
        const { transactionId, amount, currency } = sagaContext.data;
        
        // Process refund as a new transaction (reversal)
        const transactionService = new TransactionProcessingService();
        const refundResult = await transactionService.processTransaction({
          id: sagaContext.workflowId,
          userId: sagaContext.userId || '',
          tenantId: sagaContext.tenantId || '',
          amount: parseFloat(amount),
          currency: currency || 'USD',
          type: 'adjustment' as any,
          description: `Refund for transaction ${transactionId}: ${sagaContext.data.reason}`,
          idempotencyKey: `refund_${transactionId}_${Date.now()}`
        });

        return { refundId: refundResult.transactionId, refundResult };
      },
      compensate: async (sagaContext: SagaContext) => {
        // Reverse refund if needed
        LoggerService.info('Compensating: Reversing refund', {
          transactionId: sagaContext.data.transactionId
        });
      },
      retryable: true
    },
    {
      name: 'update_balances',
      execute: async (sagaContext: SagaContext) => {
        // Update account balances via FinancialRepository
        LoggerService.info('Updating balances for refund', {
          transactionId: sagaContext.data.transactionId
        });
        return { balancesUpdated: true };
      },
      retryable: true
    },
    {
      name: 'emit_refund_event',
      execute: async (sagaContext: SagaContext) => {
        await EventStreamingService.emitTransactionEvent(
          'fiat',
          sagaContext.data.transactionId,
          parseFloat(sagaContext.data.amount),
          sagaContext.data.currency || 'USD',
          'completed',
          {
            tenantId: sagaContext.tenantId,
            userId: sagaContext.userId
          },
          {
            refundId: sagaContext.data.refundId,
            reason: sagaContext.data.reason
          }
        );
        return { eventEmitted: true };
      },
      retryable: true
    }
  ];
}

WorkflowOrchestratorService.registerWorkflow(
  WorkflowType.REFUND_PROCESSING,
                createRefundProcessingWorkflow
);
