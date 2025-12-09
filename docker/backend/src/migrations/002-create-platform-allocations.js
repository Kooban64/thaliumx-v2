"use strict";
/**
 * Migration: Create platform_allocations table
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(queryInterface, Sequelize) {
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
async function down(queryInterface) {
    await queryInterface.dropTable('platform_allocations');
}
//# sourceMappingURL=002-create-platform-allocations.js.map