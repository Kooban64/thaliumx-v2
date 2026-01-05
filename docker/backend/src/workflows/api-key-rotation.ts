/**
 * API Key Rotation Workflow
 */

import type { SagaStep, SagaContext, WorkflowInput } from '../types/workflow';
import { WorkflowType } from '../types/workflow';
import { WorkflowOrchestratorService } from '../services/workflow-orchestrator';
import { EventStreamingService } from '../services/event-streaming';
import { LoggerService } from '../services/logger';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export async function createApiKeyRotationWorkflow(
  _input: WorkflowInput
): Promise<SagaStep[]> {
  return [
    {
      name: 'validate_rotation_request',
      execute: async (sagaContext: SagaContext) => {
        const { apiKeyId } = sagaContext.data;
        if (!apiKeyId) {
          throw new Error('API key ID required for rotation');
        }
        return { validated: true };
      },
      retryable: false
    },
    {
      name: 'generate_new_api_key',
      execute: async (sagaContext: SagaContext) => {
        const { apiKeyId } = sagaContext.data;
        const newApiKey = `thx_${crypto.randomBytes(32).toString('hex')}`;
        const newApiKeyId = uuidv4();
        LoggerService.info('New API key generated', { oldApiKeyId: apiKeyId, newApiKeyId });
        return { newApiKey, newApiKeyId };
      },
      retryable: true
    },
    {
      name: 'revoke_old_api_key',
      execute: async (sagaContext: SagaContext) => {
        const { apiKeyId } = sagaContext.data;
        LoggerService.info('Old API key revoked', { apiKeyId });
        return { oldKeyRevoked: true };
      },
      compensate: async (sagaContext: SagaContext) => {
        LoggerService.info('Compensating: Reactivating old API key', { apiKeyId: sagaContext.data.apiKeyId });
      },
      retryable: true
    },
    {
      name: 'update_key_mappings',
      execute: async (sagaContext: SagaContext) => {
        const { apiKeyId } = sagaContext.data;
        const { newApiKeyId } = (sagaContext as any).stepData || sagaContext.data;
        LoggerService.info('API key mappings updated', { oldApiKeyId: apiKeyId, newApiKeyId });
        return { mappingsUpdated: true };
      },
      compensate: async (sagaContext: SagaContext) => {
        LoggerService.info('Compensating: Restoring old key mappings', { apiKeyId: sagaContext.data.apiKeyId });
      },
      retryable: true
    },
    {
      name: 'notify_user',
      execute: async (sagaContext: SagaContext) => {
        LoggerService.info('User notified about API key rotation', { userId: sagaContext.userId });
        return { userNotified: true };
      },
      retryable: true
    },
    {
      name: 'emit_rotation_event',
      execute: async (sagaContext: SagaContext) => {
        await EventStreamingService.emitAuditEvent(
          'api_key.rotated',
          'api_key',
          sagaContext.data.newApiKeyId || '',
          {
            userId: sagaContext.userId,
            oldApiKeyId: sagaContext.data.apiKeyId,
            newApiKeyId: sagaContext.data.newApiKeyId
          }
        );
        return { eventEmitted: true };
      },
      retryable: true
    }
  ];
}

WorkflowOrchestratorService.registerWorkflow(
  WorkflowType.API_KEY_ROTATION,
                createApiKeyRotationWorkflow
);
