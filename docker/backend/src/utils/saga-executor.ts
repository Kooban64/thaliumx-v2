/**
 * Saga Executor
 * 
 * Lightweight saga pattern implementation for workflow orchestration.
 * Supports compensation (rollback) logic and retry mechanisms.
 */

import { SagaStep, SagaContext, SagaResult } from '../types/workflow';
import { LoggerService } from '../services/logger';

export class SagaExecutor {
  /**
   * Execute a saga with compensation support
   */
  static async execute(
    steps: SagaStep[],
    context: SagaContext,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      enableCompensation?: boolean;
    } = {}
  ): Promise<SagaResult> {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      enableCompensation = true
    } = options;

    const executedSteps: string[] = [];
    const compensatedSteps: string[] = [];
    const stepResults = new Map<string, any>();

    LoggerService.info('Starting saga execution', {
      workflowId: context.workflowId,
      workflowType: context.workflowType,
      stepCount: steps.length
    });

    try {
      // Execute each step in sequence
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (!step) {
          throw new Error(`Step at index ${i} is undefined`);
        }

        const stepContext = {
          ...context,
          stepResults
        };

        LoggerService.info('Executing saga step', {
          workflowId: context.workflowId,
          stepName: step.name,
          stepIndex: i
        });

        // Execute step with retry logic
        let result: any;
        let attempts = 0;
        const stepMaxRetries = step.maxRetries ?? maxRetries;
        const isRetryable = step.retryable !== false;

        while (attempts <= stepMaxRetries) {
          try {
            // Set timeout if specified
            if (step.timeout) {
              result = await Promise.race([
                step.execute(stepContext),
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error(`Step timeout: ${step.name}`)), step.timeout)
                )
              ]);
            } else {
              result = await step.execute(stepContext);
            }

            // Step succeeded
            stepResults.set(step.name, result);
            executedSteps.push(step.name);
            break;
          } catch (error: any) {
            attempts++;
            const isLastAttempt = attempts > stepMaxRetries;

            LoggerService.warn('Saga step failed', {
              workflowId: context.workflowId,
              stepName: step.name,
              attempt: attempts,
              maxRetries: stepMaxRetries,
              error: error.message
            });

            if (isLastAttempt || !isRetryable) {
              // Step failed permanently - start compensation
              LoggerService.error('Saga step failed permanently, starting compensation', {
                workflowId: context.workflowId,
                stepName: step.name,
                error: error.message
              });

              if (enableCompensation && executedSteps.length > 0) {
                await this.compensate(executedSteps, steps, stepContext, compensatedSteps);
              }

              return {
                success: false,
                workflowId: context.workflowId,
                error: error,
                compensated: compensatedSteps.length > 0,
                stepsExecuted: executedSteps,
                stepsCompensated: compensatedSteps
              };
            }

            // Wait before retry with exponential backoff
            const delay = retryDelay * Math.pow(2, attempts - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // All steps succeeded
      LoggerService.info('Saga execution completed successfully', {
        workflowId: context.workflowId,
        stepsExecuted: executedSteps.length
      });

      return {
        success: true,
        workflowId: context.workflowId,
        result: stepResults,
        compensated: false,
        stepsExecuted: executedSteps,
        stepsCompensated: compensatedSteps
      };
    } catch (error: any) {
      LoggerService.error('Saga execution failed', {
        workflowId: context.workflowId,
        error: error.message,
        stepsExecuted: executedSteps.length
      });

      // Compensate if enabled
      if (enableCompensation && executedSteps.length > 0) {
        const stepContext = {
          ...context,
          stepResults
        };
        await this.compensate(executedSteps, steps, stepContext, compensatedSteps);
      }

      return {
        success: false,
        workflowId: context.workflowId,
        error: error,
        compensated: compensatedSteps.length > 0,
        stepsExecuted: executedSteps,
        stepsCompensated: compensatedSteps
      };
    }
  }

  /**
   * Compensate (rollback) executed steps in reverse order
   */
  private static async compensate(
    executedSteps: string[],
    allSteps: SagaStep[],
    context: SagaContext,
    compensatedSteps: string[]
  ): Promise<void> {
    LoggerService.info('Starting saga compensation', {
      workflowId: context.workflowId,
      stepsToCompensate: executedSteps.length
    });

    // Compensate in reverse order
    for (let i = executedSteps.length - 1; i >= 0; i--) {
      const stepName = executedSteps[i];
      if (!stepName) {
        continue;
      }

      const step = allSteps.find(s => s && s.name === stepName);

      if (!step || !step.compensate) {
        LoggerService.warn('Step has no compensation function', {
          workflowId: context.workflowId,
          stepName
        });
        continue;
      }

      try {
        LoggerService.info('Compensating step', {
          workflowId: context.workflowId,
          stepName
        });

        await step.compensate(context);
        compensatedSteps.push(stepName);

        LoggerService.info('Step compensated successfully', {
          workflowId: context.workflowId,
          stepName
        });
      } catch (error: any) {
        LoggerService.error('Compensation failed', {
          workflowId: context.workflowId,
          stepName,
          error: error.message
        });
        // Continue compensating other steps even if one fails
      }
    }

    LoggerService.info('Saga compensation completed', {
      workflowId: context.workflowId,
      stepsCompensated: compensatedSteps.length
    });
  }
}
