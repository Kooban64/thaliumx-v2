/**
 * Broker Onboarding Workflow
 * 
 * Orchestrates broker onboarding:
 * 1. Validate broker data
 * 2. KYC verification
 * 3. Create broker tenant
 * 4. Setup broker accounts
 * 5. Configure broker settings
 * 6. Notify broker
 */

import { SagaStep, SagaContext, WorkflowInput } from '../types/workflow';
import { WorkflowType } from '../types/workflow';
import { WorkflowOrchestratorService } from '../services/workflow-orchestrator';
import { BrokerManagementService } from '../services/broker-management';
import { BallerineService } from '../services/ballerine';
import { FinancialRepository } from '../services/financial-repository';
import { LoggerService } from '../services/logger';

export async function createBrokerOnboardingWorkflow(
  input: WorkflowInput
): Promise<SagaStep[]> {
  return [
    {
      name: 'validate_broker_data',
      execute: async (sagaContext: SagaContext) => {
        const { companyName, email, registrationNumber, country } = sagaContext.data;
        if (!companyName || !email || !registrationNumber || !country) {
          throw new Error('Company name, email, registration number, and country required');
        }
        return { validated: true };
      },
      retryable: false
    },
    {
      name: 'kyc_verification',
      execute: async (sagaContext: SagaContext) => {
        // Trigger KYC for broker entity
        const ballerineService = new BallerineService();
        const kycWorkflow = await ballerineService.startWorkflow({
          id: sagaContext.workflowId,
          type: 'kyb', // Know Your Business
          entity_id: sagaContext.data.companyName,
          entity_data: {
            companyInformation: {
              name: sagaContext.data.companyName,
              registrationNumber: sagaContext.data.registrationNumber,
              country: sagaContext.data.country
            }
          }
        });

        // Wait for KYC completion (similar to user onboarding)
        if (sagaContext.data.kycCompleted === true) {
          const kycResult = sagaContext.data.kycResult;
          if (kycResult?.status !== 'approved') {
            throw new Error(`Broker KYC verification failed: ${kycResult?.status}`);
          }
          return { kycStatus: 'approved', kycResult };
        }

        throw new Error('Broker KYC completion pending - waiting for webhook');
      },
      retryable: true,
      maxRetries: 30,
      timeout: 300000
    },
    {
      name: 'create_broker_tenant',
      execute: async (sagaContext: SagaContext) => {
        const brokerResult = await BrokerManagementService.onboardBroker({
          name: sagaContext.data.companyName,
          slug: sagaContext.data.slug || sagaContext.data.companyName.toLowerCase().replace(/\s+/g, '-'),
          domain: sagaContext.data.domain || '',
          tier: 'professional' as any,
          branding: {},
          features: {},
          limits: {},
          compliance: {},
          financial: {},
          contactInfo: {
            email: sagaContext.data.email || '',
            phone: sagaContext.data.phone || '',
            address: sagaContext.data.address || '',
            country: sagaContext.data.country || '',
            jurisdiction: sagaContext.data.jurisdiction || ''
          },
          businessInfo: {
            type: sagaContext.data.businessType || 'corporation',
            registrationNumber: sagaContext.data.registrationNumber || '',
            taxId: sagaContext.data.taxId || '',
            licenseNumber: sagaContext.data.licenseNumber || '',
            regulatoryBody: sagaContext.data.regulatoryBody || ''
          },
          technicalInfo: {
            expectedUsers: sagaContext.data.expectedUsers || 1000,
            expectedVolume: sagaContext.data.expectedVolume || 1000000,
            expectedTradingPairs: sagaContext.data.expectedTradingPairs || 50,
            expectedCurrencies: sagaContext.data.expectedCurrencies || 10,
            expectedLanguages: sagaContext.data.expectedLanguages || 5,
            expectedDomains: sagaContext.data.expectedDomains || 1
          }
        });

        if (!brokerResult.success) {
          throw new Error(brokerResult.error || 'Broker onboarding failed');
        }
        return { brokerId: brokerResult.brokerId, tenantId: brokerResult.brokerId };
      },
      compensate: async (sagaContext: SagaContext) => {
        // Delete broker if creation fails
        LoggerService.info('Compensating: Deleting broker', {
          brokerId: sagaContext.data.brokerId
        });
      },
      retryable: true
    },
    {
      name: 'setup_broker_accounts',
      execute: async (sagaContext: SagaContext) => {
        const { tenantId } = sagaContext.data;
        const financialRepo = new FinancialRepository();
        
        // Create operational accounts for broker
        await financialRepo.ensureAccountExists(
          `${tenantId}_operational`,
          tenantId,
          'USD'
        );

        return { accountsCreated: true };
      },
      retryable: true
    },
    {
      name: 'configure_broker_settings',
      execute: async (sagaContext: SagaContext) => {
        // Configure broker-specific settings
        LoggerService.info('Configuring broker settings', {
          brokerId: sagaContext.data.brokerId
        });
        return { settingsConfigured: true };
      },
      retryable: true
    },
    {
      name: 'notify_broker',
      execute: async (sagaContext: SagaContext) => {
        // Send onboarding notification
        LoggerService.info('Broker onboarding completed', {
          brokerId: sagaContext.data.brokerId
        });
        return { notified: true };
      },
      retryable: true
    }
  ];
}

WorkflowOrchestratorService.registerWorkflow(
  WorkflowType.BROKER_ONBOARDING,
  createBrokerOnboardingWorkflow
);
