/**
 * KYC Workflow Trigger Service
 * 
 * Automatically starts Ballerine workflows when KYC upgrades are needed.
 * 
 * Features:
 * - Maps KYC levels to Ballerine workflow definitions
 * - Automatically starts workflows when users approach/exceed limits
 * - Handles workflow callbacks and updates user KYC levels
 * - Works across both presale and main platform (unified)
 */

import { LoggerService } from './logger';
import { getBallerineService } from './ballerine';
import { KYCService } from './kyc';
import { EventStreamingService } from './event-streaming';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface WorkflowTriggerRequest {
  userId: string;
  tenantId: string;
  brokerId?: string;
  fromLevel: string;
  toLevel: string;
  reason: string;
  triggerType: 'proactive' | 'blocking' | 'manual';
  metadata?: Record<string, any>;
}

export interface WorkflowTriggerResult {
  success: boolean;
  workflowId?: string;
  workflowUrl?: string;
  message: string;
  error?: string;
}

// =============================================================================
// KYC WORKFLOW TRIGGER SERVICE
// =============================================================================

export class KYCWorkflowTriggerService {
  /**
   * Map KYC levels to Ballerine workflow definitions
   */
  private static getWorkflowDefinitionId(fromLevel: string, toLevel: string): string {
    // Map KYC level transitions to workflow definitions
    const workflowMap: Record<string, string> = {
      'L0->L1': 'kyc-basic-workflow',      // Basic verification (email + phone)
      'L1->L2': 'kyc-identity-workflow',  // Identity verification (ID + address + biometric)
      'L2->L3': 'kyc-enhanced-workflow',  // Enhanced verification (full due diligence + source of funds)
      'L3->INSTITUTIONAL': 'kyb-workflow', // Business verification
    };

    const key = `${fromLevel}->${toLevel}`;
    return workflowMap[key] || 'kyc-basic-workflow'; // Default to basic workflow
  }

  /**
   * Get workflow type (kyc or kyb)
   */
  private static getWorkflowType(toLevel: string): 'kyc' | 'kyb' {
    return toLevel === 'INSTITUTIONAL' ? 'kyb' : 'kyc';
  }

  /**
   * Trigger KYC upgrade workflow
   */
  public static async triggerUpgradeWorkflow(
    request: WorkflowTriggerRequest
  ): Promise<WorkflowTriggerResult> {
    try {
      const { userId, tenantId, brokerId, fromLevel, toLevel, reason, triggerType, metadata } = request;

      LoggerService.info('Triggering KYC upgrade workflow', {
        userId,
        tenantId,
        fromLevel,
        toLevel,
        reason,
        triggerType
      });

      // Get user's current KYC status
      let userEmail = 'unknown@thaliumx.com';
      let userPhone: string | undefined;
      let userWalletAddress: string | undefined;
      
      try {
        const kycStatus = await KYCService.getKYCStatus(userId);
        userEmail = kycStatus.email;
        userPhone = kycStatus.phoneNumber;
        userWalletAddress = kycStatus.walletAddress;
      } catch (error) {
        LoggerService.warn('Could not fetch user KYC status, using defaults', { userId, error });
      }

      // Get workflow definition ID
      const workflowDefinitionId = this.getWorkflowDefinitionId(fromLevel, toLevel);
      const workflowType = this.getWorkflowType(toLevel);

      // Create case ID
      const caseId = `kyc-upgrade-${userId}-${uuidv4()}`;

      // Prepare case data for Ballerine
      const caseData = {
        id: caseId,
        type: workflowType,
        entity_id: userId,
        tenant_id: tenantId,
        broker_id: brokerId || tenantId,
        entity_data: {
          personalInformation: {
            email: userEmail,
            phoneNumber: userPhone,
            walletAddress: userWalletAddress
          },
          metadata: {
            kycLevel: fromLevel,
            targetKycLevel: toLevel,
            tenantId,
            brokerId: brokerId || tenantId,
            triggerType,
            reason,
            ...metadata
          }
        },
        documents: [],
        priority: triggerType === 'blocking' ? 'high' : 'normal',
        regulatoryRequirements: [],
        riskLevel: 'medium'
      };

      // Start workflow using BallerineService
      const ballerineService = getBallerineService();
      const workflowResponse = await ballerineService.startWorkflow(caseData);

      // Emit event for workflow tracking
      await EventStreamingService.emitSystemEvent(
        'kyc.workflow.started',
        'kyc_workflow_trigger',
        'info',
        {
          userId,
          tenantId,
          workflowId: workflowResponse.id,
          fromLevel,
          toLevel,
          reason,
          triggerType,
          timestamp: new Date().toISOString()
        },
        { userId, tenantId }
      );

      // Get collection flow URL for user to complete workflow
      let workflowUrl: string | undefined;
      try {
        const collectionFlow = await ballerineService.getCollectionFlow(workflowResponse.id);
        workflowUrl = collectionFlow.url;
      } catch (error) {
        LoggerService.warn('Could not get collection flow URL', { workflowId: workflowResponse.id, error });
      }

      LoggerService.info('KYC upgrade workflow started successfully', {
        userId,
        tenantId,
        workflowId: workflowResponse.id,
        fromLevel,
        toLevel
      });

      return {
        success: true,
        workflowId: workflowResponse.id,
        workflowUrl,
        message: `KYC upgrade workflow to level ${toLevel} has been initiated. Please complete the verification process.`
      };
    } catch (error) {
      LoggerService.error('Failed to trigger KYC upgrade workflow:', error);
      
      return {
        success: false,
        message: 'Failed to initiate KYC upgrade workflow. Please contact support.',
        error: error instanceof Error ? error.message : 'unknown_error'
      };
    }
  }

  /**
   * Handle workflow completion callback
   */
  public static async handleWorkflowCallback(
    workflowId: string,
    status: string,
    decision: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      LoggerService.info('Handling workflow callback', {
        workflowId,
        status,
        decision
      });

      // Extract user information from metadata
      const userId = metadata?.userId || metadata?.entity_id;
      const tenantId = metadata?.tenantId || metadata?.tenant_id;
      const targetLevel = metadata?.targetKycLevel;

      if (!userId || !tenantId || !targetLevel) {
        LoggerService.warn('Missing required metadata in workflow callback', { workflowId, metadata });
        return;
      }

      // If workflow was approved, update user's KYC level
      if (status === 'approved' || decision?.status === 'approved') {
        try {
          const kycStatus = await KYCService.getKYCStatus(userId);
          
          // Update KYC level
          await KYCService.updateKYCLevel(
            userId,
            targetLevel as any,
            `Workflow ${workflowId} approved`
          );
          
          // Emit additional metadata event
          await EventStreamingService.emitSystemEvent(
            'kyc.level.upgrade.metadata',
            'kyc_workflow_trigger',
            'info',
            {
              userId,
              tenantId,
              workflowId,
              previousLevel: kycStatus.kycLevel,
              newLevel: targetLevel,
              decision,
              approvedAt: new Date().toISOString()
            },
            { userId, tenantId }
          );

          // Emit event for KYC level upgrade
          await EventStreamingService.emitSystemEvent(
            'kyc.level.upgraded',
            'kyc_workflow_trigger',
            'info',
            {
              userId,
              tenantId,
              previousLevel: kycStatus.kycLevel,
              newLevel: targetLevel,
              workflowId,
              timestamp: new Date().toISOString()
            },
            { userId, tenantId }
          );

          LoggerService.info('KYC level upgraded successfully', {
            userId,
            tenantId,
            previousLevel: kycStatus.kycLevel,
            newLevel: targetLevel,
            workflowId
          });
        } catch (error) {
          LoggerService.error('Failed to update KYC level after workflow approval:', error);
        }
      } else if (status === 'rejected' || decision?.status === 'rejected') {
        // Log rejection but don't change KYC level
        LoggerService.warn('KYC upgrade workflow rejected', {
          userId,
          tenantId,
          workflowId,
          reason: decision?.reason || 'Workflow rejected'
        });

        await EventStreamingService.emitSystemEvent(
          'kyc.workflow.rejected',
          'kyc_workflow_trigger',
          'warn',
          {
            userId,
            tenantId,
            workflowId,
            reason: decision?.reason || 'Workflow rejected',
            timestamp: new Date().toISOString()
          },
          { userId, tenantId }
        );
      }
    } catch (error) {
      LoggerService.error('Failed to handle workflow callback:', error);
    }
  }

  /**
   * Get workflow status
   */
  public static async getWorkflowStatus(workflowId: string): Promise<any> {
    try {
      const ballerineService = getBallerineService();
      return await ballerineService.getWorkflowStatus(workflowId);
    } catch (error) {
      LoggerService.error('Failed to get workflow status:', error);
      throw error;
    }
  }
}
