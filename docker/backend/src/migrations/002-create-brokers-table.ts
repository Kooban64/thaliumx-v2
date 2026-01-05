/**
 * Migration: Create Brokers Table
 *
 * Creates the brokers table for managing broker entities in the multi-tenant architecture.
 * Brokers are special tenants that can manage client accounts and have additional
 * configuration for tiered service levels.
 */

import type { QueryInterface} from 'sequelize';
import { DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  const tables = await queryInterface.showAllTables();

  if (!tables.includes('brokers')) {
    await queryInterface.createTable('brokers', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Display name of the broker'
      },
      slug: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: 'URL-friendly identifier for the broker'
      },
      domain: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Domain associated with this broker'
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'suspended'),
        allowNull: false,
        defaultValue: 'active',
        comment: 'Operational status of the broker'
      },
      tier: {
        type: DataTypes.ENUM('basic', 'professional', 'enterprise'),
        allowNull: false,
        defaultValue: 'basic',
        comment: 'Service tier determining features and limits'
      },
      tenantId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'tenants',
          key: 'id'
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
        comment: 'Associated tenant for this broker'
      },
      settings: {
        type: DataTypes.JSONB,
        defaultValue: {},
        allowNull: false,
        comment: 'Broker-specific configuration settings'
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    // Create indexes for brokers table
    await queryInterface.addIndex('brokers', ['slug'], {
      name: 'idx_brokers_slug',
      unique: true
    });

    await queryInterface.addIndex('brokers', ['domain'], {
      name: 'idx_brokers_domain'
    });

    await queryInterface.addIndex('brokers', ['status'], {
      name: 'idx_brokers_status'
    });

    await queryInterface.addIndex('brokers', ['tier'], {
      name: 'idx_brokers_tier'
    });

    await queryInterface.addIndex('brokers', ['tenantId'], {
      name: 'idx_brokers_tenant_id'
    });

    await queryInterface.addIndex('brokers', ['status', 'tier'], {
      name: 'idx_brokers_status_tier'
    });
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  const tables = await queryInterface.showAllTables();

  if (tables.includes('brokers')) {
    await queryInterface.dropTable('brokers');
  }
}