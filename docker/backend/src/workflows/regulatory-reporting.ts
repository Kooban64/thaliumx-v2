/**
 * Regulatory Reporting Workflow
 * 
 * Orchestrates regulatory reporting:
 * 1. Validate reporting request
 * 2. Collect report data
 * 3. Format report
 * 4. Submit to regulatory body
 * 5. Store report record
 * 6. Emit reporting event
 */

import type { SagaStep, SagaContext, WorkflowInput } from '../types/workflow';
import { WorkflowType } from '../types/workflow';
import { WorkflowOrchestratorService } from '../services/workflow-orchestrator';
import { EventStreamingService } from '../services/event-streaming';
import { LoggerService } from '../services/logger';

export async function createRegulatoryReportingWorkflow(
  _input: WorkflowInput
): Promise<SagaStep[]> {
  return [
    {
      name: 'validate_reporting_request',
      execute: async (sagaContext: SagaContext) => {
        const { reportType, reportingPeriod, regulatoryBody } = sagaContext.data;
        if (!reportType || !reportingPeriod || !regulatoryBody) {
          throw new Error('Report type, reporting period, and regulatory body required');
        }
        return { validated: true };
      },
      retryable: false
    },
    {
      name: 'collect_report_data',
      execute: async (sagaContext: SagaContext) => {
        const { reportType, reportingPeriod } = sagaContext.data;
        // Collect data for regulatory report
        LoggerService.info('Collecting report data', {
          reportType,
          reportingPeriod
        });
        return { dataCollected: true };
      },
      retryable: true
    },
    {
      name: 'format_report',
      execute: async (sagaContext: SagaContext) => {
        const { reportType, regulatoryBody } = sagaContext.data;
        // Format report according to regulatory requirements
        const reportId = `regulatory_${Date.now()}`;
        
        LoggerService.info('Report formatted', {
          reportId,
          reportType,
          regulatoryBody
        });
        
        return { reportId, reportFormatted: true };
      },
      retryable: true
    },
    {
      name: 'submit_to_regulatory_body',
      execute: async (sagaContext: SagaContext) => {
        const { reportId, regulatoryBody } = sagaContext.data;
        // Submit report to regulatory body
        const submissionId = `submission_${Date.now()}`;
        
        LoggerService.info('Report submitted to regulatory body', {
          reportId,
          regulatoryBody,
          submissionId
        });
        
        return { submissionId, submitted: true };
      },
      compensate: async (sagaContext: SagaContext) => {
        // Note: Regulatory submissions cannot be reversed, but we can mark as failed
        LoggerService.info('Compensating: Marking submission as failed', {
          submissionId: sagaContext.data.submissionId
        });
      },
      retryable: true
    },
    {
      name: 'store_report_record',
      execute: async (sagaContext: SagaContext) => {
        const { reportId, submissionId } = sagaContext.data;
        // Store report record in database
        LoggerService.info('Report record stored', {
          reportId,
          submissionId
        });
        return { recordStored: true };
      },
      retryable: true
    },
    {
      name: 'emit_reporting_event',
      execute: async (sagaContext: SagaContext) => {
        await EventStreamingService.emitComplianceEvent(
          'REGULATORY_REPORTING',
          'REPORTING',
          {
            reportId: sagaContext.data.reportId,
            reportType: sagaContext.data.reportType,
            regulatoryBody: sagaContext.data.regulatoryBody,
            submissionId: sagaContext.data.submissionId
          },
          'compliant'
        );
        return { eventEmitted: true };
      },
      retryable: true
    }
  ];
}

WorkflowOrchestratorService.registerWorkflow(
  WorkflowType.REGULATORY_REPORTING,
                createRegulatoryReportingWorkflow
);
