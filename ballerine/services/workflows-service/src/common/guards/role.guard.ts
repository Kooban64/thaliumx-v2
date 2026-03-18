import { SetMetadata } from '@nestjs/common';
import { rolesBuilder } from './roles-builder';
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { AuthenticatedEntity } from '@/types';

export const ROLE_GUARD_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLE_GUARD_KEY, roles);

/**
 * Role-based access control guard
 * 
 * Usage:
 * ```typescript
 * @Roles('platform_admin')
 * @UseGuards(RoleGuard)
 * async adminOnlyEndpoint() {}
 * 
 * // Multiple roles (user needs ANY of these roles)
 * @Roles('platform_admin', 'platform_compliance')
 * @UseGuards(RoleGuard)
 * async adminOrComplianceEndpoint() {}
 * ```
 */
@Injectable()
export class RoleGuard implements CanActivate {
  private readonly logger = new Logger(RoleGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLE_GUARD_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No roles required - allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as unknown as AuthenticatedEntity | undefined;

    if (!user) {
      this.logger.warn(
        `[RBAC] Access DENIED - No authenticated user | Required: [${requiredRoles.join(', ')}]`
      );
      throw new UnauthorizedException('No authenticated user');
    }

    // Get user's roles from their profile
    const userRoles = ((user.user?.roles as string[]) || []).filter(Boolean);
    
    // Add their type as a role (admin, customer, user)
    if (user.type) {
      userRoles.push(user.type);
    }

    // Check if user has any of the required roles
    const hasRole = requiredRoles.some(requiredRole => 
      rolesBuilder.hasRole(userRoles, requiredRole)
    );

    if (!hasRole) {
      const userEmail = user.user?.email || 'unknown';
      const userId = user.user?.id || 'unknown';
      
      this.logger.warn(
        `[RBAC] Access DENIED - User: ${userEmail} (${userId}) | Roles: [${userRoles.join(', ')}] | Required: [${requiredRoles.join(', ')}] | Path: ${req.method} ${req.path}`
      );
      
      throw new UnauthorizedException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}. Your roles: ${userRoles.join(', ')}`
      );
    }

    const userEmail = user.user?.email || 'unknown';
    this.logger.log(
      `[RBAC] Access GRANTED - User: ${userEmail} | Roles: [${userRoles.join(', ')}] | Required: [${requiredRoles.join(', ')}] | Path: ${req.method} ${req.path}`
    );

    return true;
  }
}
