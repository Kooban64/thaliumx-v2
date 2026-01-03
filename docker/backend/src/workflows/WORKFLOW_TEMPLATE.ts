/**
 * Workflow Template
 * 
 * Use this template to create new workflows.
 * Copy this file and rename it to match your workflow name.
 * 
 * Steps:
 * 1. Copy this file to workflows/{workflow-name}.ts
 * 2. Update the workflow function name
 * 3. Implement the saga steps
 * 4. Add compensation logic where needed
 * 5. Register the workflow at the bottom
 * 6. Import it in workflows/index.ts
 */

import { SagaStep, SagaContext, WorkflowInput } from '../types/workflow';
import { WorkflowType } from '../types/workflow';
import { WorkflowOrchestratorService } from '../services/workflow-orchestrator';
import { LoggerService } from '../services/logger';

// Store context for compensation
interface WorkflowContext {
  // Add fields to track created resources
}

/**
 * WorkflowName Workflow Implementation
 * 
 * Description: What this workflow does
 * 
 * Steps:
 * 1. Step 1 description
 * 2. Step 2 description
 * 3. Step 3 description
 * 
 * Compensation: What gets rolled back on failure
 */
export async function createWorkflowNameWorkflow(
  input: WorkflowInput
): Promise<SagaStep[]> {
  const context: WorkflowContext = {};

  return [
    // Step 1: [Step name]
    {
      name: 'step_1_name',
      execute: async (sagaContext: SagaContext) => {
        LoggerService.info('Executing step 1', {
          workflowId: sagaContext.workflowId
        });

        // Implementation here
        return { result: 'step1_complete' };
      },
      compensate: async (sagaContext: SagaContext) => {
        // Compensation logic here
        LoggerService.info('Compensating step 1', {
          workflowId: sagaContext.workflowId
        });
      },
      retryable: true,
      maxRetries: 3
    },

    // Step 2: [Step name]
    {
      name: 'step_2_name',
      execute: async (sagaContext: SagaContext) => {
        LoggerService.info('Executing step 2', {
          workflowId: sagaContext.workflowId
        });

        // Implementation here
        return { result: 'step2_complete' };
      },
      compensate: async (sagaContext: SagaContext) => {
        // Compensation logic here
      },
      retryable: true
    }

    // Add more steps as needed
  ];
}

// Register workflow with orchestrator
// Uncomment and update when implementing:
// WorkflowOrchestratorService.registerWorkflow(
//   WorkflowType.WORKFLOW_TYPE,
//   createWorkflowNameWorkflow
// );
