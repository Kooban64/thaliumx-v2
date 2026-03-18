import { Injectable, Logger } from '@nestjs/common';
import { AuthenticatedEntity } from '@/types';

/**
 * RBAC Audit Logging Service
 * 
 * This service logs role-based access decisions for security auditing.
 * It tracks both granted and denied access attempts.
 */
@Injectable()
export class RbacAuditService {
  private readonly logger = new Logger(RbacAuditService.name);

  /**
   * Log a role-based access decision
   */
  logAccessDecision(params: {
    user: AuthenticatedEntity | undefined;
    requiredRoles: string[];
    granted: boolean;
    resource?: string;
    action?: string;
    metadata?: Record<string, unknown>;
  }): void {
    const { user, requiredRoles, granted, resource, action, metadata } = params;
    
    const userRoles = (user?.user?.roles as string[]) || [];
    const userId = user?.user?.id || 'anonymous';
    const userEmail = user?.user?.email || 'anonymous';
    const userType = user?.type || 'unknown';

    const logEntry = {
      timestamp: new Date().toISOString(),
      event: granted ? 'RBAC_ACCESS_GRANTED' : 'RBAC_ACCESS_DENIED',
      user: {
        id: userId,
        email: userEmail,
        type: userType,
        roles: userRoles,
      },
      requiredRoles,
      resource,
      action,
      metadata,
    };

    if (granted) {
      this.logger.log(
        `[RBAC] Access GRANTED - User: ${userEmail} (${userId}) | Roles: [${userRoles.join(', ')}] | Required: [${requiredRoles.join(', ')}] | Resource: ${resource || 'N/A'} | Action: ${action || 'N/A'}`,
        JSON.stringify(logEntry)
      );
    } else {
      this.logger.warn(
        `[RBAC] Access DENIED - User: ${userEmail} (${userId}) | Roles: [${userRoles.join(', ')}] | Required: [${requiredRoles.join(', ')}] | Resource: ${resource || 'N/A'} | Action: ${action || 'N/A'}`,
        JSON.stringify(logEntry)
      );
    }
  }

  /**
   * Log a permission check
   */
  logPermissionCheck(params: {
    user: AuthenticatedEntity | undefined;
    permission: string;
    granted: boolean;
    metadata?: Record<string, unknown>;
  }): void {
    const { user, permission, granted, metadata } = params;
    
    const userRoles = (user?.user?.roles as string[]) || [];
    const userId = user?.user?.id || 'anonymous';
    const userEmail = user?.user?.email || 'anonymous';

    if (granted) {
      this.logger.log(
        `[PERMISSION] Access GRANTED - User: ${userEmail} (${userId}) | Permission: ${permission} | Roles: [${userRoles.join(', ')}]`,
        JSON.stringify({ ...metadata, permission, granted, userId, userRoles })
      );
    } else {
      this.logger.warn(
        `[PERMISSION] Access DENIED - User: ${userEmail} (${userId}) | Permission: ${permission} | Roles: [${userRoles.join(', ')}]`,
        JSON.stringify({ ...metadata, permission, granted, userId, userRoles })
      );
    }
  }

  /**
   * Log a role change (for admin actions)
   */
  logRoleChange(params: {
    adminUser: AuthenticatedEntity | undefined;
    targetUserId: string;
    previousRoles: string[];
    newRoles: string[];
  }): void {
    const { adminUser, targetUserId, previousRoles, newRoles } = params;
    
    const adminRoles = (adminUser?.user?.roles as string[]) || [];
    const adminId = adminUser?.user?.id || 'unknown';
    const adminEmail = adminUser?.user?.email || 'unknown';

    this.logger.log(
      `[ROLE_CHANGE] Admin: ${adminEmail} (${adminId}) changed roles for user ${targetUserId} | Previous: [${previousRoles.join(', ')}] | New: [${newRoles.join(', ')}]`,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        event: 'RBAC_ROLE_CHANGED',
        admin: { id: adminId, email: adminEmail, roles: adminRoles },
        targetUserId,
        previousRoles,
        newRoles,
      })
    );
  }

  /**
   * Log authentication success
   */
  logAuthenticationSuccess(params: {
    user: AuthenticatedEntity | undefined;
    method: string;
  }): void {
    const { user, method } = params;
    
    const userRoles = (user?.user?.roles as string[]) || [];
    const userId = user?.user?.id || 'anonymous';
    const userEmail = user?.user?.email || 'anonymous';

    this.logger.log(
      `[AUTH] Success - User: ${userEmail} (${userId}) | Method: ${method} | Roles: [${userRoles.join(', ')}]`,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        event: 'RBAC_AUTH_SUCCESS',
        user: { id: userId, email: userEmail, roles: userRoles },
        method,
      })
    );
  }

  /**
   * Log authentication failure
   */
  logAuthenticationFailure(params: {
    userId?: string;
    email?: string;
    method: string;
    reason: string;
  }): void {
    const { userId, email, method, reason } = params;

    this.logger.warn(
      `[AUTH] Failure - User: ${email || userId || 'anonymous'} | Method: ${method} | Reason: ${reason}`,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        event: 'RBAC_AUTH_FAILURE',
        userId,
        email,
        method,
        reason,
      })
    );
  }
}
