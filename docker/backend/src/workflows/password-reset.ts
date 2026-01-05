/**
 * Password Reset Workflow
 * 
 * Orchestrates password reset process:
 * 1. Validate reset request
 * 2. Generate reset token
 * 3. Send reset email
 * 4. Verify token
 * 5. Update password
 */

import type { SagaStep, SagaContext, WorkflowInput } from '../types/workflow';
import { WorkflowType } from '../types/workflow';
import { WorkflowOrchestratorService } from '../services/workflow-orchestrator';
import { AuthService } from '../services/auth';
// EmailService, LoggerService imported but not used in this file

export async function createPasswordResetWorkflow(
  _input: WorkflowInput
): Promise<SagaStep[]> {
  return [
    {
      name: 'validate_reset_request',
      execute: async (sagaContext: SagaContext) => {
        const { email } = sagaContext.data;
        if (!email) {
          throw new Error('Email required for password reset');
        }
        return { validated: true };
      },
      retryable: false
    },
    {
      name: 'request_password_reset',
      execute: async (sagaContext: SagaContext) => {
        const { email } = sagaContext.data;
        await AuthService.requestPasswordReset(email);
        return { resetRequested: true };
      },
      retryable: true
    },
    {
      name: 'verify_token',
      execute: async (sagaContext: SagaContext) => {
        const { token } = sagaContext.data;
        // Token verification is done in confirmPasswordReset
        // For workflow purposes, we'll check if token exists
        const { RedisService } = await import('../services/redis');
        const userId = await RedisService.getString(`password_reset:${token}`);
        if (!userId) {
          throw new Error('Invalid or expired reset token');
        }
        return { tokenVerified: true, userId };
      },
      retryable: false
    },
    {
      name: 'update_password',
      execute: async (sagaContext: SagaContext) => {
        const { token, newPassword } = sagaContext.data;
        await AuthService.confirmPasswordReset(token, newPassword);
        return { passwordUpdated: true };
      },
      retryable: true
    }
  ];
}

WorkflowOrchestratorService.registerWorkflow(
  WorkflowType.PASSWORD_RESET,
  createPasswordResetWorkflow
);
