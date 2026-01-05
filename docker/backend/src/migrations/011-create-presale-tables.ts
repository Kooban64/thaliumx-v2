/**
 * Migration: Create Presale Tables
 *
 * Adds persistence for the token presale subsystem.
 *
 * Tables:
 * - presales (configured presales)
 * - presale_investments (user investments)
 * - presale_whitelist (whitelist entries)
 *
 * Notes:
 * - `userId` is stored as STRING because the platform now uses Keycloak as
 *   the system-of-record; the Keycloak `sub` is not the same as the legacy
 *   DB `users.id` UUID.
 * - Amounts are stored as DECIMAL and JSONB metadata keeps extra fields.
 */

import type { QueryInterface} from 'sequelize';
import { DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  const tables = await queryInterface.showAllTables();

  if (!tables.includes('presales')) {
    await queryInterface.createTable('presales', {
      id: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
      tenantId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'tenants', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      name: { type: DataTypes.STRING, allowNull: false },
      symbol: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false },
      phase: { type: DataTypes.STRING, allowNull: false },
      status: { type: DataTypes.STRING, allowNull: false },
      startDate: { type: DataTypes.DATE, allowNull: false },
      endDate: { type: DataTypes.DATE, allowNull: false },
      tokenPrice: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      totalSupply: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      availableSupply: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      minInvestment: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      maxInvestment: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      softCap: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      hardCap: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      raisedAmount: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      tiers: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      vestingSchedule: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      whitelistRequired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      kycRequired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      referralEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      bonusEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      smartContractAddress: { type: DataTypes.STRING, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });

    await queryInterface.addIndex('presales', ['tenantId'], { name: 'idx_presales_tenant_id' });
    await queryInterface.addIndex('presales', ['status'], { name: 'idx_presales_status' });
    await queryInterface.addIndex('presales', ['phase'], { name: 'idx_presales_phase' });
  }

  if (!tables.includes('presale_investments')) {
    await queryInterface.createTable('presale_investments', {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
      presaleId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: { model: 'presales', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      userId: { type: DataTypes.STRING, allowNull: false },
      tenantId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'tenants', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      attributedBrokerId: { type: DataTypes.STRING, allowNull: true },
      tier: { type: DataTypes.STRING, allowNull: false },
      amount: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      tokenAmount: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      bonusAmount: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      referralCode: { type: DataTypes.STRING, allowNull: true },
      referralBonus: { type: DataTypes.DECIMAL(36, 18), allowNull: true },
      paymentMethod: { type: DataTypes.STRING, allowNull: false },
      paymentAddress: { type: DataTypes.STRING, allowNull: true },
      transactionHash: { type: DataTypes.STRING, allowNull: true },
      kycLevel: { type: DataTypes.STRING, allowNull: true },
      status: { type: DataTypes.STRING, allowNull: false },
      vestingSchedule: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });

    await queryInterface.addIndex('presale_investments', ['presaleId'], { name: 'idx_presale_investments_presale_id' });
    await queryInterface.addIndex('presale_investments', ['userId'], { name: 'idx_presale_investments_user_id' });
    await queryInterface.addIndex('presale_investments', ['tenantId'], { name: 'idx_presale_investments_tenant_id' });
    await queryInterface.addIndex('presale_investments', ['status'], { name: 'idx_presale_investments_status' });
    await queryInterface.addIndex('presale_investments', ['presaleId', 'userId'], { name: 'idx_presale_investments_presale_user' });
  }

  if (!tables.includes('presale_whitelist')) {
    await queryInterface.createTable('presale_whitelist', {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false, defaultValue: DataTypes.UUIDV4 },
      presaleId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: { model: 'presales', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      userId: { type: DataTypes.STRING, allowNull: false },
      email: { type: DataTypes.STRING, allowNull: false },
      walletAddress: { type: DataTypes.STRING, allowNull: false },
      tier: { type: DataTypes.STRING, allowNull: false },
      maxInvestment: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      kycLevel: { type: DataTypes.STRING, allowNull: true },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
      referralCode: { type: DataTypes.STRING, allowNull: true },
      referredBy: { type: DataTypes.STRING, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });

    await queryInterface.addIndex('presale_whitelist', ['presaleId'], { name: 'idx_presale_whitelist_presale_id' });
    await queryInterface.addIndex('presale_whitelist', ['userId'], { name: 'idx_presale_whitelist_user_id' });
    await queryInterface.addIndex('presale_whitelist', ['status'], { name: 'idx_presale_whitelist_status' });
    await queryInterface.addIndex('presale_whitelist', ['presaleId', 'userId'], { name: 'idx_presale_whitelist_presale_user', unique: true });
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  const tables = await queryInterface.showAllTables();
  if (tables.includes('presale_whitelist')) await queryInterface.dropTable('presale_whitelist');
  if (tables.includes('presale_investments')) await queryInterface.dropTable('presale_investments');
  if (tables.includes('presales')) await queryInterface.dropTable('presales');
}

