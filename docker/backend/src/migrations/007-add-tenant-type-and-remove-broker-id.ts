/**
 * Migration: Add tenantType field and remove brokerId from Client/FinancialAccount
 * 
 * This migration implements Option 1: Simple Binary architecture
 * - Tenant can be 'regular', 'broker', or 'platform'
 * - For broker-tenants, tenantId = brokerId (same value)
 * - Clients belong to broker-tenants via tenantId only
 * - FinancialAccounts use tenantId only (brokerId removed)
 */

import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // Step 1: Add tenantType field to tenants table
  // Check if column already exists
  const tableDescription = await queryInterface.describeTable('tenants');
  if (!tableDescription.tenantType) {
    // Use raw SQL to avoid Sequelize ENUM issues
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        CREATE TYPE "enum_tenants_tenantType" AS ENUM('regular', 'broker', 'platform');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END
      $$;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE tenants ADD COLUMN "tenantType" "enum_tenants_tenantType" NOT NULL DEFAULT 'regular';
    `);

    await queryInterface.sequelize.query(`
      COMMENT ON COLUMN tenants."tenantType" IS 'Type of tenant: regular (users sign up), broker (manages clients), platform (platform oversight)';
    `);
  } else {
    console.log('tenantType column already exists, skipping addition');
  }

  // Step 2: Add index on tenantType for fast queries
  try {
    await queryInterface.addIndex('tenants', ['tenantType'], {
      name: 'idx_tenants_tenant_type'
    });
  } catch (error: any) {
    if (!error.message?.includes('already exists')) {
      throw error;
    }
    console.log('idx_tenants_tenant_type index already exists, skipping');
  }

  // Step 3: Add composite index for common queries
  // NOTE: legacy schemas used `status`; current schema uses `isActive`.
  const activeColumn = tableDescription.status
    ? 'status'
    : (tableDescription.isActive ? 'isActive' : null);

  if (activeColumn) {
    try {
      await queryInterface.addIndex('tenants', ['tenantType', activeColumn], {
        name: 'idx_tenants_type_active'
      });
    } catch (error: any) {
      if (!error.message?.includes('already exists')) {
        throw error;
      }
      console.log('idx_tenants_type_active index already exists, skipping');
    }
  } else {
    console.log('No active flag column found on tenants (expected status or isActive); skipping idx_tenants_type_active');
  }

  // Step 4: For existing data, try to infer tenantType from existing users/accounts
  // If tenant has users, it's likely a broker.
  // NOTE: schemas differ between legacy (tenant_id) and current (tenantId).
  let userTenantJoinColumn: string | null = null;
  try {
    const usersDescription = await queryInterface.describeTable('users');
    userTenantJoinColumn = usersDescription.tenant_id
      ? 'tenant_id'
      : (usersDescription.tenantId ? '"tenantId"' : null);
  } catch {
    // users table might not exist in some minimal deployments
    userTenantJoinColumn = null;
  }

  if (userTenantJoinColumn) {
    const [results] = await queryInterface.sequelize.query(`
      SELECT DISTINCT t.id
      FROM tenants t
      INNER JOIN users u ON u.${userTenantJoinColumn} = t.id
    `);

    const brokerTenantIds = (results as any[]).map(r => r.id);
    if (brokerTenantIds.length > 0) {
      await queryInterface.sequelize.query(`
        UPDATE tenants
        SET "tenantType" = 'broker'
        WHERE id IN (${brokerTenantIds.map(id => `'${id}'`).join(',')})
      `);
    }
  } else {
    console.log('users.tenantId/tenant_id column not found; skipping broker tenant inference');
  }

  // Step 5: Check if clients table exists and handle brokerId removal
  const tables = await queryInterface.showAllTables();
  if (tables.includes('clients')) {
    // Remove brokerId column from clients table if it exists
    const clientTableDescription = await queryInterface.describeTable('clients');
    if (clientTableDescription.brokerId) {
      await queryInterface.removeColumn('clients', 'brokerId');
    }
  }

  // Step 6: Remove brokerId column from accounts table if it exists
  if (tables.includes('accounts')) {
    const accountTableDescription = await queryInterface.describeTable('accounts');
    if (accountTableDescription.brokerId) {
      await queryInterface.removeColumn('accounts', 'brokerId');
    }
  } else {
    console.log('accounts table not found; skipping brokerId removal');
  }

  // Step 7: Remove indexes that included brokerId
  try {
    await queryInterface.removeIndex('clients', 'clients_tenantId_brokerId');
  } catch (e) {
    // Index might not exist, ignore
  }

  try {
    await queryInterface.removeIndex('accounts', 'accounts_tenantId_brokerId_clientId');
  } catch (e) {
    // Index might not exist, ignore
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  // Reverse migration - add brokerId back
  
  // Add brokerId back to clients (as optional for backward compatibility)
  await queryInterface.addColumn('clients', 'brokerId', {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Broker ID - for broker-tenants, this equals tenantId'
  });

  // Add brokerId back to accounts
  await queryInterface.addColumn('accounts', 'brokerId', {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Broker ID - for broker-tenants, this equals tenantId'
  });

  // Populate brokerId from tenantId for broker-tenants
  await queryInterface.sequelize.query(`
    UPDATE clients
    SET "brokerId" = "tenantId"::text
    WHERE "tenantId" IN (
      SELECT id FROM tenants WHERE "tenantType" = 'broker'
    )
  `);

  await queryInterface.sequelize.query(`
    UPDATE accounts
    SET "brokerId" = "tenantId"::text
    WHERE "tenantId" IN (
      SELECT id FROM tenants WHERE "tenantType" = 'broker'
    )
  `);

  // Remove tenantType column
  await queryInterface.removeColumn('tenants', 'tenantType');

  // Remove indexes
  try {
    await queryInterface.removeIndex('tenants', 'idx_tenants_tenant_type');
    await queryInterface.removeIndex('tenants', 'idx_tenants_type_active');
  } catch (e) {
    // Indexes might not exist, ignore
  }
}
