"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const sequelize_1 = require("sequelize");
async function up(queryInterface, Sequelize) {
    // Create trading_pairs table
    await queryInterface.createTable('trading_pairs', {
        symbol: {
            type: sequelize_1.DataTypes.STRING,
            primaryKey: true,
            allowNull: false,
        },
        baseAsset: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        quoteAsset: {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        },
        status: {
            type: sequelize_1.DataTypes.ENUM('active', 'inactive', 'suspended'),
            allowNull: false,
            defaultValue: 'active',
        },
        minQuantity: {
            type: sequelize_1.DataTypes.DECIMAL(20, 8),
            allowNull: false,
            defaultValue: '0.00000001',
        },
        maxQuantity: {
            type: sequelize_1.DataTypes.DECIMAL(20, 8),
            allowNull: false,
            defaultValue: '1000000000',
        },
        tickSize: {
            type: sequelize_1.DataTypes.DECIMAL(20, 8),
            allowNull: false,
            defaultValue: '0.00000001',
        },
        stepSize: {
            type: sequelize_1.DataTypes.DECIMAL(20, 8),
            allowNull: false,
            defaultValue: '0.00000001',
        },
        makerFee: {
            type: sequelize_1.DataTypes.DECIMAL(5, 4),
            allowNull: false,
            defaultValue: '0.0010', // 0.1%
        },
        takerFee: {
            type: sequelize_1.DataTypes.DECIMAL(5, 4),
            allowNull: false,
            defaultValue: '0.0010', // 0.1%
        },
        createdAt: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updatedAt: {
            type: sequelize_1.DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
    });
    // Add indexes
    await queryInterface.addIndex('trading_pairs', ['baseAsset'], { name: 'idx_trading_pairs_base_asset' });
    await queryInterface.addIndex('trading_pairs', ['quoteAsset'], { name: 'idx_trading_pairs_quote_asset' });
    await queryInterface.addIndex('trading_pairs', ['status'], { name: 'idx_trading_pairs_status' });
    await queryInterface.addIndex('trading_pairs', ['baseAsset', 'quoteAsset'], { name: 'idx_trading_pairs_base_quote' });
    // Insert initial trading pairs
    await queryInterface.bulkInsert('trading_pairs', [
        {
            symbol: 'THAL/USDT',
            baseAsset: 'THAL',
            quoteAsset: 'USDT',
            status: 'active',
            minQuantity: '0.00000001',
            maxQuantity: '1000000000',
            tickSize: '0.00000001',
            stepSize: '0.00000001',
            makerFee: '0.0010', // 0.1%
            takerFee: '0.0010', // 0.1%
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            symbol: 'ZAR/USDT',
            baseAsset: 'ZAR',
            quoteAsset: 'USDT',
            status: 'active',
            minQuantity: '0.01',
            maxQuantity: '1000000000',
            tickSize: '0.01',
            stepSize: '0.01',
            makerFee: '0.0010', // 0.1%
            takerFee: '0.0010', // 0.1%
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    ]);
}
async function down(queryInterface) {
    await queryInterface.dropTable('trading_pairs');
}
//# sourceMappingURL=002-create-trading-pairs.js.map