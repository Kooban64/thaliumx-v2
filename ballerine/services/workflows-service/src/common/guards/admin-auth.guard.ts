import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedEntity } from '@/types';
import { rolesBuilder } from './roles-builder';

/**
 * Admin Authentication Guard
 * 
 * This guard checks if the user is an admin. It supports two modes:
 * 1. Type-based: Checks if user.type === 'admin' (legacy)
 * 2. Role-based: Checks if user has a role with admin privileges
 * 
 * For backward compatibility, both checks are performed.
 * A user is considered an admin if:
 * - user.type === 'admin', OR
 * - user has any of these roles: platform_admin, broker_admin
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  private readonly adminRoles = ['platform_admin', 'broker_admin'];

  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as unknown as AuthenticatedEntity | undefined;

    // Check type-based admin (legacy)
    if (user?.type === 'admin') {
      return true;
    }

    // Check role-based admin
    const userRoles = ((user?.user?.roles as string[]) || []).filter(Boolean);
    
    // Add type as a role for consistency
    if (user?.type) {
      userRoles.push(user.type);
    }

    const isRoleBasedAdmin = userRoles.length > 0 && this.adminRoles.length > 0 && 
      this.adminRoles.some(adminRole => rolesBuilder.hasRole(userRoles, adminRole));

    if (isRoleBasedAdmin) {
      return true;
    }

    throw new UnauthorizedException('Unauthorized - Admin access required');
  }
}
