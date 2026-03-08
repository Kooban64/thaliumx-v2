/**
 * Migration: Create reconciliation_snapshots table
 */

export async function up(queryInterface: any, Sequelize: any): Promise<void> {
  const tables = await queryInterface.showAllTables();

  if (!tables.includes('reconciliation_snapshots')) {
    await queryInterface.createTable('reconciliation_snapshots', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      snapshotAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      platformTotals: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      exchangeBalances: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      internalAllocations: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      reconciliation: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });
  }

  try {
    await queryInterface.addIndex('reconciliation_snapshots', ['snapshotAt'], {
      name: 'reconciliation_snapshots_snapshot_at',
    });
  } catch (error: any) {
    if (!error?.message?.includes('already exists')) {
      throw error;
    }
  }
}

export async function down(queryInterface: any): Promise<void> {
  await queryInterface.dropTable('reconciliation_snapshots');
}
