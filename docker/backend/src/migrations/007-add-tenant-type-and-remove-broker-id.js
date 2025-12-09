"use strict";
/**
 * Migration: Add tenantType field and remove brokerId from Client/FinancialAccount
 *
 * This migration implements Option 1: Simple Binary architecture
 * - Tenant can be 'regular', 'broker', or 'platform'
 * - For broker-tenants, tenantId = brokerId (same value)
 * - Clients belong to broker-tenants via tenantId only
 * - FinancialAccounts use tenantId only (brokerId removed)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const sequelize_1 = require("sequelize");
async function up(queryInterface) {
    // Step 1: Add tenantType field to tenants table
    await queryInterface.addColumn('tenants', 'tenantType', {
        type: sequelize_1.DataTypes.ENUM('regular', 'broker', 'platform'),
        allowNull: false,
        defaultValue: 'regular',
        comment: 'Type of tenant: regular (users sign up), broker (manages clients), platform (platform oversight)'
    });
    // Step 2: Add index on tenantType for fast queries
    await queryInterface.addIndex('tenants', ['tenantType'], {
        name: 'idx_tenants_tenant_type'
    });
    // Step 3: Add composite index for common queries
    await queryInterface.addIndex('tenants', ['tenantType', 'isActive'], {
        name: 'idx_tenants_type_active'
    });
    // Step 4: For existing data, try to infer tenantType from existing clients
    // If tenant has clients, it's likely a broker
    const [results] = await queryInterface.sequelize.query(`
    SELECT DISTINCT t.id
    FROM tenants t
    INNER JOIN clients c ON c."tenantId" = t.id
  `);
    const brokerTenantIds = results.map(r => r.id);
    if (brokerTenantIds.length > 0) {
        await queryInterface.sequelize.query(`
      UPDATE tenants
      SET "tenantType" = 'broker'
      WHERE id IN (${brokerTenantIds.map(id => `'${id}'`).join(',')})
    `);
    }
    // Step 5: Remove brokerId column from clients table
    // First, ensure all clients belong to broker-tenants
    await queryInterface.sequelize.query(`
    UPDATE clients
    SET "tenantId" = COALESCE(
      (SELECT t.id FROM tenants t WHERE t.id::text = clients."brokerId" LIMIT 1),
      clients."tenantId"
    )
    WHERE "brokerId" IS NOT NULL
  `);
    await queryInterface.removeColumn('clients', 'brokerId');
    // Step 6: Remove brokerId column from accounts table (FinancialAccount)
    await queryInterface.removeColumn('accounts', 'brokerId');
    // Step 7: Remove indexes that included brokerId
    try {
        await queryInterface.removeIndex('clients', 'clients_tenantId_brokerId');
    }
    catch (e) {
        // Index might not exist, ignore
    }
    try {
        await queryInterface.removeIndex('accounts', 'accounts_tenantId_brokerId_clientId');
    }
    catch (e) {
        // Index might not exist, ignore
    }
}
async function down(queryInterface) {
    // Reverse migration - add brokerId back
    // Add brokerId back to clients (as optional for backward compatibility)
    await queryInterface.addColumn('clients', 'brokerId', {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        comment: 'Broker ID - for broker-tenants, this equals tenantId'
    });
    // Add brokerId back to accounts
    await queryInterface.addColumn('accounts', 'brokerId', {
        type: sequelize_1.DataTypes.STRING,
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
    }
    catch (e) {
        // Indexes might not exist, ignore
    }
}
//# sourceMappingURL=007-add-tenant-type-and-remove-broker-id.js.map