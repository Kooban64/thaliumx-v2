/**
 * Migration: Rename Authentik_id to zitadel_id in users table
 *
 * ⚠️ LEGACY MIGRATION - DEPRECATED March 2026
 * 
 * This migration was part of the Authentik → Zitadel transition.
 * Both Authentik and Zitadel have now been deprecated in favor
 * of the internal JWT authentication system.
 *
 * Why (original):
 * - Migrating from Authentik to Zitadel identity management
 * - Column name needs to reflect the new identity provider
 *
 * Current Status:
 * - This migration is kept for backward compatibility
 * - The zitadel_id column is no longer used for authentication
 * - All authentication now uses internal JWT tokens
 *
 * This migration is idempotent and safe to run on existing databases.
 */

import { LoggerService } from '../services/logger';

export async function up(queryInterface: any, _Sequelize: any): Promise<void> {
  const tables = await queryInterface.showAllTables();
  if (!tables.includes('users')) {
    LoggerService.info('Users table does not exist, skipping migration');
    return;
  }

  const columns = await queryInterface.describeTable('users');

  // Check if Authentik_id column exists and zitadel_id doesn't
  if (columns.Authentik_id && !columns.zitadel_id) {
    // Rename column from Authentik_id to zitadel_id
    await queryInterface.renameColumn('users', 'Authentik_id', 'zitadel_id');

    // Rename index if it exists
    try {
      await queryInterface.sequelize.query('ALTER INDEX IF EXISTS idx_users_Authentik_id RENAME TO idx_users_zitadel_id;');
    } catch (error) {
      LoggerService.warn('Could not rename index (may not exist or already renamed)', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    LoggerService.info('Successfully renamed Authentik_id to zitadel_id');
  } else if (columns.zitadel_id) {
    LoggerService.info('zitadel_id column already exists, skipping migration');
  } else {
    LoggerService.info('Neither Authentik_id nor zitadel_id found, skipping migration');
  }
}

export async function down(queryInterface: any, _Sequelize: any): Promise<void> {
  const tables = await queryInterface.showAllTables();
  if (!tables.includes('users')) {
    LoggerService.info('Users table does not exist, skipping rollback');
    return;
  }

  const columns = await queryInterface.describeTable('users');

  // Check if zitadel_id column exists and Authentik_id doesn't
  if (columns.zitadel_id && !columns.Authentik_id) {
    // Rename column back from zitadel_id to Authentik_id
    await queryInterface.renameColumn('users', 'zitadel_id', 'Authentik_id');

    // Rename index back if it exists
    try {
      await queryInterface.sequelize.query('ALTER INDEX IF EXISTS idx_users_zitadel_id RENAME TO idx_users_Authentik_id;');
    } catch (error) {
      LoggerService.warn('Could not rename index back (may not exist or already renamed)', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    LoggerService.info('Successfully rolled back zitadel_id to Authentik_id');
  } else if (columns.Authentik_id) {
    LoggerService.info('Authentik_id column already exists, skipping rollback');
  } else {
    LoggerService.info('Neither zitadel_id nor Authentik_id found, skipping rollback');
  }
}