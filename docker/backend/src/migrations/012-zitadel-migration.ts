/**
 * Migration: Rename keycloak_id to zitadel_id in users table
 *
 * Why:
 * - Migrating from Keycloak to Zitadel identity management
 * - Column name needs to reflect the new identity provider
 *
 * This migration is idempotent and safe to run on existing databases.
 */

export async function up(queryInterface: any, _Sequelize: any): Promise<void> {
  const tables = await queryInterface.showAllTables();
  if (!tables.includes('users')) {
    console.log('Users table does not exist, skipping migration');
    return;
  }

  const columns = await queryInterface.describeTable('users');

  // Check if keycloak_id column exists and zitadel_id doesn't
  if (columns.keycloak_id && !columns.zitadel_id) {
    // Rename column from keycloak_id to zitadel_id
    await queryInterface.renameColumn('users', 'keycloak_id', 'zitadel_id');

    // Rename index if it exists
    try {
      await queryInterface.sequelize.query('ALTER INDEX IF EXISTS idx_users_keycloak_id RENAME TO idx_users_zitadel_id;');
    } catch (error) {
      console.warn('Could not rename index (may not exist or already renamed):', error);
    }

    console.log('Successfully renamed keycloak_id to zitadel_id');
  } else if (columns.zitadel_id) {
    console.log('zitadel_id column already exists, skipping migration');
  } else {
    console.log('Neither keycloak_id nor zitadel_id found, skipping migration');
  }
}

export async function down(queryInterface: any, _Sequelize: any): Promise<void> {
  const tables = await queryInterface.showAllTables();
  if (!tables.includes('users')) {
    console.log('Users table does not exist, skipping rollback');
    return;
  }

  const columns = await queryInterface.describeTable('users');

  // Check if zitadel_id column exists and keycloak_id doesn't
  if (columns.zitadel_id && !columns.keycloak_id) {
    // Rename column back from zitadel_id to keycloak_id
    await queryInterface.renameColumn('users', 'zitadel_id', 'keycloak_id');

    // Rename index back if it exists
    try {
      await queryInterface.sequelize.query('ALTER INDEX IF EXISTS idx_users_zitadel_id RENAME TO idx_users_keycloak_id;');
    } catch (error) {
      console.warn('Could not rename index back (may not exist or already renamed):', error);
    }

    console.log('Successfully rolled back zitadel_id to keycloak_id');
  } else if (columns.keycloak_id) {
    console.log('keycloak_id column already exists, skipping rollback');
  } else {
    console.log('Neither zitadel_id nor keycloak_id found, skipping rollback');
  }
}