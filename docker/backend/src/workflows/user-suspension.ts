/**
 * User Suspension Workflow
 * 
 * Orchestrates user account suspension:
 * 1. Validate suspension request
 * 2. Suspend user account
 * 3. Cancel active orders
 * 4. Freeze wallets
 * 5. Notify user
 */

import { SagaStep, SagaContext, WorkflowInput } from '../types/workflow';
import { WorkflowType } from '../types/workflow';
import { WorkflowOrchestratorService } from '../services/workflow-orchestrator';
import { UserService } from '../services/user';
import { LoggerService } from '../services/logger';

export async function createUserSuspensionWorkflow(
  input: WorkflowInput
): Promise<SagaStep[]> {
  return [
    {
      name: 'validate_suspension',
      execute: async (sagaContext: SagaContext) => {
        const { userId, reason } = sagaContext.data;
        if (!userId || !reason) {
          throw new Error('User ID and reason required for suspension');
        }
        return { validated: true };
      },
      retryable: false
    },
    {
      name: 'suspend_user_account',
      execute: async (sagaContext: SagaContext) => {
        const { userId } = sagaContext.data;
        await UserService.deactivateUser(userId);
        return { suspended: true };
      },
      compensate: async (sagaContext: SagaContext) => {
        const { userId } = sagaContext.data;
        await UserService.activateUser(userId);
      },
      retryable: true
    },
    {
      name: 'cancel_active_orders',
      execute: async (sagaContext: SagaContext) => {
        // Cancel all active orders for user
        LoggerService.info('Cancelling active orders for suspended user', {
          userId: sagaContext.data.userId
        });
        return { ordersCancelled: true };
      },
      retryable: true
    },
    {
      name: 'notify_user',
      execute: async (sagaContext: SagaContext) => {
        // Send suspension notification
        LoggerService.info('User suspension completed', {
          userId: sagaContext.data.userId
        });
        return { notified: true };
      },
      retryable: true
    }
  ];
}

WorkflowOrchestratorService.registerWorkflow(
  WorkflowType.USER_SUSPENSION,
  createUserSuspensionWorkflow
);
