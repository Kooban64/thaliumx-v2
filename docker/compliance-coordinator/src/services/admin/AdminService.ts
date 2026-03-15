/**
 * Admin Service
 * Manages admin users and action logging
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabaseService } from '../database';
import { createComponentLogger, logAdminAction } from '../../utils/logger';
import type { AdminUser, AdminActionLog } from '../../types/coordinator';
import type { AdminUserTable, AdminActionLogTable } from '../../types/database';

const logger = createComponentLogger('admin-service');

/**
 * Admin user creation input
 */
export interface CreateAdminInput {
  email: string;
  name: string;
  role: AdminUser['role'];
  permissions: string[];
  tenantId: string;
  brokerId?: string | undefined;
}

/**
 * Admin user update input
 */
export interface UpdateAdminInput {
  name?: string | undefined;
  role?: AdminUser['role'] | undefined;
  permissions?: string[] | undefined;
  active?: boolean | undefined;
}

/**
 * Admin query options
 */
export interface AdminQueryOptions {
  role?: AdminUser['role'] | undefined;
  active?: boolean | undefined;
  brokerId?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

/**
 * Action log query options
 */
export interface ActionLogQueryOptions {
  adminId?: string | undefined;
  action?: string | undefined;
  entityType?: string | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

/**
 * Admin Service
 */
export class AdminService {
  /**
   * Create a new admin user
   */
  async createAdmin(input: CreateAdminInput): Promise<AdminUser> {
    logger.info('Creating admin user', {
      email: input.email,
      role: input.role,
      tenantId: input.tenantId,
    });

    const db = getDatabaseService();

    // Check if email already exists
    const existing = await db.queryOne<{ id: string }>(`
      SELECT id FROM admin_users WHERE email = $1 AND tenant_id = $2
    `, [input.email, input.tenantId]);

    if (existing) {
      throw new Error(`Admin user with email ${input.email} already exists`);
    }

    const id = uuidv4();
    const now = new Date();

    await db.query(`
      INSERT INTO admin_users (
        id, email, name, role, permissions, tenant_id, broker_id, active,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `, [
      id,
      input.email,
      input.name,
      input.role,
      input.permissions,
      input.tenantId,
      input.brokerId,
    ]);

    return {
      id,
      email: input.email,
      name: input.name,
      role: input.role,
      permissions: input.permissions,
      tenantId: input.tenantId,
      brokerId: input.brokerId,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get admin user by ID
   */
  async getAdmin(adminId: string): Promise<AdminUser | null> {
    const db = getDatabaseService();
    const row = await db.queryOne<AdminUserTable>(`
      SELECT
        id,
        email,
        name,
        role,
        permissions,
        tenant_id as "tenantId",
        broker_id as "brokerId",
        last_login as "lastLogin",
        active,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM admin_users WHERE id = $1
    `, [adminId]);

    if (!row) {
      return null;
    }

    return this.mapAdminTableToData(row);
  }

  /**
   * Get admin user by email
   */
  async getAdminByEmail(email: string, tenantId: string): Promise<AdminUser | null> {
    const db = getDatabaseService();
    const row = await db.queryOne<AdminUserTable>(`
      SELECT
        id,
        email,
        name,
        role,
        permissions,
        tenant_id as "tenantId",
        broker_id as "brokerId",
        last_login as "lastLogin",
        active,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM admin_users WHERE email = $1 AND tenant_id = $2
    `, [email, tenantId]);

    if (!row) {
      return null;
    }

    return this.mapAdminTableToData(row);
  }

  /**
   * Get admin users with filters
   */
  async getAdmins(
    tenantId: string,
    options?: AdminQueryOptions
  ): Promise<AdminUser[]> {
    const db = getDatabaseService();
    const params: unknown[] = [tenantId];
    let whereClause = 'WHERE tenant_id = $1';
    let paramIndex = 2;

    if (options?.role) {
      whereClause += ` AND role = $${paramIndex}`;
      params.push(options.role);
      paramIndex++;
    }

    if (options?.active !== undefined) {
      whereClause += ` AND active = $${paramIndex}`;
      params.push(options.active);
      paramIndex++;
    }

    if (options?.brokerId) {
      whereClause += ` AND broker_id = $${paramIndex}`;
      params.push(options.brokerId);
      paramIndex++;
    }

    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const rows = await db.queryAll<AdminUserTable>(`
      SELECT
        id,
        email,
        name,
        role,
        permissions,
        tenant_id as "tenantId",
        broker_id as "brokerId",
        last_login as "lastLogin",
        active,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM admin_users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `, params);

    return rows.map((row) => this.mapAdminTableToData(row));
  }

  /**
   * Update admin user
   */
  async updateAdmin(
    adminId: string,
    input: UpdateAdminInput
  ): Promise<AdminUser | null> {
    const db = getDatabaseService();
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(input.name);
      paramIndex++;
    }

    if (input.role !== undefined) {
      updates.push(`role = $${paramIndex}`);
      params.push(input.role);
      paramIndex++;
    }

    if (input.permissions !== undefined) {
      updates.push(`permissions = $${paramIndex}`);
      params.push(input.permissions);
      paramIndex++;
    }

    if (input.active !== undefined) {
      updates.push(`active = $${paramIndex}`);
      params.push(input.active);
      paramIndex++;
    }

    if (updates.length === 0) {
      return this.getAdmin(adminId);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(adminId);

    await db.query(`
      UPDATE admin_users
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `, params);

    return this.getAdmin(adminId);
  }

  /**
   * Update last login
   */
  async updateLastLogin(adminId: string): Promise<void> {
    const db = getDatabaseService();
    await db.query(`
      UPDATE admin_users
      SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [adminId]);
  }

  /**
   * Deactivate admin user
   */
  async deactivateAdmin(adminId: string): Promise<AdminUser | null> {
    return this.updateAdmin(adminId, { active: false });
  }

  /**
   * Activate admin user
   */
  async activateAdmin(adminId: string): Promise<AdminUser | null> {
    return this.updateAdmin(adminId, { active: true });
  }

  /**
   * Check if admin has permission
   */
  async hasPermission(adminId: string, permission: string): Promise<boolean> {
    const admin = await this.getAdmin(adminId);
    if (!admin || !admin.active) {
      return false;
    }

    // Admin role has all permissions
    if (admin.role === 'admin') {
      return true;
    }

    return admin.permissions.includes(permission);
  }

  /**
   * Log admin action
   */
  async logAction(
    adminId: string,
    action: string,
    entityType: string,
    entityId: string,
    details: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AdminActionLog> {
    const db = getDatabaseService();
    const admin = await this.getAdmin(adminId);
    
    if (!admin) {
      throw new Error(`Admin user ${adminId} not found`);
    }

    const id = uuidv4();
    const now = new Date();

    await db.query(`
      INSERT INTO admin_action_logs (
        id, admin_id, action, entity_type, entity_id, details,
        ip_address, user_agent, tenant_id, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP
      )
    `, [
      id,
      adminId,
      action,
      entityType,
      entityId,
      JSON.stringify(details),
      ipAddress,
      userAgent,
      admin.tenantId,
    ]);

    logAdminAction(adminId, action, entityType, entityId, details);

    return {
      id,
      adminId,
      action,
      entityType,
      entityId,
      details,
      ipAddress,
      userAgent,
      tenantId: admin.tenantId,
      createdAt: now,
    };
  }

  /**
   * Get action logs
   */
  async getActionLogs(
    tenantId: string,
    options?: ActionLogQueryOptions
  ): Promise<AdminActionLog[]> {
    const db = getDatabaseService();
    const params: unknown[] = [tenantId];
    let whereClause = 'WHERE tenant_id = $1';
    let paramIndex = 2;

    if (options?.adminId) {
      whereClause += ` AND admin_id = $${paramIndex}`;
      params.push(options.adminId);
      paramIndex++;
    }

    if (options?.action) {
      whereClause += ` AND action = $${paramIndex}`;
      params.push(options.action);
      paramIndex++;
    }

    if (options?.entityType) {
      whereClause += ` AND entity_type = $${paramIndex}`;
      params.push(options.entityType);
      paramIndex++;
    }

    if (options?.startDate) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      params.push(options.startDate);
      paramIndex++;
    }

    if (options?.endDate) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      params.push(options.endDate);
      paramIndex++;
    }

    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const rows = await db.queryAll<AdminActionLogTable>(`
      SELECT
        id,
        admin_id as "adminId",
        action,
        entity_type as "entityType",
        entity_id as "entityId",
        details,
        ip_address as "ipAddress",
        user_agent as "userAgent",
        tenant_id as "tenantId",
        created_at as "createdAt"
      FROM admin_action_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `, params);

    return rows.map((row) => this.mapActionLogTableToData(row));
  }

  /**
   * Get admin statistics
   */
  async getAdminStatistics(tenantId: string): Promise<{
    totalAdmins: number;
    activeAdmins: number;
    byRole: Record<string, number>;
    recentActions: number;
  }> {
    const db = getDatabaseService();

    // Get admin counts
    const adminStats = await db.queryOne<{
      total: string;
      active: string;
    }>(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE active = true) as active
      FROM admin_users
      WHERE tenant_id = $1
    `, [tenantId]);

    // Get by role
    const roleStats = await db.queryAll<{ role: string; count: string }>(`
      SELECT role, COUNT(*) as count
      FROM admin_users
      WHERE tenant_id = $1
      GROUP BY role
    `, [tenantId]);

    // Get recent actions (last 24 hours)
    const recentActions = await db.queryOne<{ count: string }>(`
      SELECT COUNT(*) as count
      FROM admin_action_logs
      WHERE tenant_id = $1
        AND created_at >= NOW() - INTERVAL '24 hours'
    `, [tenantId]);

    const byRole: Record<string, number> = {};
    for (const stat of roleStats) {
      byRole[stat.role] = parseInt(stat.count, 10);
    }

    return {
      totalAdmins: parseInt(adminStats?.total ?? '0', 10),
      activeAdmins: parseInt(adminStats?.active ?? '0', 10),
      byRole,
      recentActions: parseInt(recentActions?.count ?? '0', 10),
    };
  }

  /**
   * Map admin table to data
   */
  private mapAdminTableToData(row: AdminUserTable): AdminUser {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as AdminUser['role'],
      permissions: row.permissions,
      tenantId: row.tenantId,
      brokerId: row.brokerId ?? undefined,
      lastLogin: row.lastLogin ?? undefined,
      active: row.active,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Map action log table to data
   */
  private mapActionLogTableToData(row: AdminActionLogTable): AdminActionLog {
    return {
      id: row.id,
      adminId: row.adminId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      details: row.details,
      ipAddress: row.ipAddress ?? undefined,
      userAgent: row.userAgent ?? undefined,
      tenantId: row.tenantId,
      createdAt: row.createdAt,
    };
  }
}

/**
 * Singleton instance
 */
let adminServiceInstance: AdminService | null = null;

export function getAdminService(): AdminService {
  if (!adminServiceInstance) {
    adminServiceInstance = new AdminService();
  }
  return adminServiceInstance;
}

export default getAdminService;
