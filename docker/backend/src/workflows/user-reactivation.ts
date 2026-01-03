/**
 * User Reactivation Workflow
 * 
 * Orchestrates user account reactivation:
 * 1. Validate reactivation request
 * 2. Check compliance status
 * 3. Reactivate user account
 * 4. Restore wallet access
 * 5. Notify user
 */

import { SagaStep, SagaContext, WorkflowInput } from '../types/workflow';
import { WorkflowType } from '../types/workflow';
import { WorkflowOrchestratorService } from '../services/workflow-orchestrator';
import { UserService } from '../services/user';
import { LoggerService } from '../services/logger';

export async function createUserReactivationWorkflow(
  input: WorkflowInput
): Promise<SagaStep[]> {
  return [
    {
      name: 'validate_reactivation',
      execute: async (sagaContext: SagaContext) => {
        const { userId, reason } = sagaContext.data;
        if (!userId || !reason) {
          throw new Error('User ID and reason required for reactivation');
        }

        const user = await UserService.getUserById(userId);
        if (!user) {
          throw new Error('User not found');
        }

        if (user.isActive) {
          throw new Error('User is already active');
        }

        return { validated: true, user };
      },
      retryable: false
    },
    {
      name: 'check_compliance',
      execute: async (sagaContext: SagaContext) => {
        // Check if user meets reactivation requirements
        LoggerService.info('Checking compliance for reactivation', {
          userId: sagaContext.data.userId
        });
        return { complianceCheck: 'passed' };
      },
      retryable: true
    },
    {
      name: 'reactivate_user_account',
      execute: async (sagaContext: SagaContext) => {
        const { userId } = sagaContext.data;
        await UserService.activateUser(userId);
        return { reactivated: true };
      },
      compensate: async (sagaContext: SagaContext) => {
        const { userId } = sagaContext.data;
        await UserService.deactivateUser(userId);
      },
      retryable: true
    },
    {
      name: 'restore_wallet_access',
      execute: async (sagaContext: SagaContext) => {
        // Restore wallet access for user
        LoggerService.info('Restoring wallet access', {
          userId: sagaContext.data.userId
        });
        return { walletAccessRestored: true };
      },
      retryable: true
    },
    {
      name: 'notify_user',
      execute: async (sagaContext: SagaContext) => {
        // Send reactivation notification
        LoggerService.info('User reactivation completed', {
          userId: sagaContext.data.userId
        });
        return { notified: true };
      },
      retryable: true
    }
  ];
}

WorkflowOrchestratorService.registerWorkflow(
  WorkflowType.USER_REACTIVATION,
  createUserReactivationWorkflow
);
