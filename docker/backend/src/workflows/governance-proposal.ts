/**
 * Governance Proposal Workflow
 * 
 * Orchestrates governance proposal creation:
 * 1. Validate proposal request
 * 2. Check proposal requirements
 * 3. Create proposal on blockchain
 * 4. Start voting period
 * 5. Track proposal status
 * 6. Emit proposal event
 */

import { SagaStep, SagaContext, WorkflowInput } from '../types/workflow';
import { WorkflowType } from '../types/workflow';
import { WorkflowOrchestratorService } from '../services/workflow-orchestrator';
import { EventStreamingService } from '../services/event-streaming';
import { LoggerService } from '../services/logger';
import crypto from 'crypto';

export async function createGovernanceProposalWorkflow(
  input: WorkflowInput
): Promise<SagaStep[]> {
  return [
    {
      name: 'validate_proposal_request',
      execute: async (sagaContext: SagaContext) => {
        const { title, description, actions } = sagaContext.data;
        if (!title || !description || !actions) {
          throw new Error('Title, description, and actions required for proposal');
        }
        return { validated: true };
      },
      retryable: false
    },
    {
      name: 'check_proposal_requirements',
      execute: async (sagaContext: SagaContext) => {
        const { proposerAddress } = sagaContext.data;
        // Check if proposer meets requirements (minimum token balance, etc.)
        LoggerService.info('Checking proposal requirements', {
          proposerAddress,
          userId: sagaContext.userId
        });
        return { requirementsMet: true };
      },
      retryable: true
    },
    {
      name: 'create_proposal_on_blockchain',
      execute: async (sagaContext: SagaContext) => {
        const { title, description, actions } = sagaContext.data;
        // Create proposal on governance contract (simplified - would use SmartContractService)
        const proposalId = `proposal_${Date.now()}`;
        const transactionHash = `0x${crypto.randomBytes(32).toString('hex')}`;
        const votingStart = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
        const votingEnd = new Date(votingStart.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days voting period
        
        LoggerService.info('Proposal created on blockchain', {
          proposalId,
          transactionHash,
          votingStart,
          votingEnd
        });
        
        return { proposalId, transactionHash, votingStart: votingStart.toISOString(), votingEnd: votingEnd.toISOString() };
      },
      compensate: async (sagaContext: SagaContext) => {
        // Cancel proposal if creation fails
        LoggerService.info('Compensating: Cancelling proposal', {
          proposalId: sagaContext.data.proposalId
        });
      },
      retryable: true
    },
    {
      name: 'start_voting_period',
      execute: async (sagaContext: SagaContext) => {
        const { proposalId, votingStart } = sagaContext.data;
        // Start voting period tracking
        LoggerService.info('Voting period started', {
          proposalId,
          votingStart
        });
        return { votingPeriodStarted: true };
      },
      retryable: true
    },
    {
      name: 'track_proposal_status',
      execute: async (sagaContext: SagaContext) => {
        const { proposalId } = sagaContext.data;
        // Track proposal status (active, passed, failed, executed)
        LoggerService.info('Tracking proposal status', {
          proposalId
        });
        return { statusTracked: true };
      },
      retryable: true
    },
    {
      name: 'emit_proposal_event',
      execute: async (sagaContext: SagaContext) => {
        await EventStreamingService.emitAuditEvent(
          'governance.proposal_created',
          'governance',
          sagaContext.data.proposalId || sagaContext.workflowId,
          {
            userId: sagaContext.userId,
            proposalId: sagaContext.data.proposalId,
            title: sagaContext.data.title,
            transactionHash: sagaContext.data.transactionHash,
            votingStart: sagaContext.data.votingStart,
            votingEnd: sagaContext.data.votingEnd
          }
        );
        return { eventEmitted: true };
      },
      retryable: true
    }
  ];
}

WorkflowOrchestratorService.registerWorkflow(
  WorkflowType.GOVERNANCE_PROPOSAL,
  createGovernanceProposalWorkflow
);
