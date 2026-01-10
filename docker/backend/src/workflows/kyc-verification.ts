/**
 * KYC Verification Workflow
 * 
 * Orchestrates KYC verification process:
 * 1. Validate KYC request
 * 2. Trigger Ballerine workflow
 * 3. Wait for KYC completion
 * 4. Process KYC result
 * 5. Update user status
 * 6. Emit KYC event
 */

import type { SagaStep, SagaContext, WorkflowInput } from '../types/workflow';
import { WorkflowType } from '../types/workflow';
import { WorkflowOrchestratorService } from '../services/workflow-orchestrator';
import { BallerineService } from '../services/ballerine';
import { UserService } from '../services/user';
import { EventStreamingService } from '../services/event-streaming';
// LoggerService imported but not used in this file

export async function createKycVerificationWorkflow(
  _input: WorkflowInput
): Promise<SagaStep[]> {
  return [
    {
      name: 'validate_kyc_request',
      execute: async (sagaContext: SagaContext) => {
        const { userId, kycLevel: _kycLevel } = sagaContext.data;
        if (!userId) {
          throw new Error('User ID required for KYC verification');
        }
        return { validated: true };
      },
      retryable: false
    },
    {
      name: 'trigger_ballerine_workflow',
      execute: async (sagaContext: SagaContext) => {
        const { userId, kycLevel: _kycLevel } = sagaContext.data;
        const ballerineService = new BallerineService();
        
        const user = await UserService.getUserById(userId);
        if (!user) {
          throw new Error('User not found');
        }

        const ballerineWorkflow = await ballerineService.startWorkflow({
          id: sagaContext.workflowId,
          type: 'kyc',
          entity_id: userId,
          entity_data: {
            personalInformation: {
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              phone: user.phone
            }
          },
          tenant_id: sagaContext.tenantId || ''
        });

        return { ballerineWorkflowId: ballerineWorkflow.id };
      },
      retryable: true
    },
    {
      name: 'wait_for_kyc_completion',
      execute: async (sagaContext: SagaContext) => {
        const { ballerineWorkflowId } = sagaContext.stepResults?.get('trigger_ballerine_workflow') || sagaContext.data;
        
        // Check if KYC already completed (webhook may have arrived)
        if (sagaContext.data.kycCompleted === true) {
          const kycResult = sagaContext.data.kycResult;
          if (kycResult?.status === 'approved' || kycResult?.status === 'rejected') {
            return {
              kycStatus: kycResult.status,
                kycResult
            };
          }
        }

        // Poll Ballerine if webhook not received yet
        const ballerineService = new BallerineService();
        const ballerineStatus = await ballerineService.getWorkflowStatus(ballerineWorkflowId);
        
        if (ballerineStatus.status === 'completed' || ballerineStatus.status === 'approved') {
          return {
            kycStatus: 'approved',
            kycResult: {
              status: ballerineStatus.status,
              context: ballerineStatus.context
            }
          };
        }

        if (ballerineStatus.status === 'rejected' || ballerineStatus.status === 'failed') {
          throw new Error(`KYC verification ${ballerineStatus.status}`);
        }

        // Still pending
        throw new Error('KYC completion pending - waiting for webhook');
      },
      retryable: true,
      maxRetries: 30,
      timeout: 300000
    },
    {
      name: 'process_kyc_result',
      execute: async (sagaContext: SagaContext) => {
        const { userId } = sagaContext.data;
        const { kycResult } = sagaContext.stepResults?.get('wait_for_kyc_completion') || sagaContext.data;
        const kycStatus = kycResult?.status === 'approved' ? 'approved' : 'rejected';
        
        // Update user KYC status
        await UserService.updateUser(userId, {
          kycStatus: kycStatus as any,
          kycLevel: sagaContext.data.kycLevel || 'L0' as any
        });

        return { kycProcessed: true, kycStatus };
      },
      retryable: true
    },
    {
      name: 'update_user_status',
      execute: async (sagaContext: SagaContext) => {
        const { userId } = sagaContext.data;
        const { kycStatus } = sagaContext.stepResults?.get('process_kyc_result') || sagaContext.data;
        
        // If KYC approved, mark user as verified
        if (kycStatus === 'approved') {
          await UserService.updateUser(userId, {
            isVerified: true
          });
        }

        return { userStatusUpdated: true };
      },
      retryable: true
    },
    {
      name: 'emit_kyc_event',
      execute: async (sagaContext: SagaContext) => {
        await EventStreamingService.emitAuditEvent(
          'kyc.verification_completed',
          'kyc',
          sagaContext.userId || '',
          {
            userId: sagaContext.userId,
            kycStatus: sagaContext.data.kycStatus,
            kycLevel: sagaContext.data.kycLevel,
            ballerineWorkflowId: sagaContext.data.ballerineWorkflowId
          }
        );
        return { eventEmitted: true };
      },
      retryable: true
    }
  ];
}

WorkflowOrchestratorService.registerWorkflow(
  WorkflowType.KYC_REVERIFICATION,
                createKycVerificationWorkflow
);
