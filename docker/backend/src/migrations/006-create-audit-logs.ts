/**
 * Migration: Create audit_logs table for structured audit logging
 */

export async function up(queryInterface: any, Sequelize: any): Promise<void> {
  await queryInterface.createTable('audit_logs', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true
    },
    action: {
      type: Sequelize.STRING,
      allowNull: false
    },
    subject: {
      type: Sequelize.STRING,
      allowNull: false
    },
    userId: {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    tenantId: {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'tenants',
        key: 'id'
      }
    },
    brokerId: {
      type: Sequelize.STRING,
      allowNull: true
    },
    details: {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    createdAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW
    }
  });

  await queryInterface.addIndex('audit_logs', ['action']);
  await queryInterface.addIndex('audit_logs', ['subject']);
  await queryInterface.addIndex('audit_logs', ['userId']);
  await queryInterface.addIndex('audit_logs', ['tenantId']);
  await queryInterface.addIndex('audit_logs', ['createdAt']);
  await queryInterface.addIndex('audit_logs', ['action', 'createdAt']);
}

export async function down(queryInterface: any): Promise<void> {
  await queryInterface.dropTable('audit_logs');
}

