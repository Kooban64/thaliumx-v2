/**
 * Workflow Orchestrator Tests
 * 
 * Tests for the workflow orchestrator service including:
 * - Starting workflows
 * - Getting workflow status
 * - Retrying workflows
 * - Cancelling workflows
 */

import { WorkflowOrchestratorService } from '../../services/workflow-orchestrator';
import { _WorkflowType, WorkflowStatus } from '../../types/workflow';
import { DatabaseService } from '../../services/database';

// Mock dependencies
jest.mock('../../services/database');
jest.mock('../../services/logger');
jest.mock('../../services/event-streaming');

describe('WorkflowOrchestratorService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startWorkflow', () => {
    it('should start a workflow successfully', async () => {
      // Mock workflow implementation
      const mockWorkflow = jest.fn().mockResolvedValue([
        {
          name: 'step1',
          execute: async () => ({ result: 'step1' })
        }
      ]);

      WorkflowOrchestratorService.registerWorkflow(
        WorkflowType.USER_ONBOARDING,
                mockWorkflow
      );

      const input = {
        workflowType: WorkflowType.USER_ONBOARDING,
        data: {
          email: 'test@example.com',
          username: 'testuser'
        }
      };

      const result = await WorkflowOrchestratorService.startWorkflow(input);

      expect(result.workflowId).toBeDefined();
      expect(result.workflowType).toBe(WorkflowType.USER_ONBOARDING);
    });

    it('should fail if workflow not registered', async () => {
      const input = {
        workflowType: 'non_existent_workflow' as any,
        data: {}
      };

      await expect(
        WorkflowOrchestratorService.startWorkflow(input)
      ).rejects.toThrow('Workflow implementation not found');
    });
  });

  describe('getWorkflowStatus', () => {
    it('should return workflow status', async () => {
      const mockState = {
        workflowId: 'test-workflow',
        workflowType: WorkflowType.USER_ONBOARDING,
        status: WorkflowStatus.RUNNING,
        currentStep: 'step1',
        stepIndex: 0,
        data: {},
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const WorkflowStateModel = {
        findByPk: jest.fn().mockResolvedValue({
          toJSON: () => mockState
        })
      };

      (DatabaseService.getModel as jest.Mock).mockReturnValue(WorkflowStateModel);

      const status = await WorkflowOrchestratorService.getWorkflowStatus('test-workflow');

      expect(status).toBeDefined();
      expect(status?.workflowId).toBe('test-workflow');
    });

    it('should return null if workflow not found', async () => {
      const WorkflowStateModel = {
        findByPk: jest.fn().mockResolvedValue(null)
      };

      (DatabaseService.getModel as jest.Mock).mockReturnValue(WorkflowStateModel);

      const status = await WorkflowOrchestratorService.getWorkflowStatus('non-existent');

      expect(status).toBeNull();
    });
  });

  describe('cancelWorkflow', () => {
    it('should cancel a running workflow', async () => {
      const mockState = {
        workflowId: 'test-workflow',
        status: WorkflowStatus.RUNNING
      };

      const WorkflowStateModel = {
        findByPk: jest.fn().mockResolvedValue({
          toJSON: () => mockState
        }),
        update: jest.fn().mockResolvedValue([1])
      };

      (DatabaseService.getModel as jest.Mock).mockReturnValue(WorkflowStateModel);

      await WorkflowOrchestratorService.cancelWorkflow('test-workflow', 'User requested');

      expect(WorkflowStateModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: WorkflowStatus.CANCELLED
        }),
        expect.any(Object)
      );
    });

    it('should fail if workflow is already completed', async () => {
      const mockState = {
        workflowId: 'test-workflow',
        status: WorkflowStatus.COMPLETED
      };

      const WorkflowStateModel = {
        findByPk: jest.fn().mockResolvedValue({
          toJSON: () => mockState
        })
      };

      (DatabaseService.getModel as jest.Mock).mockReturnValue(WorkflowStateModel);

      await expect(
        WorkflowOrchestratorService.cancelWorkflow('test-workflow', 'Reason')
      ).rejects.toThrow('Cannot cancel completed workflow');
    });
  });
});
