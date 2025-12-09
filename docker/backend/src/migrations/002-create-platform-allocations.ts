/**
 * Migration: Create platform_allocations table
 */

export async function up(queryInterface: any, Sequelize: any): Promise<void> {
  await queryInterface.createTable('platform_allocations', {
    id: {
      type: Sequelize.STRING,
      primaryKey: true
    },
    exchangeId: {
      type: Sequelize.STRING,
      allowNull: false
    },
    asset: {
      type: Sequelize.STRING,
      allowNull: false
    },
    totalPlatformBalance: {
      type: Sequelize.DECIMAL(36, 18),
      allowNull: false,
      defaultValue: '0'
    },
    availableForAllocation: {
      type: Sequelize.DECIMAL(36, 18),
      allowNull: false,
      defaultValue: '0'
    },
    brokerAllocations: {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    customerAllocations: {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    lastUpdated: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW
    }
  });

  await queryInterface.addIndex('platform_allocations', ['exchangeId', 'asset'], {
    unique: true,
    name: 'platform_allocations_exchange_asset_unique'
  });
}

export async function down(queryInterface: any): Promise<void> {
  await queryInterface.dropTable('platform_allocations');
}

