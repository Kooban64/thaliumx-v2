import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, Sequelize: any): Promise<void> {
  // Create trading_pairs table
  await queryInterface.createTable('trading_pairs', {
    symbol: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    baseAsset: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    quoteAsset: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended'),
      allowNull: false,
      defaultValue: 'active',
    },
    minQuantity: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: '0.00000001',
    },
    maxQuantity: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: '1000000000',
    },
    tickSize: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: '0.00000001',
    },
    stepSize: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: '0.00000001',
    },
    makerFee: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: '0.0010', // 0.1%
    },
    takerFee: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      defaultValue: '0.0010', // 0.1%
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    updatedAt: {
      type: DataTypes.DATE,
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

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('trading_pairs');
}

