import { LoggerService } from '../services/logger';

export async function up(queryInterface: any, Sequelize: any): Promise<void> {
  const tableDescription = await queryInterface.describeTable('audit_logs').catch(() => null);

  if (!tableDescription) {
    LoggerService.warn('audit_logs table not found; skipping 016-add-audit-logs-updated-at migration');
    return;
  }

  if (!tableDescription.updatedAt) {
    await queryInterface.addColumn('audit_logs', 'updatedAt', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
    });

    LoggerService.info('Added updatedAt column to audit_logs table');
  } else {
    LoggerService.info('audit_logs.updatedAt already exists; skipping add');
  }
}

export async function down(queryInterface: any): Promise<void> {
  const tableDescription = await queryInterface.describeTable('audit_logs').catch(() => null);

  if (!tableDescription || !tableDescription.updatedAt) {
    return;
  }

  await queryInterface.removeColumn('audit_logs', 'updatedAt');
}

