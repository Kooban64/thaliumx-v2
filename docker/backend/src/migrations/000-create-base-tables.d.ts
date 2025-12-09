/**
 * Migration: Create Base Tables
 *
 * Creates fundamental tables required by the application:
 * - tenants: Multi-tenant architecture support
 * - users: User accounts (depends on tenants)
 *
 * This migration should run first to establish the base schema.
 * It safely checks for table existence before creating to support
 * both fresh installations and existing databases.
 */
import { QueryInterface } from 'sequelize';
export declare function up(queryInterface: QueryInterface): Promise<void>;
export declare function down(queryInterface: QueryInterface): Promise<void>;
//# sourceMappingURL=000-create-base-tables.d.ts.map