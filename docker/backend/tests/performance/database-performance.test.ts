/**
 * Database Performance Tests for Workflow States
 * 
 * Tests database performance for workflow_states table operations
 */

import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';
import { DatabaseService } from '../../src/services/database';
import { LoggerService } from '../../src/services/logger';
import { v4 as uuidv4 } from 'uuid';

describe('Workflow States Database Performance Tests', () => {
  const TEST_USER_ID = 'test-user-db-perf';
  const TEST_TENANT_ID = 'test-tenant-db-perf';
  let WorkflowStateModel: any;

  beforeAll(async () => {
    await DatabaseService.initialize();
    WorkflowStateModel = DatabaseService.getModel('WorkflowState');
  });

  afterAll(async () => {
    // Cleanup test data
    try {
      await WorkflowStateModel.destroy({
        where: {
          userId: TEST_USER_ID
        }
      });
    } catch (error) {
      LoggerService.error('Error cleaning up test data:', error);
    }
  });

  describe('Insert Performance', () => {
    it('should insert 1000 workflow states efficiently', async () => {
      const count = 1000;
      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < count; i++) {
        promises.push(
          WorkflowStateModel.create({
            id: uuidv4(),
            workflowType: 'user_onboarding',
            userId: TEST_USER_ID,
            tenantId: TEST_TENANT_ID,
            status: 'in_progress',
            currentStep: 'validate_user_data',
            data: {
              email: `test-${i}@example.com`,
              step: i
            },
            metadata: {
              test: true,
              iteration: i
            }
          }).catch(() => null)
        );
      }

      await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / count;

      LoggerService.info('Insert performance:', {
        count,
        totalTime: `${totalTime}ms`,
        avgTime: `${avgTime.toFixed(2)}ms`,
        insertsPerSecond: (count / (totalTime / 1000)).toFixed(2)
      });

      expect(avgTime).toBeLessThan(50); // Average < 50ms per insert
      expect(totalTime).toBeLessThan(60000); // Total < 60s
    }, 120000);

    it('should handle batch inserts efficiently', async () => {
      const batchSize = 100;
      const batches = 10;
      const startTime = Date.now();

      for (let batch = 0; batch < batches; batch++) {
        const records = [];
        for (let i = 0; i < batchSize; i++) {
          records.push({
            id: uuidv4(),
            workflowType: 'trading_order',
            userId: TEST_USER_ID,
            tenantId: TEST_TENANT_ID,
            status: 'pending',
            currentStep: 'validate_order',
            data: {
              symbol: 'BTC-USDT',
              batch: batch,
              index: i
            }
          });
        }

        await WorkflowStateModel.bulkCreate(records);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const totalRecords = batchSize * batches;
      const avgTime = totalTime / totalRecords;

      LoggerService.info('Batch insert performance:', {
        batchSize,
        batches,
        totalRecords,
        totalTime: `${totalTime}ms`,
        avgTime: `${avgTime.toFixed(2)}ms`,
        recordsPerSecond: (totalRecords / (totalTime / 1000)).toFixed(2)
      });

      expect(avgTime).toBeLessThan(10); // Average < 10ms per record in batch
    }, 120000);
  });

  describe('Query Performance', () => {
    beforeAll(async () => {
      // Create test data
      const records = [];
      for (let i = 0; i < 500; i++) {
        records.push({
          id: uuidv4(),
          workflowType: i % 2 === 0 ? 'payment_processing' : 'refund_processing',
          userId: TEST_USER_ID,
          tenantId: TEST_TENANT_ID,
          status: i % 3 === 0 ? 'completed' : i % 3 === 1 ? 'in_progress' : 'failed',
          currentStep: `step_${i % 10}`,
          data: { index: i }
        });
      }
      await WorkflowStateModel.bulkCreate(records);
    }, 60000);

    it('should query workflows by user efficiently', async () => {
      const iterations = 100;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await WorkflowStateModel.findAll({
          where: {
            userId: TEST_USER_ID
          },
          limit: 50
        });
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      LoggerService.info('User query performance:', {
        iterations,
        totalTime: `${totalTime}ms`,
        avgTime: `${avgTime.toFixed(2)}ms`,
        queriesPerSecond: (iterations / (totalTime / 1000)).toFixed(2)
      });

      expect(avgTime).toBeLessThan(100); // Average < 100ms
    }, 30000);

    it('should query workflows by status efficiently', async () => {
      const iterations = 100;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await WorkflowStateModel.findAll({
          where: {
            userId: TEST_USER_ID,
            status: 'in_progress'
          }
        });
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      LoggerService.info('Status query performance:', {
        iterations,
        totalTime: `${totalTime}ms`,
        avgTime: `${avgTime.toFixed(2)}ms`
      });

      expect(avgTime).toBeLessThan(150); // Average < 150ms
    }, 30000);

    it('should query workflows by type efficiently', async () => {
      const iterations = 100;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await WorkflowStateModel.findAll({
          where: {
            userId: TEST_USER_ID,
            workflowType: 'payment_processing'
          }
        });
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      LoggerService.info('Type query performance:', {
        iterations,
        totalTime: `${totalTime}ms`,
        avgTime: `${avgTime.toFixed(2)}ms`
      });

      expect(avgTime).toBeLessThan(150); // Average < 150ms
    }, 30000);
  });

  describe('Update Performance', () => {
    let workflowIds: string[] = [];

    beforeAll(async () => {
      // Create test workflows
      const records = [];
      for (let i = 0; i < 200; i++) {
        const id = uuidv4();
        workflowIds.push(id);
        records.push({
          id,
          workflowType: 'token_issuance',
          userId: TEST_USER_ID,
          tenantId: TEST_TENANT_ID,
          status: 'in_progress',
          currentStep: 'validate_request',
          data: { index: i }
        });
      }
      await WorkflowStateModel.bulkCreate(records);
    }, 60000);

    it('should update workflow states efficiently', async () => {
      const iterations = 100;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const workflowId = workflowIds[i % workflowIds.length];
        await WorkflowStateModel.update(
          {
            status: 'in_progress',
            currentStep: `step_${i % 10}`,
            data: {
              updated: true,
              iteration: i
            },
            updatedAt: new Date()
          },
          {
            where: { id: workflowId }
          }
        );
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      LoggerService.info('Update performance:', {
        iterations,
        totalTime: `${totalTime}ms`,
        avgTime: `${avgTime.toFixed(2)}ms`,
        updatesPerSecond: (iterations / (totalTime / 1000)).toFixed(2)
      });

      expect(avgTime).toBeLessThan(50); // Average < 50ms
    }, 30000);
  });

  describe('Index Performance', () => {
    it('should use indexes efficiently for common queries', async () => {
      const queries = [
        {
          name: 'User + Status',
          where: {
            userId: TEST_USER_ID,
            status: 'completed'
          }
        },
        {
          name: 'User + Type',
          where: {
            userId: TEST_USER_ID,
            workflowType: 'payment_processing'
          }
        },
        {
          name: 'Tenant + Status',
          where: {
            tenantId: TEST_TENANT_ID,
            status: 'in_progress'
          }
        }
      ];

      for (const query of queries) {
        const startTime = Date.now();
        const iterations = 50;

        for (let i = 0; i < iterations; i++) {
          await WorkflowStateModel.findAll({
            where: query.where,
            limit: 20
          });
        }

        const endTime = Date.now();
        const totalTime = endTime - startTime;
        const avgTime = totalTime / iterations;

        LoggerService.info(`Index performance (${query.name}):`, {
          iterations,
          totalTime: `${totalTime}ms`,
          avgTime: `${avgTime.toFixed(2)}ms`
        });

        expect(avgTime).toBeLessThan(100); // Average < 100ms with indexes
      }
    }, 60000);
  });
});
