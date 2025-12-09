/**
 * Migration: Create Travel Rule and CARF compliance tables
 */

export async function up(queryInterface: any, Sequelize: any): Promise<void> {
  // Travel Rule Messages
  await queryInterface.createTable('travel_rule_messages', {
    messageId: {
      type: Sequelize.STRING,
      primaryKey: true
    },
    status: {
      type: Sequelize.ENUM('pending', 'sent', 'received', 'acknowledged', 'failed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    data: {
      type: Sequelize.JSONB,
      allowNull: false
    },
    transactionId: {
      type: Sequelize.STRING,
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

  await queryInterface.addIndex('travel_rule_messages', ['status']);
  await queryInterface.addIndex('travel_rule_messages', ['transactionId']);

  // CARF Reports
  await queryInterface.createTable('carf_reports', {
    reportId: {
      type: Sequelize.STRING,
      primaryKey: true
    },
    status: {
      type: Sequelize.ENUM('pending', 'submitted', 'acknowledged', 'rejected'),
      allowNull: false,
      defaultValue: 'pending'
    },
    data: {
      type: Sequelize.JSONB,
      allowNull: false
    },
    transactionId: {
      type: Sequelize.STRING,
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

  await queryInterface.addIndex('carf_reports', ['status']);
  await queryInterface.addIndex('carf_reports', ['transactionId']);
}

export async function down(queryInterface: any): Promise<void> {
  await queryInterface.dropTable('travel_rule_messages');
  await queryInterface.dropTable('carf_reports');
}

