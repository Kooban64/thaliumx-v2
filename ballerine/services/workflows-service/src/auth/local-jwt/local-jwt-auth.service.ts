import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '@/user/user.service';
import { UserInfo } from '@/user/user-info';
import { UserRepository } from '@/user/user.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { UserStatus } from '@prisma/client';
import { env } from '@/env';
import * as crypto from 'crypto';

/**
 * JWT Token Payload interface
 * Represents the expected structure of JWT tokens from the backend
 */
interface JwtTokenPayload {
  id: string;
  userId: string;
  email: string;
  role?: string;
  roles?: string[];
  tenantId?: string;
  brokerId?: string;
  brokerSlug?: string;
  channel?: 'direct' | 'broker';
  customerId?: string;
  mandateScopes?: string[];
  sessionType?: string;
  authProvider?: string;
  permissions?: string[];
  mfa_enabled?: boolean;
  mfa_verified?: boolean;
  sub?: string;
  [key: string]: any;
}

/**
 * Local JWT Auth Service
 * 
 * Handles user authentication and creation from internal JWT tokens.
 * This service replaces the ZitadelAuthService and maps tokens from
 * the backend's TokenService to Ballerine users.
 */
@Injectable()
export class LocalJwtAuthService {
  constructor(
    private readonly userService: UserService,
    private readonly userRepository: UserRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Find or create a Ballerine user from a JWT token payload.
   * Maps JWT user identity to Ballerine user.
   */
  async findOrCreateUserFromJwtPayload(payload: JwtTokenPayload): Promise<UserInfo | null> {
    // Use id or userId from JWT payload
    const userId = payload.id || payload.userId;
    const email = payload.email;
    
    if (!userId) {
      return null;
    }

    if (!email) {
      return null;
    }

    // Try to find existing user by email (most common case)
    let user = await this.userService.getByEmailUnscoped(email);

    // If user exists, validate status and update metadata
    if (user) {
      // CRITICAL SECURITY: Check user status - reject BLOCKED or DELETED users
      if (user.status !== UserStatus.Active) {
        // User is blocked or deleted - do not allow authentication
        return null;
      }

      // Update metadata with JWT sub if not already set
      // Note: User model in this codebase doesn't have a metadata field directly
      // We'll store the JWT info in a simple way

      // Extract and validate roles from JWT token
      const extractedRoles = this.extractRolesFromJwtPayload(payload);
      const validatedRoles = this.validateRoles(extractedRoles);
      
      // Normalize roles to standard format
      const normalizedRoles = this.normalizeRoles(validatedRoles);
      
      // Only update roles if we have validated roles and user has no roles
      if (normalizedRoles.length > 0 && (!user.roles || (user.roles as string[]).length === 0)) {
        await this.userRepository.updateByIdUnscoped(user.id, {
          roles: normalizedRoles as any,
        });
        user.roles = normalizedRoles as any;
      }

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        roles: (user.roles as string[]) || (normalizedRoles.length > 0 ? normalizedRoles : []) || [],
      };
    }

    // User doesn't exist - create new user
    // We need a project ID to create a user
    const defaultProjectId = await this.getDefaultProjectId(payload);
    if (!defaultProjectId) {
      // If no project exists, we can't create a user
      return null;
    }

    // Validate email format
    if (!this.isValidEmail(email)) {
      return null;
    }

    // Check if user creation is allowed (domain whitelist, rate limiting, etc.)
    if (!(await this.isUserCreationAllowed(userId, email))) {
      return null;
    }

    // Extract name from token - use email as fallback for name
    const firstName = payload.name?.split(' ')[0] || email.split('@')[0] || '';
    const lastName = payload.name?.split(' ').slice(1).join(' ') || '';
    
    const extractedRoles = this.extractRolesFromJwtPayload(payload);
    const validatedRoles = this.validateRoles(extractedRoles);
    const normalizedRoles = this.normalizeRoles(validatedRoles);

    // CRITICAL SECURITY: Use secure random password for JWT users (not empty string)
    const jwtPassword = crypto.randomBytes(32).toString('hex');

    // Create user
    const newUser = await this.userService.create(
      {
        email,
        firstName,
        lastName,
        password: jwtPassword,
        status: 'ACTIVE',
        roles: normalizedRoles.length > 0 ? normalizedRoles : ['user_viewer'],
      },
      defaultProjectId,
    );

    return {
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName || '',
      lastName: newUser.lastName || '',
      roles: (newUser.roles as string[]) || [],
    };
  }

  /**
   * Extract roles from JWT token payload.
   * Roles can be in 'roles' array or 'role' string field.
   */
  private extractRolesFromJwtPayload(payload: JwtTokenPayload): string[] {
    // Primary: check roles array
    if (payload.roles && Array.isArray(payload.roles)) {
      return payload.roles.map(r => String(r));
    }

    // Secondary: check single role field
    if (payload.role) {
      return [String(payload.role)];
    }

    return [];
  }

  /**
   * Validate roles against whitelist.
   * Only allows roles that are explicitly permitted.
   * Returns empty array if no valid roles found (defaults to 'user' role in caller).
   */
  private validateRoles(extractedRoles: string[]): string[] {
    if (extractedRoles.length === 0) {
      return [];
    }

    const allowedRoles = env.JWT_ALLOWED_ROLES
      ? env.JWT_ALLOWED_ROLES.split(',').map(r => r.trim()).filter(r => r.length > 0)
      : null;

    // If no whitelist configured, allow all roles (backward compatible)
    if (!allowedRoles || allowedRoles.length === 0) {
      return extractedRoles;
    }

    // Filter roles against whitelist
    const validRoles = extractedRoles.filter(role => allowedRoles.includes(role));

    // Log if roles were filtered out
    if (validRoles.length < extractedRoles.length) {
      const filteredRoles = extractedRoles.filter(role => !allowedRoles.includes(role));
      console.warn(`[Local JWT Auth] Filtered out invalid roles: ${filteredRoles.join(', ')}`);
    }

    return validRoles;
  }

  /**
   * Normalize roles to standard format (snake_case).
   * Maps kebab-case roles to standard snake_case format.
   */
  private normalizeRoles(roles: string[]): string[] {
    if (roles.length === 0) {
      return [];
    }

    // Role normalization mapping: kebab-case -> snake_case
    const roleMap: Record<string, string> = {
      'platform-admin': 'platform_admin',
      'platform-compliance': 'platform_compliance',
      'platform-finance': 'platform_finance',
      'platform-operations': 'platform_operations',
      'platform-security': 'platform_security',
      'platform-support': 'platform_support',
      'platform-risk': 'platform_risk',
      'platform-content': 'platform_content',
      'broker-admin': 'broker_admin',
      'broker-compliance': 'broker_compliance',
      'broker-finance': 'broker_finance',
      'broker-operations': 'broker_operations',
      'broker-trading': 'broker_trading',
      'broker-support': 'broker_support',
      'broker-risk': 'broker_risk',
      'broker-content': 'broker_content',
      'user-trader': 'user_trader',
      'user-analyst': 'user_analyst',
      'user-viewer': 'user_viewer',
      // Legacy mappings
      'admin': 'platform_admin',
      'super-admin': 'master_system_admin',
      'super_admin': 'master_system_admin',
      'compliance': 'platform_compliance',
      'finance': 'platform_finance',
      'operations': 'platform_operations',
      'support': 'platform_support',
      'risk': 'platform_risk',
      'trading': 'broker_trading',
      'trader': 'user_trader',
      'viewer': 'user_viewer',
    };

    return roles
      .map(role => roleMap[role.toLowerCase()] || role.toLowerCase().replace(/-/g, '_'))
      .filter((role, index, arr) => arr.indexOf(role) === index); // Remove duplicates
  }

  /**
   * Validate email format.
   */
  private isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Check if user creation is allowed based on security policies.
   */
  private async isUserCreationAllowed(userId: string, email: string): Promise<boolean> {
    // Check email domain restrictions
    const allowedDomains = env.JWT_ALLOWED_EMAIL_DOMAINS
      ? env.JWT_ALLOWED_EMAIL_DOMAINS.split(',').map(d => d.trim().toLowerCase()).filter(d => d.length > 0)
      : null;

    if (allowedDomains && allowedDomains.length > 0) {
      const emailDomain = email.split('@')[1]?.toLowerCase();
      if (!emailDomain || !allowedDomains.includes(emailDomain)) {
        console.warn(`[Local JWT Auth] User creation blocked: email domain ${emailDomain} not in whitelist`);
        return false;
      }
    }

    // Check if admin approval is required
    if (env.JWT_REQUIRE_ADMIN_APPROVAL) {
      console.warn(`[Local JWT Auth] User creation blocked: admin approval required for ${email}`);
      return false;
    }

    // TODO: Implement rate limiting with Redis in production

    return true;
  }

  /**
   * Get default project ID for user creation.
   */
  private async getDefaultProjectId(payload?: JwtTokenPayload): Promise<string | null> {
    // Priority 1: Extract project/tenant from token claims if available
    if (payload) {
      const projectIdFromToken = payload.tenantId || payload.brokerId;
      if (projectIdFromToken && typeof projectIdFromToken === 'string') {
        try {
          const project = await this.prisma.project.findUnique({
            where: { id: projectIdFromToken },
            select: { id: true },
          });
          if (project) {
            return project.id;
          }
        } catch (error) {
          // Project not found or error - continue to next priority
        }
      }
    }

    // Priority 2: Use environment-configured default project (REQUIRED in production)
    if (env.DEFAULT_PROJECT_ID) {
      try {
        const project = await this.prisma.project.findUnique({
          where: { id: env.DEFAULT_PROJECT_ID },
          select: { id: true },
        });
        if (project) {
          return project.id;
        } else {
          console.error(`[Local JWT Auth] DEFAULT_PROJECT_ID ${env.DEFAULT_PROJECT_ID} not found in database`);
        }
      } catch (error) {
        console.error(`[Local JWT Auth] Error validating DEFAULT_PROJECT_ID: ${error}`);
      }
    }

    // Priority 3: Fallback to first available project (NOT RECOMMENDED for production)
    if (env.ENVIRONMENT_NAME !== 'production') {
      try {
        const project = await this.prisma.project.findFirst({
          select: { id: true },
        });
        if (project) {
          console.warn(`[Local JWT Auth] Using first available project ${project.id} as fallback`);
          return project.id;
        }
      } catch (error) {
        // If we can't get projects, return null
      }
    }

    // No valid project found
    console.error('[Local JWT Auth] No valid project found for user creation');
    return null;
  }
}
