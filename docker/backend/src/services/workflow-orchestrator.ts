/**
 * Workflow Orchestrator Service
 * 
 * Centralized workflow orchestration service for managing all business workflows.
 * 
 * Features:
 * - Workflow state persistence in PostgreSQL
 * - Saga pattern execution with compensation support
 * - Retry logic with exponential backoff
 * - Event emission (Kafka integration)
 * - Integration with existing services
 * - Ballerine integration for KYC steps
 * - Workflow registry for dynamic workflow loading
 * 
 * Architecture:
 * - Each workflow is a saga with multiple steps
 * - Steps can have compensation functions for rollback
 * - Workflow state is persisted after each step
 * - Events are emitted for monitoring and async operations
 */

import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from './database';
import { LoggerService } from './logger';
import { EventStreamingService } from './event-streaming';
import { SupportService } from './support';
import { SagaExecutor } from '../utils/saga-executor';
import type {
  WorkflowState,
  WorkflowInput,
  WorkflowResult,
  SagaStep,
  SagaContext,
                WorkflowExecutionOptions
} from '../types/workflow';
import {
  WorkflowType,
                WorkflowStatus
} from '../types/workflow';

// Workflow registry - maps workflow types to their implementations
type WorkflowImplementation = (input: WorkflowInput) => Promise<SagaStep[]>;

export class WorkflowOrchestratorService {
  private static workflowRegistry: Map<WorkflowType, WorkflowImplementation> = new Map();
  private static isInitialized = false;

  /**
   * Initialize the workflow orchestrator
   */
  public static async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    LoggerService.info('Initializing Workflow Orchestrator Service...');

    // Register all workflows
    await this.registerWorkflows();

    this.isInitialized = true;
    LoggerService.info('✅ Workflow Orchestrator Service initialized');
  }

  /**
   * Register all workflow implementations
   */
  private static async registerWorkflows(): Promise<void> {
    // Workflows will be registered as they are implemented
    // This is called from workflow files when they are imported
    LoggerService.info('Workflow registry ready - workflows will be registered on import');
  }

  /**
   * Register a workflow implementation
   */
  public static registerWorkflow(
    workflowType: WorkflowType,
    implementation: WorkflowImplementation
  ): void {
    this.workflowRegistry.set(workflowType, implementation);
    LoggerService.info('Workflow registered', { workflowType });
  }

  /**
   * Start a new workflow
   */
  public static async startWorkflow(
    input: WorkflowInput,
    options: WorkflowExecutionOptions = {}
  ): Promise<WorkflowResult> {
    const workflowId = uuidv4();
    const {
      maxRetries = 3,
      timeout: _timeout,
      retryDelay = 1000,
      enableCompensation = true
    } = options;

    LoggerService.info('Starting workflow', {
      workflowId,
      workflowType: input.workflowType,
      userId: input.userId
    });

    try {
      // Get workflow implementation
      const workflowImpl = this.workflowRegistry.get(input.workflowType);
      if (!workflowImpl) {
        throw new Error(`Workflow implementation not found: ${input.workflowType}`);
      }

      // Create initial workflow state
      const initialState: WorkflowState = {
        workflowId,
        workflowType: input.workflowType,
        userId: input.userId,
        tenantId: input.tenantId,
        brokerId: input.brokerId,
        status: WorkflowStatus.PENDING,
        currentStep: 'initialization',
        stepIndex: 0,
        data: input.data,
        retryCount: 0,
        maxRetries,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: input.metadata
      };

      // Save initial state
      await this.saveWorkflowState(initialState);

      // Emit workflow started event
      await this.emitWorkflowEvent('workflow.started', workflowId, {
        workflowType: input.workflowType,
        userId: input.userId,
        tenantId: input.tenantId
      });

      // Get workflow steps
      const steps = await workflowImpl(input);

      // Create saga context
      const sagaContext: SagaContext = {
        workflowId,
        workflowType: input.workflowType,
        data: input.data,
        stepResults: new Map(),
        userId: input.userId,
        tenantId: input.tenantId,
        brokerId: input.brokerId
      };

      // Update state to running
      await this.updateWorkflowState(workflowId, {
        status: WorkflowStatus.RUNNING,
        currentStep: 'executing'
      });

      // Execute saga
      const sagaResult = await SagaExecutor.execute(steps, sagaContext, {
        maxRetries,
        retryDelay,
        enableCompensation
      });

      // Update workflow state based on result
      if (sagaResult.success) {
        await this.updateWorkflowState(workflowId, {
          status: WorkflowStatus.COMPLETED,
          currentStep: 'completed',
          data: {
            ...input.data,
            result: sagaResult.result
          },
          completedAt: new Date()
        });

        await this.emitWorkflowEvent('workflow.completed', workflowId, {
          workflowType: input.workflowType,
          result: sagaResult.result
        });

        return {
          workflowId,
          workflowType: input.workflowType,
          status: WorkflowStatus.COMPLETED,
          result: sagaResult.result
        };
      } else {
        const finalStatus = sagaResult.compensated
          ? WorkflowStatus.COMPENSATING
          : WorkflowStatus.FAILED;

        await this.updateWorkflowState(workflowId, {
          status: finalStatus,
          currentStep: 'failed',
          errorMessage: sagaResult.error?.message || 'Workflow execution failed',
          data: {
            ...input.data,
            error: sagaResult.error?.message,
            stepsExecuted: sagaResult.stepsExecuted,
            stepsCompensated: sagaResult.stepsCompensated
          }
        });

        await this.emitWorkflowEvent('workflow.failed', workflowId, {
          workflowType: input.workflowType,
          error: sagaResult.error?.message,
          compensated: sagaResult.compensated
        });

        // Create support ticket for workflow failure (if user ID is available)
        // Use input.userId or get from saved state
        const workflowUserId = input.userId || (await this.getWorkflowStatus(workflowId))?.userId;
        if (workflowUserId && input.workflowType) {
          try {
            const workflowTypeName = Object.keys(WorkflowType).find(
              key => WorkflowType[key as keyof typeof WorkflowType] === input.workflowType
            ) || input.workflowType;

            // Extract step info from executed steps
            const failedStepName = sagaResult.stepsExecuted.length > 0
              ? sagaResult.stepsExecuted[sagaResult.stepsExecuted.length - 1] || 'unknown'
              : 'unknown';
            const stepIndex = sagaResult.stepsExecuted.length - 1;

            await SupportService.createTicket(
              workflowUserId,
              `Workflow Failed: ${workflowTypeName}`,
              `Workflow ${workflowId} failed.\n\nError: ${sagaResult.error?.message || 'Unknown error'}\n\nWorkflow Type: ${workflowTypeName}\nStep: ${failedStepName}\nStep Index: ${stepIndex >= 0 ? stepIndex : 'unknown'}`,
              'high', // High priority for workflow failures
              {
                workflowId,
                workflowType: input.workflowType,
                stepIndex: stepIndex >= 0 ? stepIndex : undefined,
                stepName: failedStepName,
                issueType: 'workflow_failure',
                department: 'Technical Support',
              }
            );
            LoggerService.info('Support ticket created for workflow failure', { workflowId, userId: workflowUserId });
          } catch (ticketError: any) {
            // Don't fail workflow update if ticket creation fails
            LoggerService.warn('Failed to create support ticket for workflow failure', {
              workflowId,
              error: ticketError.message
            });
          }
        }

        return {
          workflowId,
          workflowType: input.workflowType,
          status: finalStatus,
          error: sagaResult.error?.message
        };
      }
    } catch (error: any) {
      LoggerService.error('Workflow execution failed', {
        workflowId,
        workflowType: input.workflowType,
        error: error.message
      });

      await this.updateWorkflowState(workflowId, {
        status: WorkflowStatus.FAILED,
        currentStep: 'error',
        errorMessage: error.message
      });

      await this.emitWorkflowEvent('workflow.error', workflowId, {
        workflowType: input.workflowType,
        error: error.message
      });

      return {
        workflowId,
        workflowType: input.workflowType,
        status: WorkflowStatus.FAILED,
        error: error.message
      };
    }
  }

  /**
   * Get workflow status
   */
  public static async getWorkflowStatus(workflowId: string): Promise<WorkflowState | null> {
    try {
      const WorkflowStateModel = DatabaseService.getModel('WorkflowState');
      const state = await WorkflowStateModel.findByPk(workflowId);

      if (!state) {
        return null;
      }

      return this.mapModelToState(state.toJSON());
    } catch (error: any) {
      LoggerService.error('Failed to get workflow status', {
        workflowId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get workflows by user
   */
  public static async getWorkflowsByUser(
    userId: string,
    options: {
      status?: WorkflowStatus;
      workflowType?: WorkflowType;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<WorkflowState[]> {
    try {
      const WorkflowStateModel = DatabaseService.getModel('WorkflowState');
      const where: any = { userId };

      if (options.status) {
        where.status = options.status;
      }
      if (options.workflowType) {
        where.workflowType = options.workflowType;
      }

      const states = await WorkflowStateModel.findAll({
        where,
        limit: options.limit || 100,
        offset: options.offset || 0,
        order: [['createdAt', 'DESC']]
      });

      return states.map(state => this.mapModelToState(state.toJSON()));
    } catch (error: any) {
      LoggerService.error('Failed to get workflows by user', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Retry a failed workflow step
   */
  public static async retryWorkflowStep(
    workflowId: string,
    stepIndex: number
  ): Promise<void> {
    const state = await this.getWorkflowStatus(workflowId);
    if (!state) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (state.status !== WorkflowStatus.FAILED) {
      throw new Error(`Workflow is not in failed state: ${state.status}`);
    }

    LoggerService.info('Retrying workflow step', {
      workflowId,
      stepIndex,
      currentStep: state.currentStep
    });

    // Reset workflow state and restart from the failed step
    await this.updateWorkflowState(workflowId, {
      status: WorkflowStatus.RUNNING,
      stepIndex,
      retryCount: state.retryCount + 1,
      errorMessage: undefined
    });

    // Re-execute workflow from the failed step
    // This would require re-implementing the workflow execution logic
    // For now, we'll just update the state - full retry logic can be added later
    await this.emitWorkflowEvent('workflow.retry', workflowId, {
      stepIndex,
      retryCount: state.retryCount + 1
    });
  }

  /**
   * Cancel a workflow
   */
  public static async cancelWorkflow(
    workflowId: string,
    reason: string
  ): Promise<void> {
    const state = await this.getWorkflowStatus(workflowId);
    if (!state) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (state.status === WorkflowStatus.COMPLETED) {
      throw new Error('Cannot cancel completed workflow');
    }

    LoggerService.info('Cancelling workflow', {
      workflowId,
                reason
    });

    await this.updateWorkflowState(workflowId, {
      status: WorkflowStatus.CANCELLED,
      currentStep: 'cancelled',
      errorMessage: reason,
      completedAt: new Date()
    });

    await this.emitWorkflowEvent('workflow.cancelled', workflowId, {
      reason
    });
  }

  /**
   * Update workflow state (internal method)
   */
  private static async updateWorkflowState(
    workflowId: string,
    updates: Partial<WorkflowState>
  ): Promise<void> {
    try {
      const WorkflowStateModel = DatabaseService.getModel('WorkflowState');
      await WorkflowStateModel.update(
        {
          ...updates,
          updatedAt: new Date()
        },
        {
          where: { workflowId }
        }
      );
    } catch (error: any) {
      LoggerService.error('Failed to update workflow state', {
        workflowId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Save workflow state (internal method)
   */
  private static async saveWorkflowState(state: WorkflowState): Promise<void> {
    try {
      const WorkflowStateModel = DatabaseService.getModel('WorkflowState');
      await WorkflowStateModel.create({
        workflowId: state.workflowId,
        workflowType: state.workflowType,
        userId: state.userId,
        tenantId: state.tenantId,
        brokerId: state.brokerId,
        status: state.status,
        currentStep: state.currentStep,
        stepIndex: state.stepIndex,
        data: state.data,
        errorMessage: state.errorMessage,
        retryCount: state.retryCount,
        maxRetries: state.maxRetries,
        completedAt: state.completedAt,
        metadata: state.metadata
      });
    } catch (error: any) {
      LoggerService.error('Failed to save workflow state', {
        workflowId: state.workflowId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Map database model to WorkflowState interface
   */
  private static mapModelToState(model: any): WorkflowState {
    return {
      workflowId: model.workflowId || model.workflow_id,
      workflowType: model.workflowType || model.workflow_type as WorkflowType,
      userId: model.userId || model.user_id,
      tenantId: model.tenantId || model.tenant_id,
      brokerId: model.brokerId || model.broker_id,
      status: (model.status as WorkflowStatus) || WorkflowStatus.PENDING,
      currentStep: model.currentStep || model.current_step,
      stepIndex: model.stepIndex || model.step_index || 0,
      data: model.data || {},
      errorMessage: model.errorMessage || model.error_message,
      retryCount: model.retryCount || model.retry_count || 0,
      maxRetries: model.maxRetries || model.max_retries || 3,
      createdAt: model.createdAt || model.created_at,
      updatedAt: model.updatedAt || model.updated_at,
      completedAt: model.completedAt || model.completed_at,
      metadata: model.metadata || {}
    };
  }

  /**
   * Emit workflow event to Kafka
   */
  private static async emitWorkflowEvent(
    eventType: string,
    workflowId: string,
    payload: any
  ): Promise<void> {
    try {
      await EventStreamingService.emitAuditEvent(
        eventType,
        'workflow',
        workflowId,
        {
          ...payload,
          workflowId,
          timestamp: new Date().toISOString()
        }
      );
    } catch (error: any) {
      LoggerService.warn('Failed to emit workflow event', {
        eventType,
        workflowId,
        error: error.message
      });
      // Don't throw - event emission failure shouldn't break workflow
    }
  }

  /**
   * Continue workflow execution (called from event handlers)
   * 
   * This method is called when an async step completes (e.g., KYC webhook, order filled).
   * It updates the workflow state and re-executes the workflow from the current step.
   */
  public static async continueWorkflow(
    workflowId: string,
    stepResult: any,
    nextStep?: string
  ): Promise<void> {
    const state = await this.getWorkflowStatus(workflowId);
    if (!state) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (state.status !== WorkflowStatus.RUNNING) {
      LoggerService.warn('Cannot continue workflow - not in running state', {
        workflowId,
        status: state.status
      });
      return;
    }

    LoggerService.info('Continuing workflow execution', {
      workflowId,
      currentStep: state.currentStep,
      stepIndex: state.stepIndex
    });

    // Update workflow data with step result
    const updatedData = {
      ...state.data,
      ...stepResult,
      [`step_${state.stepIndex}_result`]: stepResult
    };

    await this.updateWorkflowState(workflowId, {
      data: updatedData,
      currentStep: nextStep || state.currentStep
    });

    // Re-execute workflow from current step
    // Get workflow implementation
    const workflowImpl = this.workflowRegistry.get(state.workflowType);
    if (!workflowImpl) {
      throw new Error(`Workflow implementation not found: ${state.workflowType}`);
    }

    // Create input from current state
    const input: WorkflowInput = {
      workflowType: state.workflowType,
      userId: state.userId,
      tenantId: state.tenantId,
      brokerId: state.brokerId,
      data: updatedData,
      metadata: state.metadata
    };

    // Get workflow steps
    const steps = await workflowImpl(input);

    // Execute remaining steps (from current stepIndex)
    const remainingSteps = steps.slice(state.stepIndex);
    
    if (remainingSteps.length === 0) {
      // All steps completed
      await this.updateWorkflowState(workflowId, {
        status: WorkflowStatus.COMPLETED,
        completedAt: new Date()
      });
      return;
    }

    // Create saga context with updated data
    const sagaContext: SagaContext = {
      workflowId,
      workflowType: state.workflowType,
      data: updatedData,
      stepResults: new Map(),
      userId: state.userId,
      tenantId: state.tenantId,
      brokerId: state.brokerId
    };

    // Execute remaining steps
    const sagaResult = await SagaExecutor.execute(remainingSteps, sagaContext, {
      maxRetries: state.maxRetries,
      enableCompensation: true
    });

    // Update final state
    if (sagaResult.success) {
      await this.updateWorkflowState(workflowId, {
        status: WorkflowStatus.COMPLETED,
        currentStep: 'completed',
        data: {
          ...updatedData,
          result: sagaResult.result
        },
        completedAt: new Date()
      });
    } else {
      await this.updateWorkflowState(workflowId, {
        status: sagaResult.compensated ? WorkflowStatus.COMPENSATING : WorkflowStatus.FAILED,
        errorMessage: sagaResult.error?.message
      });
    }

    await this.emitWorkflowEvent('workflow.step.completed', workflowId, {
      stepIndex: state.stepIndex,
      nextStep: state.stepIndex < steps.length - 1 ? steps[state.stepIndex + 1]?.name : null
    });
  }
}
