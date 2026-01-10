/**
 * Migration: Align `users` table schema with the Sequelize User model
 *
 * Why:
 * - `DatabaseService` defines a richer `User` model than the initial base migration.
 * - In production, the app runs migrations (not `sync({ alter: true })`).
 * - If these columns don't exist, auth flows (login/register/profile) can 500 with
 *   errors like: `column "phone" does not exist`.
 *
 * This migration is intentionally:
 * - idempotent (safe to run on existing + partially-migrated DBs)
 * - additive (no destructive column/type changes)
 */

 

export async function up(queryInterface: any, Sequelize: any): Promise<void> {
  const tables = await queryInterface.showAllTables();
  if (!tables.includes('users')) return;

  const columns = await queryInterface.describeTable('users');

  // Profile fields
  if (!columns.phone) {
    await queryInterface.addColumn('users', 'phone', { type: Sequelize.STRING, allowNull: true });
  }
  if (!columns.dateOfBirth) {
    // NOTE: We keep DATE (not timestamp) to match typical DOB storage.
    await queryInterface.addColumn('users', 'dateOfBirth', { type: Sequelize.DATEONLY, allowNull: true });
  }
  if (!columns.address) {
    await queryInterface.addColumn('users', 'address', { type: Sequelize.JSONB, allowNull: true });
  }

  // KYC / account status
  if (!columns.kycLevel) {
    // Keep as STRING for compatibility with existing installs; model treats it as enum-like.
    // Default is 'L0' to match unified KYC level system (migration 014 will handle existing 'basic' values)
    await queryInterface.addColumn('users', 'kycLevel', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'L0'
    });
  }
  if (!columns.isActive) {
    await queryInterface.addColumn('users', 'isActive', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true });
  }
  if (!columns.isVerified) {
    await queryInterface.addColumn('users', 'isVerified', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
  }
  if (!columns.lastLoginAt) {
    await queryInterface.addColumn('users', 'lastLoginAt', { type: Sequelize.DATE, allowNull: true });
  }

  // MFA flags (distinct from per-channel temp codes)
  if (!columns.mfaEnabled) {
    await queryInterface.addColumn('users', 'mfaEnabled', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
  }
  if (!columns.mfaSecret) {
    await queryInterface.addColumn('users', 'mfaSecret', { type: Sequelize.STRING, allowNull: true });
  }

  // RBAC-style permissions array
  if (!columns.permissions) {
    await queryInterface.addColumn('users', 'permissions', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: []
    });
  }

  // Expand legacy enum for kycStatus to include newer values used by the model.
  // (We do not remove legacy values; removing enum values is disruptive.)
  try {
    await queryInterface.sequelize.query(
      `DO $$
                BEGIN
         IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_users_kycStatus') THEN
                BEGIN
             ALTER TYPE "enum_users_kycStatus" ADD VALUE IF NOT EXISTS 'not_started';
           EXCEPTION WHEN duplicate_object THEN NULL;
           END;
                BEGIN
             ALTER TYPE "enum_users_kycStatus" ADD VALUE IF NOT EXISTS 'in_progress';
           EXCEPTION WHEN duplicate_object THEN NULL;
           END;
                BEGIN
             ALTER TYPE "enum_users_kycStatus" ADD VALUE IF NOT EXISTS 'pending_review';
           EXCEPTION WHEN duplicate_object THEN NULL;
           END;
                BEGIN
             ALTER TYPE "enum_users_kycStatus" ADD VALUE IF NOT EXISTS 'approved';
           EXCEPTION WHEN duplicate_object THEN NULL;
           END;
         END IF;
       END $$;`
    );
  } catch {
    // Best-effort: if the type doesn't exist or the DB doesn't support IF NOT EXISTS, ignore.
  }
}

export async function down(queryInterface: any): Promise<void> {
  const tables = await queryInterface.showAllTables();
  if (!tables.includes('users')) return;

  const columns = await queryInterface.describeTable('users');

  // Only remove columns that exist (idempotent rollback).
  if (columns.permissions) await queryInterface.removeColumn('users', 'permissions');
  if (columns.mfaSecret) await queryInterface.removeColumn('users', 'mfaSecret');
  if (columns.mfaEnabled) await queryInterface.removeColumn('users', 'mfaEnabled');
  if (columns.lastLoginAt) await queryInterface.removeColumn('users', 'lastLoginAt');
  if (columns.isVerified) await queryInterface.removeColumn('users', 'isVerified');
  if (columns.isActive) await queryInterface.removeColumn('users', 'isActive');
  if (columns.kycLevel) await queryInterface.removeColumn('users', 'kycLevel');
  if (columns.address) await queryInterface.removeColumn('users', 'address');
  if (columns.dateOfBirth) await queryInterface.removeColumn('users', 'dateOfBirth');
  if (columns.phone) await queryInterface.removeColumn('users', 'phone');

  // NOTE: We intentionally do not attempt to remove enum values from enum_users_kycStatus.
}

