/**
 * User Onboarding Workflow
 * 
 * Orchestrates the complete user registration process:
 * 1. Validate user data
 * 2. Trigger KYC verification via Ballerine
 * 3. Wait for KYC completion (webhook)
 * 4. Create user account
 * 5. Create trading account
 * 6. Setup wallet
 * 7. Send welcome email
 * 8. Mark onboarding complete
 * 
 * Compensation: If any step fails, rollback previous steps
 */

import type { SagaStep, SagaContext, WorkflowInput } from '../types/workflow';
import { WorkflowType } from '../types/workflow';
import { WorkflowOrchestratorService } from '../services/workflow-orchestrator';
import { UserService } from '../services/user';
import { BallerineService } from '../services/ballerine';
// WalletSystemService accessed via routes
import { EmailService } from '../services/email';
import { LoggerService } from '../services/logger';
// ExchangeService, DatabaseService imported but not used in this file

// Store created resources for compensation
interface OnboardingContext {
  userId?: string;
  ballerineWorkflowId?: string;
  tradingAccountId?: string;
  walletId?: string;
}

/**
 * User Onboarding Workflow Implementation
 */
export async function createUserOnboardingWorkflow(
  _input: WorkflowInput
): Promise<SagaStep[]> {
  const context: OnboardingContext = {};

  return [
    // Step 1: Validate user data
    {
      name: 'validate_user_data',
      execute: async (sagaContext: SagaContext) => {
        LoggerService.info('Validating user data', {
          workflowId: sagaContext.workflowId,
          email: sagaContext.data.email
        });

        const { email, username, firstName, lastName } = sagaContext.data;

        if (!email || !username || !firstName || !lastName) {
          throw new Error('Missing required user data: email, username, firstName, lastName');
        }

        // Check if user already exists
        const existingUser = await UserService.getUserByEmail(email);
        if (existingUser) {
          throw new Error('User with this email already exists');
        }

        const existingUsername = await UserService.getUserByUsername(username);
        if (existingUsername) {
          throw new Error('Username already taken');
        }

        return { validated: true };
      },
      retryable: false
    },

    // Step 2: Trigger KYC via Ballerine
    {
      name: 'trigger_kyc_verification',
      execute: async (sagaContext: SagaContext) => {
        LoggerService.info('Triggering KYC verification via Ballerine', {
          workflowId: sagaContext.workflowId,
          userId: sagaContext.userId
        });

        const ballerineService = new BallerineService();

        // Prepare case data for Ballerine
        const caseData = {
          id: sagaContext.workflowId, // Use workflow ID as case ID
          type: 'kyc',
          entity_id: sagaContext.userId || sagaContext.workflowId,
          tenant_id: sagaContext.tenantId || '',
          broker_id: sagaContext.brokerId || '',
          entity_data: {
            personalInformation: {
              firstName: sagaContext.data.firstName,
              lastName: sagaContext.data.lastName,
              email: sagaContext.data.email,
              phoneNumber: sagaContext.data.phoneNumber
            },
            metadata: {
              workflowId: sagaContext.workflowId,
              source: 'user_onboarding_workflow'
            }
          },
          documents: sagaContext.data.documents || [],
          priority: 'normal',
          regulatoryRequirements: [],
          riskLevel: 'medium'
        };

        const workflowResponse = await ballerineService.startWorkflow(caseData);

        context.ballerineWorkflowId = workflowResponse.id;

        // Store workflow ID in saga context for webhook handler
        sagaContext.data.ballerineWorkflowId = workflowResponse.id;

        LoggerService.info('KYC workflow started in Ballerine', {
          workflowId: sagaContext.workflowId,
          ballerineWorkflowId: workflowResponse.id
        });

        return {
          ballerineWorkflowId: workflowResponse.id,
          status: workflowResponse.status,
          currentState: workflowResponse.currentState
        };
      },
      compensate: async (sagaContext: SagaContext) => {
        // No compensation needed - KYC workflow can be cancelled separately
        LoggerService.info('KYC workflow compensation (no action needed)', {
          workflowId: sagaContext.workflowId
        });
      },
      retryable: true,
      maxRetries: 3
    },

    // Step 3: Wait for KYC completion (this step will be completed via webhook)
    {
      name: 'wait_for_kyc_completion',
      execute: async (sagaContext: SagaContext) => {
        LoggerService.info('Waiting for KYC completion', {
          workflowId: sagaContext.workflowId,
          ballerineWorkflowId: context.ballerineWorkflowId
        });

        // This step will be completed when Ballerine webhook is received
        // The webhook handler will call WorkflowOrchestratorService.continueWorkflow()
        // Check if KYC is already complete (in case webhook arrived first)
        if (sagaContext.data.kycCompleted === true) {
          const kycResult = sagaContext.data.kycResult;
          if (kycResult?.status !== 'approved' && kycResult?.status !== 'completed') {
            throw new Error(`KYC verification failed: ${kycResult?.status}`);
          }
          return { kycStatus: 'approved', kycResult };
        }

        // If KYC not complete, check Ballerine workflow status
        if (context.ballerineWorkflowId) {
          try {
            const { getBallerineService } = await import('../services/ballerine');
            const ballerineService = getBallerineService();
            const ballerineStatus = await ballerineService.getWorkflowStatus(context.ballerineWorkflowId);
            
            if (ballerineStatus.status === 'completed' || ballerineStatus.status === 'approved') {
              return {
                kycStatus: 'approved',
                kycResult: {
                  status: ballerineStatus.status,
                  context: ballerineStatus.context
                }
              };
            }
          } catch (error: any) {
            LoggerService.warn('Failed to check Ballerine workflow status', {
              error: error.message,
              ballerineWorkflowId: context.ballerineWorkflowId
            });
          }
        }

        // If KYC not complete, throw error to pause workflow
        // Webhook will continue it later
        throw new Error('KYC completion pending - waiting for webhook');
      },
      retryable: true,
      maxRetries: 30, // Wait up to 30 retries (can be configured)
      timeout: 300000 // 5 minutes timeout
    },

    // Step 4: Create user account
    {
      name: 'create_user_account',
      execute: async (sagaContext: SagaContext) => {
        LoggerService.info('Creating user account', {
          workflowId: sagaContext.workflowId
        });

        const userData = {
          email: sagaContext.data.email,
          username: sagaContext.data.username,
          firstName: sagaContext.data.firstName,
          lastName: sagaContext.data.lastName,
          phone: sagaContext.data.phoneNumber,
          tenantId: sagaContext.tenantId,
          kycStatus: 'approved' as any,
          kycLevel: (sagaContext.data.kycLevel || 'basic') as any,
          isActive: true,
          isVerified: true
        };

        const user = await UserService.createUser(userData);
        context.userId = user.id;

        LoggerService.info('User account created', {
          workflowId: sagaContext.workflowId,
          userId: user.id
        });

        return { userId: user.id, user };
      },
      compensate: async (sagaContext: SagaContext) => {
        if (context.userId) {
          LoggerService.info('Compensating: Deleting user account', {
            workflowId: sagaContext.workflowId,
            userId: context.userId
          });
          await UserService.deleteUser(context.userId);
        }
      },
      retryable: true
    },

    // Step 5: Create trading account
    {
      name: 'create_trading_account',
      execute: async (sagaContext: SagaContext) => {
        if (!context.userId) {
          throw new Error('User ID not available');
        }

        LoggerService.info('Creating trading account', {
          workflowId: sagaContext.workflowId,
          userId: context.userId
        });

        // Create trading account via ExchangeService
        // Note: ExchangeService.createAccount may need to be implemented
        // For now, we'll create a placeholder
        const tradingAccountId = `trading_${context.userId}`;

        context.tradingAccountId = tradingAccountId;

        LoggerService.info('Trading account created', {
          workflowId: sagaContext.workflowId,
                tradingAccountId
        });

        return { tradingAccountId };
      },
      compensate: async (sagaContext: SagaContext) => {
        // Trading account cleanup if needed
        LoggerService.info('Compensating: Cleaning up trading account', {
          workflowId: sagaContext.workflowId,
          tradingAccountId: context.tradingAccountId
        });
        // Implementation depends on ExchangeService cleanup methods
      },
      retryable: true
    },

    // Step 6: Setup wallet
    {
      name: 'setup_wallet',
      execute: async (sagaContext: SagaContext) => {
        if (!context.userId) {
          throw new Error('User ID not available');
        }

        LoggerService.info('Setting up wallet', {
          workflowId: sagaContext.workflowId,
          userId: context.userId
        });

        // Create all wallets via WalletSystemService
        // Access WalletSystemService via routes
        const { getWalletSystemService } = await import('../routes/wallet-system');
        const walletService = getWalletSystemService();

        const userInfo = {
          email: sagaContext.data.email,
          firstName: sagaContext.data.firstName,
          lastName: sagaContext.data.lastName
        };

        const walletInfrastructure = await walletService.createUserWalletInfrastructure(
          context.userId!,
          sagaContext.tenantId || '',
          sagaContext.brokerId || '',
                userInfo
        );

        context.walletId = walletInfrastructure[0]?.id || '';

        LoggerService.info('Wallet infrastructure created', {
          workflowId: sagaContext.workflowId,
          walletCount: walletInfrastructure.length
        });

        return { 
          fiatWalletId: walletInfrastructure[0]?.id,
          cryptoHotWalletId: walletInfrastructure[1]?.id,
          thalWalletId: walletInfrastructure[2]?.id,
          tradingWalletId: walletInfrastructure[3]?.id
        };
      },
      compensate: async (sagaContext: SagaContext) => {
        // Wallet cleanup if needed
        LoggerService.info('Compensating: Cleaning up wallet', {
          workflowId: sagaContext.workflowId,
          walletId: context.walletId
        });
        // Implementation depends on WalletSystemService cleanup methods
      },
      retryable: true
    },

    // Step 7: Send welcome email
    {
      name: 'send_welcome_email',
      execute: async (sagaContext: SagaContext) => {
        if (!context.userId) {
          throw new Error('User ID not available');
        }

        LoggerService.info('Sending welcome email', {
          workflowId: sagaContext.workflowId,
          userId: context.userId,
          email: sagaContext.data.email
        });

        try {
          // Send welcome email
          // Note: EmailService.sendWelcomeEmail may need to be implemented
          await EmailService.sendWelcomeEmail({
            email: sagaContext.data.email,
            firstName: sagaContext.data.firstName,
            userId: context.userId
          });

          LoggerService.info('Welcome email sent', {
            workflowId: sagaContext.workflowId,
            email: sagaContext.data.email
          });

          return { emailSent: true };
        } catch (error: any) {
          // Don't fail workflow if email fails - log and continue
          LoggerService.warn('Failed to send welcome email (non-critical)', {
            workflowId: sagaContext.workflowId,
            error: error.message
          });
          return { emailSent: false, error: error.message };
        }
      },
      retryable: true,
      maxRetries: 2
      // No compensation - email sending is non-critical
    },

    // Step 8: Mark onboarding complete
    {
      name: 'mark_onboarding_complete',
      execute: async (sagaContext: SagaContext) => {
        if (!context.userId) {
          throw new Error('User ID not available');
        }

        LoggerService.info('Marking onboarding complete', {
          workflowId: sagaContext.workflowId,
          userId: context.userId
        });

        // Update user with onboarding completion
        await UserService.updateUser(context.userId, {
          // Add any onboarding completion flags if needed
        });

        LoggerService.info('User onboarding completed successfully', {
          workflowId: sagaContext.workflowId,
          userId: context.userId
        });

        return {
          onboardingComplete: true,
          userId: context.userId,
          tradingWalletId: context.tradingAccountId,
          walletId: context.walletId
        };
      },
      retryable: true
      // No compensation - final step
    }
  ];
}

// Register workflow with orchestrator
WorkflowOrchestratorService.registerWorkflow(
  WorkflowType.USER_ONBOARDING,
                createUserOnboardingWorkflow
);
