"use strict";
/**
 * Migration: Create reconciliation_snapshots table
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(queryInterface, Sequelize) {
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
    await queryInterface.addIndex('reconciliation_snapshots', ['snapshotAt']);
}
async function down(queryInterface) {
    await queryInterface.dropTable('reconciliation_snapshots');
}
//# sourceMappingURL=005-create-reconciliation-snapshots.js.map