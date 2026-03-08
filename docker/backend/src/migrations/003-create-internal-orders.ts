/**
 * Migration: Create internal_orders table
 */

export async function up(queryInterface: any, Sequelize: any): Promise<void> {
  await queryInterface.createTable('internal_orders', {
    id: {
      type: Sequelize.STRING,
      primaryKey: true
    },
    tenantId: {
      type: Sequelize.STRING,
      allowNull: false
    },
    brokerId: {
      type: Sequelize.STRING,
      allowNull: false
    },
    userId: {
      type: Sequelize.STRING,
      allowNull: false
    },
    exchangeId: {
      type: Sequelize.STRING,
      allowNull: false
    },
    symbol: {
      type: Sequelize.STRING,
      allowNull: false
    },
    side: {
      type: Sequelize.ENUM('buy', 'sell'),
      allowNull: false
    },
    type: {
      type: Sequelize.ENUM('market', 'limit', 'stop', 'stop_limit'),
      allowNull: false
    },
    amount: {
      type: Sequelize.DECIMAL(36, 18),
      allowNull: false
    },
    price: {
      type: Sequelize.DECIMAL(36, 18),
      allowNull: true
    },
    status: {
      type: Sequelize.ENUM('pending', 'allocated', 'submitted', 'partial', 'filled', 'cancelled', 'rejected'),
      allowNull: false,
      defaultValue: 'pending'
    },
    allocatedAmount: {
      type: Sequelize.DECIMAL(36, 18),
      allowNull: false
    },
    filledAmount: {
      type: Sequelize.DECIMAL(36, 18),
      allowNull: false,
      defaultValue: '0'
    },
    averagePrice: {
      type: Sequelize.DECIMAL(36, 18),
      allowNull: false,
      defaultValue: '0'
    },
    fees: {
      type: Sequelize.DECIMAL(36, 18),
      allowNull: false,
      defaultValue: '0'
    },
    externalOrderId: {
      type: Sequelize.STRING,
      allowNull: true
    },
    fundAllocation: {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    compliance: {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    metadata: {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {}
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

  // Idempotent index creation for repeated test migrations.
  await queryInterface.sequelize.query(
    'CREATE INDEX IF NOT EXISTS "internal_orders_tenant_id_broker_id_user_id" ON "internal_orders" ("tenantId", "brokerId", "userId")'
  );
  await queryInterface.sequelize.query(
    'CREATE INDEX IF NOT EXISTS "internal_orders_status" ON "internal_orders" ("status")'
  );
  await queryInterface.sequelize.query(
    'CREATE INDEX IF NOT EXISTS "internal_orders_exchange_id" ON "internal_orders" ("exchangeId")'
  );
  await queryInterface.sequelize.query(
    'CREATE INDEX IF NOT EXISTS "internal_orders_external_order_id" ON "internal_orders" ("externalOrderId")'
  );
  await queryInterface.sequelize.query(
    'CREATE INDEX IF NOT EXISTS "internal_orders_created_at" ON "internal_orders" ("createdAt")'
  );
}

export async function down(queryInterface: any): Promise<void> {
  await queryInterface.dropTable('internal_orders');
}
