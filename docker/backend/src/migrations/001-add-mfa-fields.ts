/**
 * Migration: Add MFA fields to users table
 * Adds mfaEmailCode, mfaEmailCodeExpiresAt, mfaSmsCode, mfaSmsCodeExpiresAt, mfaBackupCodes
 */

export async function up(queryInterface: any, Sequelize: any): Promise<void> {
  await queryInterface.addColumn('users', 'mfaEmailCode', {
    type: Sequelize.STRING,
    allowNull: true
  });

  await queryInterface.addColumn('users', 'mfaEmailCodeExpiresAt', {
    type: Sequelize.DATE,
    allowNull: true
  });

  await queryInterface.addColumn('users', 'mfaSmsCode', {
    type: Sequelize.STRING,
    allowNull: true
  });

  await queryInterface.addColumn('users', 'mfaSmsCodeExpiresAt', {
    type: Sequelize.DATE,
    allowNull: true
  });

  await queryInterface.addColumn('users', 'mfaBackupCodes', {
    type: Sequelize.JSONB,
    allowNull: true,
    defaultValue: []
  });

  await queryInterface.addColumn('users', 'mfaSecretTemp', {
    type: Sequelize.STRING,
    allowNull: true
  });

  await queryInterface.addColumn('users', 'mfaVerifiedAt', {
    type: Sequelize.DATE,
    allowNull: true
  });
}

export async function down(queryInterface: any): Promise<void> {
  await queryInterface.removeColumn('users', 'mfaEmailCode');
  await queryInterface.removeColumn('users', 'mfaEmailCodeExpiresAt');
  await queryInterface.removeColumn('users', 'mfaSmsCode');
  await queryInterface.removeColumn('users', 'mfaSmsCodeExpiresAt');
  await queryInterface.removeColumn('users', 'mfaBackupCodes');
  await queryInterface.removeColumn('users', 'mfaSecretTemp');
  await queryInterface.removeColumn('users', 'mfaVerifiedAt');
}

