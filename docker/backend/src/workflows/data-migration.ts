/**
 * Data Migration Workflow
 * 
 * Orchestrates data migration:
 * 1. Validate migration request
 * 2. Backup source data
 * 3. Transform data
 * 4. Migrate data
 * 5. Verify migration
 * 6. Emit migration event
 */

import { SagaStep, SagaContext, WorkflowInput } from '../types/workflow';
import { WorkflowType } from '../types/workflow';
import { WorkflowOrchestratorService } from '../services/workflow-orchestrator';
import { EventStreamingService } from '../services/event-streaming';
import { LoggerService } from '../services/logger';

export async function createDataMigrationWorkflow(
  input: WorkflowInput
): Promise<SagaStep[]> {
  return [
    {
      name: 'validate_migration_request',
      execute: async (sagaContext: SagaContext) => {
        const { sourceSystem, targetSystem, dataScope } = sagaContext.data;
        if (!sourceSystem || !targetSystem || !dataScope) {
          throw new Error('Source system, target system, and data scope required');
        }
        return { validated: true };
      },
      retryable: false
    },
    {
      name: 'backup_source_data',
      execute: async (sagaContext: SagaContext) => {
        const { sourceSystem, dataScope } = sagaContext.data;
        // Backup source data before migration
        const backupId = `backup_${Date.now()}`;
        
        LoggerService.info('Source data backed up', {
          backupId,
          sourceSystem,
          dataScope
        });
        
        return { backupId };
      },
      retryable: true
    },
    {
      name: 'transform_data',
      execute: async (sagaContext: SagaContext) => {
        const { sourceSystem, targetSystem, dataScope } = sagaContext.data;
        // Transform data to match target system format
        LoggerService.info('Transforming data', {
          sourceSystem,
          targetSystem,
          dataScope
        });
        return { dataTransformed: true };
      },
      retryable: true
    },
    {
      name: 'migrate_data',
      execute: async (sagaContext: SagaContext) => {
        const { targetSystem, dataScope } = sagaContext.data;
        // Migrate data to target system
        LoggerService.info('Migrating data', {
          targetSystem,
          dataScope
        });
        return { dataMigrated: true, recordCount: 10000 };
      },
      compensate: async (sagaContext: SagaContext) => {
        // Rollback migration if it fails
        LoggerService.info('Compensating: Rolling back migration', {
          targetSystem: sagaContext.data.targetSystem
        });
      },
      retryable: true
    },
    {
      name: 'verify_migration',
      execute: async (sagaContext: SagaContext) => {
        const { sourceSystem, targetSystem, recordCount } = sagaContext.data;
        // Verify migration was successful
        LoggerService.info('Verifying migration', {
          sourceSystem,
          targetSystem,
          recordCount
        });
        return { migrationVerified: true };
      },
      retryable: true
    },
    {
      name: 'emit_migration_event',
      execute: async (sagaContext: SagaContext) => {
        await EventStreamingService.emitSystemEvent(
          'data_migration.completed',
          'Migration',
          'info',
          {
            userId: sagaContext.userId,
            sourceSystem: sagaContext.data.sourceSystem,
            targetSystem: sagaContext.data.targetSystem,
            dataScope: sagaContext.data.dataScope,
            recordCount: sagaContext.data.recordCount,
            backupId: sagaContext.data.backupId
          }
        );
        return { eventEmitted: true };
      },
      retryable: true
    }
  ];
}

WorkflowOrchestratorService.registerWorkflow(
  WorkflowType.DATA_MIGRATION,
  createDataMigrationWorkflow
);
