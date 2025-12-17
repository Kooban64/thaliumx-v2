/**
 * Migration: Add MFA fields to users table
 * Adds mfaEmailCode, mfaEmailCodeExpiresAt, mfaSmsCode, mfaSmsCodeExpiresAt, mfaBackupCodes
 */

export async function up(queryInterface: any, Sequelize: any): Promise<void> {
  // NOTE: Some deployments created these columns as part of earlier base-table migrations.
  // Make this migration idempotent so it can run safely on both fresh and existing schemas.
  const columns = await queryInterface.describeTable('users');

  if (!columns.mfaEmailCode) {
    await queryInterface.addColumn('users', 'mfaEmailCode', { type: Sequelize.STRING, allowNull: true });
  }
  if (!columns.mfaEmailCodeExpiresAt) {
    await queryInterface.addColumn('users', 'mfaEmailCodeExpiresAt', { type: Sequelize.DATE, allowNull: true });
  }
  if (!columns.mfaSmsCode) {
    await queryInterface.addColumn('users', 'mfaSmsCode', { type: Sequelize.STRING, allowNull: true });
  }
  if (!columns.mfaSmsCodeExpiresAt) {
    await queryInterface.addColumn('users', 'mfaSmsCodeExpiresAt', { type: Sequelize.DATE, allowNull: true });
  }
  if (!columns.mfaBackupCodes) {
    await queryInterface.addColumn('users', 'mfaBackupCodes', { type: Sequelize.JSONB, allowNull: true, defaultValue: [] });
  }
  if (!columns.mfaSecretTemp) {
    await queryInterface.addColumn('users', 'mfaSecretTemp', { type: Sequelize.STRING, allowNull: true });
  }
  if (!columns.mfaVerifiedAt) {
    await queryInterface.addColumn('users', 'mfaVerifiedAt', { type: Sequelize.DATE, allowNull: true });
  }
}

export async function down(queryInterface: any): Promise<void> {
  const columns = await queryInterface.describeTable('users');

  // Only remove columns that exist (idempotent rollback)
  if (columns.mfaEmailCode) await queryInterface.removeColumn('users', 'mfaEmailCode');
  if (columns.mfaEmailCodeExpiresAt) await queryInterface.removeColumn('users', 'mfaEmailCodeExpiresAt');
  if (columns.mfaSmsCode) await queryInterface.removeColumn('users', 'mfaSmsCode');
  if (columns.mfaSmsCodeExpiresAt) await queryInterface.removeColumn('users', 'mfaSmsCodeExpiresAt');
  if (columns.mfaBackupCodes) await queryInterface.removeColumn('users', 'mfaBackupCodes');
  if (columns.mfaSecretTemp) await queryInterface.removeColumn('users', 'mfaSecretTemp');
  if (columns.mfaVerifiedAt) await queryInterface.removeColumn('users', 'mfaVerifiedAt');
}
