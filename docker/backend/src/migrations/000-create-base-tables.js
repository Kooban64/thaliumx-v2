"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const sequelize_1 = require("sequelize");
async function up(queryInterface) {
    // Create tenants table if it doesn't exist
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('tenants')) {
        await queryInterface.createTable('tenants', {
            id: {
                type: sequelize_1.DataTypes.UUID,
                defaultValue: sequelize_1.DataTypes.UUIDV4,
                primaryKey: true,
                allowNull: false
            },
            name: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
                comment: 'Display name of the tenant'
            },
            slug: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
                unique: true,
                comment: 'URL-friendly identifier for the tenant'
            },
            domain: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
                comment: 'Domain associated with this tenant for subdomain routing'
            },
            tenantType: {
                type: sequelize_1.DataTypes.ENUM('regular', 'broker', 'platform'),
                allowNull: false,
                defaultValue: 'regular',
                comment: 'Type of tenant: regular (users sign up), broker (manages clients), platform (platform oversight)'
            },
            logo: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
                comment: 'URL or path to tenant logo'
            },
            primaryColor: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
                comment: 'Primary brand color (hex code)'
            },
            secondaryColor: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
                comment: 'Secondary brand color (hex code)'
            },
            isActive: {
                type: sequelize_1.DataTypes.BOOLEAN,
                defaultValue: true,
                allowNull: false,
                comment: 'Whether the tenant is active and can accept new users'
            },
            settings: {
                type: sequelize_1.DataTypes.JSONB,
                defaultValue: {},
                allowNull: false,
                comment: 'Tenant-specific configuration settings'
            },
            createdAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize_1.DataTypes.NOW
            },
            updatedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize_1.DataTypes.NOW
            }
        });
        // Create indexes for tenants table
        await queryInterface.addIndex('tenants', ['slug'], {
            name: 'idx_tenants_slug',
            unique: true
        });
        await queryInterface.addIndex('tenants', ['domain'], {
            name: 'idx_tenants_domain'
        });
        await queryInterface.addIndex('tenants', ['tenantType'], {
            name: 'idx_tenants_tenant_type'
        });
        await queryInterface.addIndex('tenants', ['isActive'], {
            name: 'idx_tenants_is_active'
        });
        await queryInterface.addIndex('tenants', ['tenantType', 'isActive'], {
            name: 'idx_tenants_type_active'
        });
        // Create default platform tenant if no tenants exist
        const [tenantCount] = await queryInterface.sequelize.query('SELECT COUNT(*) as count FROM tenants');
        if (tenantCount[0]?.count === '0' || tenantCount[0]?.count === 0) {
            await queryInterface.sequelize.query(`
        INSERT INTO tenants (id, name, slug, "tenantType", "isActive", settings, "createdAt", "updatedAt")
        VALUES (
          '00000000-0000-0000-0000-000000000001',
          'Platform Default',
          'platform',
          'platform',
          true,
          '{}',
          NOW(),
          NOW()
        )
      `);
        }
    }
    // Ensure users table exists (may be created by Sequelize sync in dev)
    if (!tables.includes('users')) {
        await queryInterface.createTable('users', {
            id: {
                type: sequelize_1.DataTypes.UUID,
                defaultValue: sequelize_1.DataTypes.UUIDV4,
                primaryKey: true,
                allowNull: false
            },
            email: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
                unique: true,
                validate: {
                    isEmail: true
                }
            },
            username: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
                unique: true
            },
            firstName: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true
            },
            lastName: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true
            },
            role: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
                defaultValue: 'user'
            },
            kycStatus: {
                type: sequelize_1.DataTypes.ENUM('pending', 'verified', 'rejected', 'expired'),
                defaultValue: 'pending'
            },
            tenantId: {
                type: sequelize_1.DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'tenants',
                    key: 'id'
                },
                onDelete: 'RESTRICT',
                onUpdate: 'CASCADE'
            },
            passwordHash: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false
            },
            mfaEmailCode: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true
            },
            mfaEmailCodeExpiresAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true
            },
            mfaSmsCode: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true
            },
            mfaSmsCodeExpiresAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true
            },
            mfaBackupCodes: {
                type: sequelize_1.DataTypes.JSONB,
                allowNull: true,
                defaultValue: []
            },
            mfaSecretTemp: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true
            },
            mfaVerifiedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true
            },
            createdAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize_1.DataTypes.NOW
            },
            updatedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize_1.DataTypes.NOW
            }
        });
        // Create indexes for users table
        await queryInterface.addIndex('users', ['email'], {
            name: 'idx_users_email',
            unique: true
        });
        await queryInterface.addIndex('users', ['username'], {
            name: 'idx_users_username',
            unique: true
        });
        await queryInterface.addIndex('users', ['tenantId'], {
            name: 'idx_users_tenant_id'
        });
        await queryInterface.addIndex('users', ['role'], {
            name: 'idx_users_role'
        });
        await queryInterface.addIndex('users', ['kycStatus'], {
            name: 'idx_users_kyc_status'
        });
    }
}
async function down(queryInterface) {
    // Drop users table first (due to foreign key constraint)
    const tables = await queryInterface.showAllTables();
    if (tables.includes('users')) {
        await queryInterface.dropTable('users');
    }
    if (tables.includes('tenants')) {
        await queryInterface.dropTable('tenants');
    }
}
//# sourceMappingURL=000-create-base-tables.js.map