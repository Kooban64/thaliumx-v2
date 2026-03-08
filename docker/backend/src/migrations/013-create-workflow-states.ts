/**
 * Migration: Create workflow_states table
 * 
 * Creates the workflow_states table for workflow orchestrator state persistence.
 * This table stores the state of all running and completed workflows.
 */

import type { QueryInterface} from 'sequelize';
import { DataTypes } from 'sequelize';

const addIndexIfMissing = async (
  queryInterface: QueryInterface,
  tableName: string,
  fields: string[],
  name: string,
): Promise<void> => {
  const existingIndexes = (await queryInterface.showIndex(tableName)) as Array<{ name?: string }>;
  if (existingIndexes.some(index => index.name === name)) {
    return;
  }

  await queryInterface.addIndex(tableName, fields, { name });
};

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  await queryInterface.createTable('workflow_states', {
    workflow_id: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      allowNull: false
    },
    workflow_type: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    tenant_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'tenants',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    broker_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'running', 'completed', 'failed', 'cancelled', 'compensating'),
      allowNull: false,
      defaultValue: 'pending'
    },
    current_step: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    step_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    retry_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    max_retries: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    }
  });

  // Create indexes for performance
  await addIndexIfMissing(queryInterface, 'workflow_states', ['user_id'], 'idx_workflow_states_user');

  await addIndexIfMissing(queryInterface, 'workflow_states', ['status'], 'idx_workflow_states_status');

  await addIndexIfMissing(queryInterface, 'workflow_states', ['workflow_type'], 'idx_workflow_states_type');

  await addIndexIfMissing(queryInterface, 'workflow_states', ['tenant_id'], 'idx_workflow_states_tenant');

  await addIndexIfMissing(queryInterface, 'workflow_states', ['created_at'], 'idx_workflow_states_created_at');

  await addIndexIfMissing(
    queryInterface,
    'workflow_states',
    ['status', 'workflow_type'],
    'idx_workflow_states_status_type',
  );
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  await queryInterface.dropTable('workflow_states');
};
