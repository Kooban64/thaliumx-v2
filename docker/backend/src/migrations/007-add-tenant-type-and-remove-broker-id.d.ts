/**
 * Migration: Add tenantType field and remove brokerId from Client/FinancialAccount
 *
 * This migration implements Option 1: Simple Binary architecture
 * - Tenant can be 'regular', 'broker', or 'platform'
 * - For broker-tenants, tenantId = brokerId (same value)
 * - Clients belong to broker-tenants via tenantId only
 * - FinancialAccounts use tenantId only (brokerId removed)
 */
import { QueryInterface } from 'sequelize';
export declare function up(queryInterface: QueryInterface): Promise<void>;
export declare function down(queryInterface: QueryInterface): Promise<void>;
//# sourceMappingURL=007-add-tenant-type-and-remove-broker-id.d.ts.map