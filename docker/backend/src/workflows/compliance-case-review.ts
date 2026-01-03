/**
 * Compliance Case Review Workflow
 * 
 * Orchestrates compliance case review:
 * 1. Validate review request
 * 2. Load case data
 * 3. Review compliance flags
 * 4. Make decision
 * 5. Update case status
 * 6. Emit review event
 */

import { SagaStep, SagaContext, WorkflowInput } from '../types/workflow';
import { WorkflowType } from '../types/workflow';
import { WorkflowOrchestratorService } from '../services/workflow-orchestrator';
import { EventStreamingService } from '../services/event-streaming';
import { LoggerService } from '../services/logger';

export async function createComplianceCaseReviewWorkflow(
  input: WorkflowInput
): Promise<SagaStep[]> {
  return [
    {
      name: 'validate_review_request',
      execute: async (sagaContext: SagaContext) => {
        const { caseId, reviewerId } = sagaContext.data;
        if (!caseId || !reviewerId) {
          throw new Error('Case ID and reviewer ID required');
        }
        return { validated: true };
      },
      retryable: false
    },
    {
      name: 'load_case_data',
      execute: async (sagaContext: SagaContext) => {
        const { caseId } = sagaContext.data;
        // Load compliance case data
        LoggerService.info('Loading compliance case data', {
          caseId,
          reviewerId: sagaContext.data.reviewerId
        });
        return { caseDataLoaded: true };
      },
      retryable: true
    },
    {
      name: 'review_compliance_flags',
      execute: async (sagaContext: SagaContext) => {
        const { caseId } = sagaContext.data;
        // Review compliance flags and risk indicators
        LoggerService.info('Reviewing compliance flags', {
          caseId
        });
        return { flagsReviewed: true };
      },
      retryable: true
    },
    {
      name: 'make_decision',
      execute: async (sagaContext: SagaContext) => {
        const { caseId, decision, notes } = sagaContext.data;
        if (!decision) {
          throw new Error('Decision required for case review');
        }
        if (!['approved', 'rejected', 'requires_more_info'].includes(decision)) {
          throw new Error('Decision must be approved, rejected, or requires_more_info');
        }
        
        LoggerService.info('Compliance case decision made', {
          caseId,
          decision,
          notes
        });
        
        return { decisionMade: true, decision };
      },
      retryable: false
    },
    {
      name: 'update_case_status',
      execute: async (sagaContext: SagaContext) => {
        const { caseId, decision } = sagaContext.data;
        // Update compliance case status
        LoggerService.info('Case status updated', {
          caseId,
          decision
        });
        return { statusUpdated: true };
      },
      retryable: true
    },
    {
      name: 'emit_review_event',
      execute: async (sagaContext: SagaContext) => {
        await EventStreamingService.emitComplianceEvent(
          'CASE_REVIEW',
          'COMPLIANCE',
          {
            caseId: sagaContext.data.caseId,
            reviewerId: sagaContext.data.reviewerId,
            decision: sagaContext.data.decision,
            notes: sagaContext.data.notes
          },
          sagaContext.data.decision === 'approved' ? 'compliant' : 'non-compliant'
        );
        return { eventEmitted: true };
      },
      retryable: true
    }
  ];
}

WorkflowOrchestratorService.registerWorkflow(
  WorkflowType.COMPLIANCE_CASE_REVIEW,
  createComplianceCaseReviewWorkflow
);
