/**
 * Workflow Integration Tests
 * 
 * End-to-end tests for workflow execution including:
 * - Complete workflow lifecycle
 * - Event-driven continuation
 * - Error recovery
 */

import { WorkflowOrchestratorService } from '../../services/workflow-orchestrator';
import { WorkflowType } from '../../types/workflow';
import { DatabaseService } from '../../services/database';

// Mock all external services
jest.mock('../../services/database');
jest.mock('../../services/logger');
jest.mock('../../services/event-streaming');
jest.mock('../../services/user');
jest.mock('../../services/ballerine');
jest.mock('../../services/wallet-system');
jest.mock('../../services/email');

describe('Workflow Integration Tests', () => {
  beforeEach(async () => {
    await WorkflowOrchestratorService.initialize();
  });

  describe('User Onboarding Workflow', () => {
    it('should execute complete onboarding workflow', async () => {
      const input = {
        workflowType: WorkflowType.USER_ONBOARDING,
        data: {
          email: 'integration@example.com',
          username: 'integrationuser',
          firstName: 'Integration',
          lastName: 'Test',
          phoneNumber: '+1234567890',
          kycCompleted: true, // Simulate KYC already complete
          kycResult: {
            status: 'approved',
            isValid: true
          }
        }
      };

      const result = await WorkflowOrchestratorService.startWorkflow(input);

      expect(result.workflowId).toBeDefined();
      expect(result.status).toBeDefined();
    });
  });

  describe('Workflow State Persistence', () => {
    it('should persist workflow state', async () => {
      const input = {
        workflowType: WorkflowType.ORDER_CANCELLATION,
        data: {
          orderId: 'test-order-123'
        }
      };

      const result = await WorkflowOrchestratorService.startWorkflow(input);

      const status = await WorkflowOrchestratorService.getWorkflowStatus(result.workflowId);

      expect(status).toBeDefined();
      expect(status?.workflowId).toBe(result.workflowId);
    });
  });

  describe('Workflow Continuation', () => {
    it('should continue workflow from event', async () => {
      const input = {
        workflowType: WorkflowType.USER_ONBOARDING,
        data: {
          email: 'continue@example.com',
          username: 'continueuser',
          firstName: 'Continue',
          lastName: 'Test',
          phoneNumber: '+1234567890'
        }
      };

      const result = await WorkflowOrchestratorService.startWorkflow(input);

      // Simulate KYC completion event
      await WorkflowOrchestratorService.continueWorkflow(
        result.workflowId,
        {
          kycCompleted: true,
          kycResult: {
            status: 'approved',
            isValid: true
          }
        },
        'create_user_account'
      );

      const status = await WorkflowOrchestratorService.getWorkflowStatus(result.workflowId);
      expect(status).toBeDefined();
    });
  });
});
