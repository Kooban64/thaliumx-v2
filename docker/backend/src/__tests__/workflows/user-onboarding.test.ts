/**
 * User Onboarding Workflow Tests
 * 
 * Tests for the user onboarding workflow including:
 * - Successful onboarding
 * - KYC integration
 * - Compensation on failure
 */

import { describe, expect, it, jest } from '@jest/globals';
import { createUserOnboardingWorkflow } from '../../workflows/user-onboarding';
import type { WorkflowInput, SagaContext } from '../../types/workflow';
import { WorkflowType } from '../../types/workflow';

// Mock services
jest.mock('../../services/user');
jest.mock('../../services/ballerine');
jest.mock('../../services/wallet-system');
jest.mock('../../services/email');
jest.mock('../../services/database');
jest.mock('../../services/logger');

describe('User Onboarding Workflow', () => {
  const mockInput: WorkflowInput = {
    workflowType: WorkflowType.USER_ONBOARDING,
    userId: 'test-user-id',
    tenantId: 'test-tenant-id',
    data: {
      email: 'test@example.com',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      phoneNumber: '+1234567890'
    }
  };

  const mockContext: SagaContext = {
    workflowId: 'test-workflow-id',
    workflowType: WorkflowType.USER_ONBOARDING,
    data: mockInput.data,
    stepResults: new Map(),
    userId: mockInput.userId,
    tenantId: mockInput.tenantId
  };

  it('should create workflow with correct steps', async () => {
    const steps = await createUserOnboardingWorkflow(mockInput);

    expect(steps).toHaveLength(8);
    expect(steps[0].name).toBe('validate_user_data');
    expect(steps[1].name).toBe('trigger_kyc_verification');
    expect(steps[2].name).toBe('wait_for_kyc_completion');
    expect(steps[3].name).toBe('create_user_account');
    expect(steps[4].name).toBe('create_trading_account');
    expect(steps[5].name).toBe('setup_wallet');
    expect(steps[6].name).toBe('send_welcome_email');
    expect(steps[7].name).toBe('mark_onboarding_complete');
  });

  it('should validate user data step', async () => {
    const steps = await createUserOnboardingWorkflow(mockInput);
    const validateStep = steps[0];

    const result = await validateStep.execute(mockContext);

    expect(result.validated).toBe(true);
  });

  it('should fail validation if required fields missing', async () => {
    const steps = await createUserOnboardingWorkflow(mockInput);
    const validateStep = steps[0];

    const invalidContext = {
      ...mockContext,
      data: { email: 'test@example.com' } // Missing required fields
    };

    await expect(validateStep.execute(invalidContext)).rejects.toThrow(
      'Missing required user data'
    );
  });

  it('should have compensation for user account creation', async () => {
    const steps = await createUserOnboardingWorkflow(mockInput);
    const createUserStep = steps[3];

    expect(createUserStep.compensate).toBeDefined();
  });

  it('should have compensation for wallet setup', async () => {
    const steps = await createUserOnboardingWorkflow(mockInput);
    const walletStep = steps[4];

    expect(walletStep.compensate).toBeDefined();
  });
});
