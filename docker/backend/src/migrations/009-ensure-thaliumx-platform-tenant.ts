import type { QueryInterface } from 'sequelize';

/**
 * Migration: Ensure ThaliumX Platform Tenant Exists
 *
 * Purpose:
 * - Creates/ensures a canonical default application tenant used by the main platform
 *   and token-presale experiences.
 *
 * Notes:
 * - We do NOT remove or rename existing tenants (e.g. legacy `platform`).
 * - We only ensure the presence of the new canonical tenant.
 */

const PLATFORM_TENANT_ID = '10000000-0000-0000-0000-000000000000';
const PLATFORM_TENANT_SLUG = 'thaliumx-platform';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // Ensure table exists
  const tables = await queryInterface.showAllTables();
  if (!tables.includes('tenants')) return;

  // If a tenant with the canonical slug already exists, do nothing.
  const [existingBySlug] = await queryInterface.sequelize.query(
    'SELECT id FROM tenants WHERE slug = $1 LIMIT 1',
    { bind: [PLATFORM_TENANT_SLUG] }
  );

  if ((existingBySlug as any[]).length > 0) return;

  // If a tenant already exists with the canonical ID, we align its slug/name/type.
  const [existingById] = await queryInterface.sequelize.query(
    'SELECT id FROM tenants WHERE id = $1 LIMIT 1',
    { bind: [PLATFORM_TENANT_ID] }
  );

  if ((existingById as any[]).length > 0) {
    await queryInterface.sequelize.query(
      'UPDATE tenants SET name = $2, slug = $3, "tenantType" = $4, "isActive" = true, "updatedAt" = NOW() WHERE id = $1',
      {
        bind: [PLATFORM_TENANT_ID, 'ThaliumX Platform', PLATFORM_TENANT_SLUG, 'platform']
      }
    );
    return;
  }

  // Otherwise insert the canonical tenant.
  await queryInterface.sequelize.query(
    `
    INSERT INTO tenants (id, name, slug, domain, "tenantType", "isActive", settings, "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, $5, true, '{}'::jsonb, NOW(), NOW())
    `,
    {
      bind: [PLATFORM_TENANT_ID, 'ThaliumX Platform', PLATFORM_TENANT_SLUG, 'thaliumx.com', 'platform']
    }
  );
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  const tables = await queryInterface.showAllTables();
  if (!tables.includes('tenants')) return;

  // Only remove the canonical tenant by slug (safe rollback).
  await queryInterface.sequelize.query('DELETE FROM tenants WHERE slug = $1', {
    bind: [PLATFORM_TENANT_SLUG]
  });
}

