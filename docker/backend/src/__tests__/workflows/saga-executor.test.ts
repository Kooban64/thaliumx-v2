/**
 * Saga Executor Tests
 * 
 * Tests for the saga pattern executor including:
 * - Successful saga execution
 * - Compensation on failure
 * - Retry logic
 * - Timeout handling
 */

import { SagaExecutor } from '../../utils/saga-executor';
import { SagaStep, SagaContext } from '../../types/workflow';

describe('SagaExecutor', () => {
  describe('execute', () => {
    it('should execute all steps successfully', async () => {
      const steps: SagaStep[] = [
        {
          name: 'step1',
          execute: async () => ({ result: 'step1' })
        },
        {
          name: 'step2',
          execute: async () => ({ result: 'step2' })
        }
      ];

      const context: SagaContext = {
        workflowId: 'test-workflow',
        workflowType: 'user_onboarding' as any,
        data: {},
        stepResults: new Map()
      };

      const result = await SagaExecutor.execute(steps, context);

      expect(result.success).toBe(true);
      expect(result.stepsExecuted).toEqual(['step1', 'step2']);
      expect(result.stepsCompensated).toEqual([]);
    });

    it('should compensate on failure', async () => {
      const compensate1 = jest.fn();
      const compensate2 = jest.fn();

      const steps: SagaStep[] = [
        {
          name: 'step1',
          execute: async () => ({ result: 'step1' }),
          compensate: compensate1
        },
        {
          name: 'step2',
          execute: async () => {
            throw new Error('Step 2 failed');
          },
          compensate: compensate2
        }
      ];

      const context: SagaContext = {
        workflowId: 'test-workflow',
        workflowType: 'user_onboarding' as any,
        data: {},
        stepResults: new Map()
      };

      const result = await SagaExecutor.execute(steps, context);

      expect(result.success).toBe(false);
      expect(result.stepsExecuted).toEqual(['step1']);
      expect(result.compensated).toBe(true);
      expect(compensate1).toHaveBeenCalled();
      expect(compensate2).not.toHaveBeenCalled();
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      const steps: SagaStep[] = [
        {
          name: 'step1',
          execute: async () => {
            attempts++;
            if (attempts < 3) {
              throw new Error('Temporary failure');
            }
            return { result: 'step1' };
          },
          retryable: true,
          maxRetries: 3
        }
      ];

      const context: SagaContext = {
        workflowId: 'test-workflow',
        workflowType: 'user_onboarding' as any,
        data: {},
        stepResults: new Map()
      };

      const result = await SagaExecutor.execute(steps, context);

      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
    });

    it('should handle timeout', async () => {
      const steps: SagaStep[] = [
        {
          name: 'step1',
          execute: async () => {
            await new Promise(resolve => setTimeout(resolve, 2000));
            return { result: 'step1' };
          },
          timeout: 100
        }
      ];

      const context: SagaContext = {
        workflowId: 'test-workflow',
        workflowType: 'user_onboarding' as any,
        data: {},
        stepResults: new Map()
      };

      const result = await SagaExecutor.execute(steps, context);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timeout');
    });
  });
});
