/**
 * Keycloak Integration Service
 *
 * Complete Keycloak integration for white-label broker management:
 * - Multi-realm architecture (Platform + Tenant realms)
 * - Automatic realm provisioning for new brokers/tenants
 * - User management across realms
 * - Role-based access control (RBAC)
 * - SSO and federation support
 * - Token management and validation
 * - User migration between brokers
 * - Configurable realm names via environment variables
 *
 * Production-ready with comprehensive error handling
 */

import { LoggerService } from './logger';
import { ConfigService } from './config-enhanced';
import { EventStreamingService } from './event-streaming';
import { AppError, createError } from '../utils';
import crypto from 'crypto';

// Keycloak Admin Client (using axios for better control)
import axios, { AxiosInstance, AxiosResponse } from 'axios';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface KeycloakConfig {
  baseUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
  adminUsername: string;
  adminPassword: string;
  timeout: number;
  retryAttempts: number;
}

export interface RealmConfig {
  realm: string;
  displayName: string;
  enabled: boolean;
  loginTheme?: string;
  adminTheme?: string;
  emailTheme?: string;
  accessTokenLifespan: number;
  ssoSessionIdleTimeout: number;
  ssoSessionMaxLifespan: number;
  offlineSessionIdleTimeout: number;
  offlineSessionMaxLifespan: number;
  accessCodeLifespan: number;
  accessCodeLifespanUserAction: number;
  accessCodeLifespanLogin: number;
  actionTokenGeneratedByAdminLifespan: number;
  actionTokenGeneratedByUserLifespan: number;
  oauth2DeviceCodeLifespan: number;
  oauth2DevicePollingInterval: number;
  internationalizationEnabled: boolean;
  supportedLocales: string[];
  defaultLocale: string;
  passwordPolicy?: string;
  browserFlow: string;
  directGrantFlow: string;
  clientAuthenticationFlow: string;
  dockerAuthenticationFlow: string;
  resetCredentialsFlow: string;
  loginFlow: string;
  firstBrokerLoginFlow: string;
  registrationFlow: string;
  registrationPageFlow: string;
  browserFlowSelection: string;
  otpPolicyType: string;
  otpPolicyAlgorithm: string;
  otpPolicyInitialCounter: number;
  otpPolicyDigits: number;
  otpPolicyLookAheadWindow: number;
  otpPolicyPeriod: number;
  webAuthnPolicyRpEntityName: string;
  webAuthnPolicySignatureAlgorithms: string[];
  webAuthnPolicyRpId: string;
  webAuthnPolicyAttestationConveyancePreference: string;
  webAuthnPolicyAuthenticatorAttachment: string;
  webAuthnPolicyRequireResidentKey: string;
  webAuthnPolicyUserVerificationRequirement: string;
  webAuthnPolicyCreateTimeout: number;
  webAuthnPolicyAvoidSameAuthenticatorRegister: boolean;
  webAuthnPolicyAcceptableAaguids: string[];
  webAuthnPolicyPasswordlessRpEntityName: string;
  webAuthnPolicyPasswordlessSignatureAlgorithms: string[];
  webAuthnPolicyPasswordlessRpId: string;
  webAuthnPolicyPasswordlessAttestationConveyancePreference: string;
  webAuthnPolicyPasswordlessAuthenticatorAttachment: string;
  webAuthnPolicyPasswordlessRequireResidentKey: string;
  webAuthnPolicyPasswordlessUserVerificationRequirement: string;
  webAuthnPolicyPasswordlessCreateTimeout: number;
  webAuthnPolicyPasswordlessAvoidSameAuthenticatorRegister: boolean;
  webAuthnPolicyPasswordlessAcceptableAaguids: string[];
  otpSupportedApplications: string[];
  webAuthnSupportedApplications: string[];
  attributes: Record<string, any>;
}

export interface BrokerRealmConfig extends RealmConfig {
  brokerId: string;
  brokerName: string;
  domain: string;
  branding: {
    logo?: string;
    favicon?: string;
    primaryColor?: string;
    secondaryColor?: string;
    customCss?: string;
  };
  features: {
    trading: boolean;
    margin: boolean;
    nft: boolean;
    dex: boolean;
    presale: boolean;
  };
  limits: {
    maxUsers: number;
    maxTradingVolume: number;
    maxMarginLeverage: number;
  };
  apzhexIntegration: boolean;
}

export interface UserRepresentation {
  id?: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  enabled: boolean;
  emailVerified: boolean;
  attributes?: Record<string, string[]>;
  credentials?: CredentialRepresentation[];
  groups?: string[];
  roles?: string[];
  brokerId?: string;
  tenantId?: string;
  kycLevel?: string;
  kycStatus?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CredentialRepresentation {
  id?: string;
  type: string;
  value?: string;
  temporary: boolean;
  userLabel?: string;
  secretData?: string;
  credentialData?: string;
}

export interface RoleRepresentation {
  id?: string;
  name: string;
  description?: string;
  composite: boolean;
  clientRole: boolean;
  containerId?: string;
  attributes?: Record<string, any>;
}

export interface ClientRepresentation {
  id?: string;
  clientId: string;
  name?: string;
  description?: string;
  enabled: boolean;
  clientAuthenticatorType: string;
  secret?: string;
  redirectUris: string[];
  webOrigins: string[];
  protocol: string;
  attributes?: Record<string, any>;
  defaultClientScopes: string[];
  optionalClientScopes: string[];
  fullScopeAllowed: boolean;
  nodeReRegistrationTimeout: number;
  defaultRoles: string[];
  surrogateAuthRequired: boolean;
  managementUrl?: string;
  baseUrl?: string;
  adminUrl?: string;
  rootUrl?: string;
  notBefore: number;
  bearerOnly: boolean;
  consentRequired: boolean;
  standardFlowEnabled: boolean;
  implicitFlowEnabled: boolean;
  directAccessGrantsEnabled: boolean;
  serviceAccountsEnabled: boolean;
  publicClient: boolean;
  frontchannelLogout: boolean;
  protocolMappers?: ProtocolMapperRepresentation[];
}

export interface ProtocolMapperRepresentation {
  id?: string;
  name: string;
  protocol: string;
  protocolMapper: string;
  config: Record<string, any>;
}

export interface GroupRepresentation {
  id?: string;
  name: string;
  path: string;
  subGroups?: GroupRepresentation[];
  attributes?: Record<string, string[]>;
  realmRoles?: string[];
  clientRoles?: Record<string, string[]>;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface UserMigrationRequest {
  userId: string;
  fromBrokerId: string;
  toBrokerId: string;
  preserveRoles: boolean;
  preserveGroups: boolean;
  notifyUser: boolean;
}

export interface RealmProvisioningResult {
  success: boolean;
  realmName: string;
  brokerId: string;
  adminUrl?: string;
  clientId?: string;
  clientSecret?: string;
  error?: string;
  warnings?: string[];
}

// =============================================================================
// KEYCLOAK SERVICE CLASS
// =============================================================================

export class KeycloakService {
  private static isInitialized = false;
  private static adminClient: AxiosInstance;
  private static config: KeycloakConfig;
  private static accessToken: string | null = null;
  private static tokenExpiry: number = 0;
  private static realms: Map<string, RealmConfig> = new Map();
  private static brokerRealms: Map<string, BrokerRealmConfig> = new Map();

  // Default roles for different user types
  private static readonly DEFAULT_ROLES = {
    PLATFORM_ADMIN: 'platform-admin',
    BROKER_ADMIN: 'broker-admin',
    BROKER_USER: 'broker-user',
    TRADER: 'trader',
    INVESTOR: 'investor',
    KYC_USER: 'kyc-user',
    TENANT_USER: 'tenant-user'
  };

  // Configurable realm names (loaded from environment)
  private static platformRealmName: string;
  private static defaultTenantRealmName: string;

  // Default client scopes
  private static readonly DEFAULT_CLIENT_SCOPES = [
    'profile',
    'email',
    'roles',
    'web-origins',
    'address',
    'phone'
  ];

  /**
   * Initialize Keycloak service
   */
  public static async initialize(): Promise<void> {
    try {
      LoggerService.info('Initializing Keycloak Service...');
      
      // Load configuration
      this.config = this.loadKeycloakConfig();
      
      // Load realm names from environment
      this.platformRealmName = process.env.KEYCLOAK_PLATFORM_REALM || 'thaliumx-platform';
      // Default to single-realm behavior unless explicitly overridden.
      this.defaultTenantRealmName = process.env.KEYCLOAK_DEFAULT_TENANT_REALM || 'thaliumx-platform';

      const singleRealm = String(process.env.KEYCLOAK_SINGLE_REALM || '').toLowerCase() === 'true';
      if (singleRealm) {
        // Single-realm mode: treat "default tenant" realm as the platform realm.
        this.defaultTenantRealmName = this.platformRealmName;
      }
      
      LoggerService.info('Keycloak realm configuration:', {
        platformRealm: this.platformRealmName,
        defaultTenantRealm: this.defaultTenantRealmName,
        singleRealm
      });
      
      // Initialize admin client
      this.initializeAdminClient();
      
      // Authenticate admin user
      await this.authenticateAdmin();
      
      // Load existing realms
      await this.loadRealms();
      
      // Initialize platform realm
      await this.initializePlatformRealm();
      
      // Initialize default tenant realm (skipped in single-realm mode)
      if (!singleRealm && this.defaultTenantRealmName !== this.platformRealmName) {
        await this.initializeDefaultTenantRealm();
      }
      
      // Start periodic health monitoring
      this.startHealthMonitor();

      this.isInitialized = true;
      LoggerService.info('✅ Keycloak Service initialized successfully');
      
      // Emit initialization event
      await EventStreamingService.emitSystemEvent(
        'keycloak.initialized',
        'KeycloakService',
        'info',
        {
          message: 'Keycloak service initialized',
          platformRealm: this.platformRealmName,
          defaultTenantRealm: this.defaultTenantRealmName,
          realmsCount: this.realms.size,
          brokerRealmsCount: this.brokerRealms.size
        }
      );
      
    } catch (error) {
      LoggerService.error('❌ Keycloak Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get the platform realm name
   */
  public static getPlatformRealmName(): string {
    return this.platformRealmName;
  }

  /**
   * Get the default tenant realm name
   */
  public static getDefaultTenantRealmName(): string {
    return this.defaultTenantRealmName;
  }

  /**
   * Create broker realm
   */
  public static async createBrokerRealm(brokerConfig: BrokerRealmConfig): Promise<RealmProvisioningResult> {
    try {
      LoggerService.info(`Creating broker realm: ${brokerConfig.realm}`, { 
        brokerId: brokerConfig.brokerId, 
        brokerName: brokerConfig.brokerName 
      });

      const result: RealmProvisioningResult = {
        success: false,
        realmName: brokerConfig.realm,
        brokerId: brokerConfig.brokerId
      };

      // Check if realm already exists
      if (this.realms.has(brokerConfig.realm)) {
        result.warnings = ['Realm already exists'];
        LoggerService.warn(`Realm ${brokerConfig.realm} already exists`);
      }

      // Create realm
      await this.createRealm(brokerConfig);

      // Create broker-specific client
      const clientConfig = await this.createBrokerClient(brokerConfig);
      result.clientId = clientConfig.clientId;
      result.clientSecret = clientConfig.secret;

      // Create broker-specific roles
      await this.createBrokerRoles(brokerConfig);

      // Create broker-specific groups
      await this.createBrokerGroups(brokerConfig);

      // Configure realm settings
      await this.configureRealmSettings(brokerConfig);

      // Store realm configuration
      this.brokerRealms.set(brokerConfig.realm, brokerConfig);
      this.realms.set(brokerConfig.realm, brokerConfig);

      result.success = true;
      result.adminUrl = `${this.config.baseUrl}/admin/${brokerConfig.realm}/console`;

      LoggerService.info(`Broker realm created successfully: ${brokerConfig.realm}`, {
        brokerId: brokerConfig.brokerId,
        adminUrl: result.adminUrl
      });

      // Emit audit event
      await EventStreamingService.emitAuditEvent(
        'keycloak.broker.realm.created',
        'broker_realm',
        brokerConfig.realm,
        {
          brokerId: brokerConfig.brokerId,
          brokerName: brokerConfig.brokerName,
          domain: brokerConfig.domain,
          features: brokerConfig.features
        }
      );

      return result;

    } catch (error) {
      LoggerService.error('Broker realm creation failed:', error);
      throw error;
    }
  }

  /**
   * Create user in specific realm
   */
  public static async createUser(realmName: string, user: UserRepresentation): Promise<UserRepresentation> {
    try {
      await this.ensureAuthenticated();

      const response = await this.adminClient.post(
        `/admin/realms/${realmName}/users`,
        {
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          enabled: user.enabled,
          emailVerified: user.emailVerified,
          attributes: {
            ...user.attributes,
            // For broker-tenants, brokerId = tenantId (same value)
            brokerId: [user.brokerId || user.tenantId || ''],
            tenantId: [user.tenantId || ''],
            kycLevel: [user.kycLevel || 'basic'],
            kycStatus: [user.kycStatus || 'not_started'],
            createdAt: [new Date().toISOString()],
            updatedAt: [new Date().toISOString()]
          },
          credentials: user.credentials || []
        }
      );

      const createdUser = response.data;
      LoggerService.info(`User created in realm ${realmName}: ${user.username}`, {
        userId: createdUser.id,
        realm: realmName,
        brokerId: user.brokerId
      });

      // Emit audit event
      await EventStreamingService.emitAuditEvent(
        'keycloak.user.created',
        'user',
        createdUser.id,
        {
          username: user.username,
          email: user.email,
          realm: realmName,
          brokerId: user.brokerId
        }
      );

      return createdUser;

    } catch (error) {
      LoggerService.error('User creation failed:', error);
      throw error;
    }
  }

  /**
   * Migrate user between brokers
   */
  public static async migrateUser(migrationRequest: UserMigrationRequest): Promise<boolean> {
    try {
      LoggerService.info('Starting user migration', {
        userId: migrationRequest.userId,
        fromBroker: migrationRequest.fromBrokerId,
        toBroker: migrationRequest.toBrokerId
      });

      // Get user from source realm
      const sourceUser = await this.getUser(migrationRequest.fromBrokerId, migrationRequest.userId);
      if (!sourceUser) {
        throw createError('User not found in source realm', 404, 'USER_NOT_FOUND');
      }

      // Create user in target realm
      const targetUser: UserRepresentation = {
        username: sourceUser.username,
        email: sourceUser.email,
        firstName: sourceUser.firstName,
        lastName: sourceUser.lastName,
        enabled: sourceUser.enabled,
        emailVerified: sourceUser.emailVerified,
        brokerId: migrationRequest.toBrokerId,
        tenantId: migrationRequest.toBrokerId,
        attributes: {
          ...sourceUser.attributes,
          migratedFrom: [migrationRequest.fromBrokerId],
          migratedAt: [new Date().toISOString()]
        }
      };

      const createdUser = await this.createUser(migrationRequest.toBrokerId, targetUser);

      // Copy roles if requested
      if (migrationRequest.preserveRoles && sourceUser.roles) {
        await this.assignRolesToUser(migrationRequest.toBrokerId, createdUser.id!, sourceUser.roles);
      }

      // Copy groups if requested
      if (migrationRequest.preserveGroups && sourceUser.groups) {
        await this.assignGroupsToUser(migrationRequest.toBrokerId, createdUser.id!, sourceUser.groups);
      }

      // Disable user in source realm
      await this.updateUser(migrationRequest.fromBrokerId, migrationRequest.userId, {
        enabled: false,
        attributes: {
          ...sourceUser.attributes,
          migratedTo: [migrationRequest.toBrokerId],
          migratedAt: [new Date().toISOString()]
        }
      });

      LoggerService.info('User migration completed successfully', {
        userId: migrationRequest.userId,
        fromBroker: migrationRequest.fromBrokerId,
        toBroker: migrationRequest.toBrokerId
      });

      // Emit audit event
      await EventStreamingService.emitAuditEvent(
        'keycloak.user.migrated',
        'user',
        migrationRequest.userId,
        {
          fromBroker: migrationRequest.fromBrokerId,
          toBroker: migrationRequest.toBrokerId,
          preserveRoles: migrationRequest.preserveRoles,
          preserveGroups: migrationRequest.preserveGroups
        }
      );

      return true;

    } catch (error) {
      LoggerService.error('User migration failed:', error);
      throw error;
    }
  }

  /**
   * Validate token
   */
  public static async validateToken(realmName: string, token: string): Promise<any> {
    try {
      await this.ensureAuthenticated();

      const response = await this.adminClient.get(
        `/admin/realms/${realmName}/protocol/openid-connect/userinfo`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      return response.data;

    } catch (error) {
      LoggerService.error('Token validation failed:', error);
      throw createError('Invalid token', 401, 'INVALID_TOKEN');
    }
  }

  /**
   * Get user by ID
   */
  public static async getUser(realmName: string, userId: string): Promise<UserRepresentation | null> {
    try {
      await this.ensureAuthenticated();

      const response = await this.adminClient.get(
        `/admin/realms/${realmName}/users/${userId}`
      );

      return response.data;

    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      LoggerService.error('Get user failed:', error);
      throw error;
    }
  }

  /**
   * Update user
   */
  public static async updateUser(realmName: string, userId: string, updates: Partial<UserRepresentation>): Promise<void> {
    try {
      await this.ensureAuthenticated();

      await this.adminClient.put(
        `/admin/realms/${realmName}/users/${userId}`,
        {
          ...updates,
          attributes: {
            ...updates.attributes,
            updatedAt: [new Date().toISOString()]
          }
        }
      );

      LoggerService.info(`User updated in realm ${realmName}: ${userId}`);

    } catch (error) {
      LoggerService.error('Update user failed:', error);
      throw error;
    }
  }

  /**
   * Assign roles to user
   */
  public static async assignRolesToUser(realmName: string, userId: string, roles: string[]): Promise<void> {
    try {
      await this.ensureAuthenticated();

      // Get realm roles
      const realmRoles = await this.getRealmRoles(realmName);
      const rolesToAssign = realmRoles.filter(role => roles.includes(role.name));

      if (rolesToAssign.length > 0) {
        await this.adminClient.post(
          `/admin/realms/${realmName}/users/${userId}/role-mappings/realm`,
          rolesToAssign
        );
      }

      LoggerService.info(`Roles assigned to user ${userId} in realm ${realmName}`, {
        roles: rolesToAssign.map(r => r.name)
      });

    } catch (error) {
      LoggerService.error('Assign roles failed:', error);
      throw error;
    }
  }

  /**
   * Assign groups to user
   */
  public static async assignGroupsToUser(realmName: string, userId: string, groupIds: string[]): Promise<void> {
    try {
      await this.ensureAuthenticated();

      for (const groupId of groupIds) {
        await this.adminClient.put(
          `/admin/realms/${realmName}/users/${userId}/groups/${groupId}`
        );
      }

      LoggerService.info(`Groups assigned to user ${userId} in realm ${realmName}`, {
        groupIds
      });

    } catch (error) {
      LoggerService.error('Assign groups failed:', error);
      throw error;
    }
  }

  /**
   * Get realm roles
   */
  public static async getRealmRoles(realmName: string): Promise<RoleRepresentation[]> {
    try {
      await this.ensureAuthenticated();

      const response = await this.adminClient.get(
        `/admin/realms/${realmName}/roles`
      );

      return response.data;

    } catch (error) {
      LoggerService.error('Get realm roles failed:', error);
      throw error;
    }
  }

  /**
   * Get broker realms
   */
  public static getBrokerRealms(): BrokerRealmConfig[] {
    return Array.from(this.brokerRealms.values());
  }

  /**
   * Get service health status
   */
  public static isHealthy(): boolean {
    return this.isInitialized && this.accessToken !== null;
  }

  /**
   * Close connections
   */
  public static async close(): Promise<void> {
    try {
      LoggerService.info('Closing Keycloak Service...');
      this.isInitialized = false;
      this.accessToken = null;
      this.tokenExpiry = 0;
      LoggerService.info('✅ Keycloak Service closed');
    } catch (error) {
      LoggerService.error('Error closing Keycloak Service:', error);
      throw error;
    }
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  /**
   * Normalize a Keycloak base URL for Admin API usage.
   *
   * In ThaliumX prod-v1, Keycloak is started with `--http-relative-path=/auth`.
   * That means admin endpoints are located under `/auth/admin/...` and realms under
   * `/auth/realms/...`.
   *
   * This helper ensures the configured Admin base URL includes that relative path.
   */
  private static normalizeAdminBaseUrl(rawUrl: string): string {
    try {
      const relPathRaw = (process.env.KEYCLOAK_HTTP_RELATIVE_PATH || '/auth').trim();
      const relPath = relPathRaw === '' ? '' : relPathRaw.startsWith('/') ? relPathRaw : `/${relPathRaw}`;

      const u = new URL(rawUrl);
      const current = (u.pathname || '').replace(/\/+$/, '');

      if (!relPath || relPath === '/') {
        u.pathname = current || '/';
        return u.toString().replace(/\/+$/, '');
      }

      if (current.endsWith(relPath)) {
        u.pathname = current || relPath;
      } else {
        u.pathname = `${current}${relPath}` || relPath;
      }

      return u.toString().replace(/\/+$/, '');
    } catch (_e) {
      return rawUrl.replace(/\/+$/, '');
    }
  }

  private static loadKeycloakConfig(): KeycloakConfig {
    const config = ConfigService.getConfig();
    
    // Note: For admin authentication, we ALWAYS use the 'master' realm
    // The KEYCLOAK_REALM env var is for application-level realm operations
    // Admin users exist in the master realm, not in application realms
    const nodeEnv = process.env.NODE_ENV || 'development';

    // IMPORTANT:
    // - KEYCLOAK_URL is treated elsewhere in the backend as the *host root* (no /auth).
    // - Keycloak Admin API calls in this service must include the Keycloak relative path
    //   (prod-v1 uses /auth).
    const baseUrlRaw = process.env.KEYCLOAK_ADMIN_URL || process.env.KEYCLOAK_URL || 'http://localhost:8080';
    const baseUrl = this.normalizeAdminBaseUrl(baseUrlRaw);
    const clientId = process.env.KEYCLOAK_ADMIN_CLIENT_ID || 'admin-cli';
    const clientSecret = process.env.KEYCLOAK_ADMIN_CLIENT_SECRET || '';
    const adminUsername = process.env.KEYCLOAK_ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD;

    // Production safety: never allow implicit admin/admin defaults.
    if (nodeEnv === 'production') {
      if (!adminPassword || adminPassword.trim().length < 12) {
        throw createError('KEYCLOAK_ADMIN_PASSWORD is required in production (min 12 chars)', 500, 'KEYCLOAK_MISCONFIGURED');
      }
      if (!clientSecret && clientId !== 'admin-cli') {
        // If a confidential client is used, require its secret.
        throw createError('KEYCLOAK_ADMIN_CLIENT_SECRET is required for confidential admin client in production', 500, 'KEYCLOAK_MISCONFIGURED');
      }
    } else {
      if (!adminPassword) {
        LoggerService.warn('KEYCLOAK_ADMIN_PASSWORD not set; using insecure development default. Do not use this in production.', {
          nodeEnv,
          baseUrl,
          clientId
        });
      }
    }

    return {
      baseUrl,
      realm: 'master', // Always use master realm for admin authentication
      clientId,
      clientSecret,
      adminUsername,
      adminPassword: adminPassword || 'admin',
      timeout: parseInt(process.env.KEYCLOAK_TIMEOUT || '30000'),
      retryAttempts: parseInt(process.env.KEYCLOAK_RETRY_ATTEMPTS || '3')
    };
  }

  private static initializeAdminClient(): void {
    this.adminClient = axios.create({
      baseURL: `${this.config.baseUrl}`,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Add request interceptor for authentication
    this.adminClient.interceptors.request.use(async (config) => {
      await this.ensureAuthenticated();
      config.headers.Authorization = `Bearer ${this.accessToken}`;
      return config;
    });

    // Add response interceptor for error handling and retries
    this.adminClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalConfig: any = error.config || {};

        // Handle unauthorized by refreshing token once
        if (error.response?.status === 401 && !originalConfig.__reauthed) {
          originalConfig.__reauthed = true;
          await this.authenticateAdmin();
          return this.adminClient.request(originalConfig);
        }

        // Retry on transient/network/5xx errors with exponential backoff
        const shouldRetry = !error.response || (error.response.status >= 500 && error.response.status < 600) || error.code === 'ECONNABORTED';
        if (shouldRetry) {
          originalConfig.__retryCount = originalConfig.__retryCount || 0;
          if (originalConfig.__retryCount < (this.config.retryAttempts || 3)) {
            originalConfig.__retryCount += 1;
            const delayMs = Math.min(1000 * Math.pow(2, originalConfig.__retryCount - 1), 8000);
            await new Promise((r) => setTimeout(r, delayMs));
            return this.adminClient.request(originalConfig);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private static async authenticateAdmin(): Promise<void> {
    try {
      const response = await axios.post(
        `${this.config.baseUrl}/realms/${this.config.realm}/protocol/openid-connect/token`,
        new URLSearchParams({
          grant_type: 'password',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          username: this.config.adminUsername,
          password: this.config.adminPassword
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const tokenData: TokenResponse = response.data;
      this.accessToken = tokenData.access_token;
      this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000);

      LoggerService.info('Keycloak admin authentication successful');

    } catch (error) {
      LoggerService.error('Keycloak admin authentication failed:', error);
      throw createError('Keycloak authentication failed', 401, 'KEYCLOAK_AUTH_FAILED');
    }
  }

  private static async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      await this.authenticateAdmin();
    }
  }

  /**
   * Load existing realms from Keycloak
   * 
   * This method attempts to load realms with retry logic to handle cases where
   * Keycloak is still initializing its database schema. Keycloak automatically
   * creates its schema on first startup, which can take time.
   * 
   * Retry Strategy:
   * - Attempts up to 5 times with exponential backoff
   * - Waits for Keycloak health endpoint to be ready
   * - Handles 500 errors gracefully (schema may not be initialized yet)
   */
  private static async loadRealms(): Promise<void> {
    const maxRetries = 5;
    const baseDelay = 2000; // 2 seconds
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.ensureAuthenticated();

        const response = await this.adminClient.get('/admin/realms');
        const realms = response.data;

        for (const realm of realms) {
          this.realms.set(realm.realm, realm);
        }

        LoggerService.info(`Loaded ${realms.length} existing realms`);
        return; // Success - exit retry loop

      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries;
        const isSchemaError = error?.response?.status === 500 && 
                             (error?.response?.data?.error?.includes('relation') || 
                              error?.message?.includes('relation'));
        
        if (isSchemaError && !isLastAttempt) {
          // Keycloak schema not initialized yet - retry with exponential backoff
          const delay = baseDelay * Math.pow(2, attempt - 1);
          LoggerService.warn(
            `Keycloak schema may not be initialized yet (attempt ${attempt}/${maxRetries}). ` +
            `Retrying in ${delay}ms...`,
            { error: error.message }
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        if (isLastAttempt) {
          LoggerService.error('Load realms failed after all retries:', error);
          throw error;
        }
        
        // For other errors, retry with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        LoggerService.warn(
          `Load realms failed (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`,
          { error: error.message }
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  private static startHealthMonitor(): void {
    const intervalMs = parseInt(process.env.KEYCLOAK_HEALTH_INTERVAL_MS || '30000');
    setInterval(async () => {
      try {
        await this.ensureAuthenticated();
        await this.adminClient.get('/admin/realms');
      } catch (error) {
        LoggerService.warn('Keycloak health check failed', { error: error instanceof Error ? error.message : String(error) });
      }
    }, intervalMs);
  }

  /**
   * Ensure all broker realms exist; create missing realms with sane defaults.
   */
  public static async syncBrokerRealms(brokers: Array<{ id: string; name: string; slug: string; domain: string }>): Promise<void> {
    try {
      await this.ensureAuthenticated();
      // Refresh local realm cache
      await this.loadRealms();

      for (const b of brokers) {
        const realmName = `${b.slug}-broker`;
        if (!this.realms.has(realmName)) {
          const cfg = {
            realm: realmName,
            displayName: b.name,
            enabled: true,
            brokerId: b.id,
            brokerName: b.name,
            domain: b.domain,
            branding: { logo: '/assets/logos/default-logo.png', favicon: '/assets/favicons/default-favicon.ico' },
            features: { trading: true, margin: false, nft: false, dex: false, presale: false },
            limits: { maxUsers: 10000, maxTradingVolume: 10000000, maxMarginLeverage: 5 },
            apzhexIntegration: false,
            accessTokenLifespan: 300,
            ssoSessionIdleTimeout: 1800,
            ssoSessionMaxLifespan: 36000,
            offlineSessionIdleTimeout: 2592000,
            offlineSessionMaxLifespan: 5184000,
            accessCodeLifespan: 60,
            accessCodeLifespanUserAction: 300,
            accessCodeLifespanLogin: 1800,
            oauth2DeviceCodeLifespan: 600,
            oauth2DevicePollingInterval: 5,
            internationalizationEnabled: true,
            supportedLocales: ['en'],
            defaultLocale: 'en',
            passwordPolicy: 'length(8) and digits(2) and lowerCase(2) and upperCase(2) and specialChars(1)',
            browserFlow: 'browser',
            directGrantFlow: 'direct grant',
            clientAuthenticationFlow: 'clients',
            dockerAuthenticationFlow: 'docker auth',
            resetCredentialsFlow: 'reset credentials',
            loginFlow: 'browser',
            firstBrokerLoginFlow: 'first broker login',
            registrationFlow: 'registration',
            registrationPageFlow: 'registration page',
            browserFlowSelection: 'browser',
            otpPolicyType: 'totp',
            otpPolicyAlgorithm: 'HmacSHA1',
            otpPolicyInitialCounter: 0,
            otpPolicyDigits: 6,
            otpPolicyLookAheadWindow: 1,
            otpPolicyPeriod: 30,
            webAuthnPolicyRpEntityName: `${b.name} Broker`,
            webAuthnPolicySignatureAlgorithms: ['ES256'],
            webAuthnPolicyRpId: b.domain,
            webAuthnPolicyAttestationConveyancePreference: 'not specified',
            webAuthnPolicyAuthenticatorAttachment: 'not specified',
            webAuthnPolicyRequireResidentKey: 'not specified',
            webAuthnPolicyUserVerificationRequirement: 'not specified',
            webAuthnPolicyCreateTimeout: 0,
            webAuthnPolicyAvoidSameAuthenticatorRegister: false,
            webAuthnPolicyAcceptableAaguids: [],
            webAuthnPolicyPasswordlessRpEntityName: `${b.name} Broker`,
            webAuthnPolicyPasswordlessSignatureAlgorithms: ['ES256'],
            webAuthnPolicyPasswordlessRpId: b.domain,
            webAuthnPolicyPasswordlessAttestationConveyancePreference: 'not specified',
            webAuthnPolicyPasswordlessAuthenticatorAttachment: 'not specified',
            webAuthnPolicyPasswordlessRequireResidentKey: 'not specified',
            webAuthnPolicyPasswordlessUserVerificationRequirement: 'not specified',
            webAuthnPolicyPasswordlessCreateTimeout: 0,
            webAuthnPolicyPasswordlessAvoidSameAuthenticatorRegister: false,
            webAuthnPolicyPasswordlessAcceptableAaguids: [],
            otpSupportedApplications: ['FreeOTP', 'Google Authenticator'],
            webAuthnSupportedApplications: ['Chrome', 'Firefox', 'Safari'],
            attributes: {
              'broker.realm': ['true'],
              'broker.id': [b.id],
              'broker.version': ['1.0.0']
            }
          } as any;
          await this.createBrokerRealm(cfg);
          LoggerService.info('Synchronized missing broker realm', { realm: realmName, brokerId: b.id });
        }
      }
    } catch (error) {
      LoggerService.error('Sync broker realms failed:', error);
      throw error;
    }
  }

  private static async initializePlatformRealm(): Promise<void> {
    try {
      const platformRealm = this.platformRealmName;
      
      if (!this.realms.has(platformRealm)) {
        const realmConfig: RealmConfig = {
          realm: platformRealm,
          displayName: process.env.KEYCLOAK_PLATFORM_REALM_DISPLAY_NAME || 'ThaliumX Platform',
          enabled: true,
          loginTheme: 'thaliumx',
          adminTheme: 'thaliumx',
          emailTheme: 'thaliumx',
          accessTokenLifespan: 300,
          ssoSessionIdleTimeout: 1800,
          ssoSessionMaxLifespan: 36000,
          offlineSessionIdleTimeout: 2592000,
          offlineSessionMaxLifespan: 5184000,
          accessCodeLifespan: 60,
          accessCodeLifespanUserAction: 300,
          accessCodeLifespanLogin: 1800,
          actionTokenGeneratedByAdminLifespan: 43200,
          actionTokenGeneratedByUserLifespan: 300,
          oauth2DeviceCodeLifespan: 600,
          oauth2DevicePollingInterval: 5,
          internationalizationEnabled: true,
          supportedLocales: ['en', 'es', 'fr', 'de', 'zh', 'ja'],
          defaultLocale: 'en',
          passwordPolicy: 'length(8) and digits(2) and lowerCase(2) and upperCase(2) and specialChars(1)',
          browserFlow: 'browser',
          directGrantFlow: 'direct grant',
          clientAuthenticationFlow: 'clients',
          dockerAuthenticationFlow: 'docker auth',
          resetCredentialsFlow: 'reset credentials',
          loginFlow: 'browser',
          firstBrokerLoginFlow: 'first broker login',
          registrationFlow: 'registration',
          registrationPageFlow: 'registration page',
          browserFlowSelection: 'browser',
          otpPolicyType: 'totp',
          otpPolicyAlgorithm: 'HmacSHA1',
          otpPolicyInitialCounter: 0,
          otpPolicyDigits: 6,
          otpPolicyLookAheadWindow: 1,
          otpPolicyPeriod: 30,
          webAuthnPolicyRpEntityName: 'ThaliumX Platform',
          webAuthnPolicySignatureAlgorithms: ['ES256'],
          webAuthnPolicyRpId: 'thaliumx.com',
          webAuthnPolicyAttestationConveyancePreference: 'not specified',
          webAuthnPolicyAuthenticatorAttachment: 'not specified',
          webAuthnPolicyRequireResidentKey: 'not specified',
          webAuthnPolicyUserVerificationRequirement: 'not specified',
          webAuthnPolicyCreateTimeout: 0,
          webAuthnPolicyAvoidSameAuthenticatorRegister: false,
          webAuthnPolicyAcceptableAaguids: [],
          webAuthnPolicyPasswordlessRpEntityName: 'ThaliumX Platform',
          webAuthnPolicyPasswordlessSignatureAlgorithms: ['ES256'],
          webAuthnPolicyPasswordlessRpId: 'thaliumx.com',
          webAuthnPolicyPasswordlessAttestationConveyancePreference: 'not specified',
          webAuthnPolicyPasswordlessAuthenticatorAttachment: 'not specified',
          webAuthnPolicyPasswordlessRequireResidentKey: 'not specified',
          webAuthnPolicyPasswordlessUserVerificationRequirement: 'not specified',
          webAuthnPolicyPasswordlessCreateTimeout: 0,
          webAuthnPolicyPasswordlessAvoidSameAuthenticatorRegister: false,
          webAuthnPolicyPasswordlessAcceptableAaguids: [],
          otpSupportedApplications: ['FreeOTP', 'Google Authenticator'],
          webAuthnSupportedApplications: ['Chrome', 'Firefox', 'Safari'],
          attributes: {
            'platform.realm': ['true'],
            'platform.version': ['1.0.0']
          }
        };

        await this.createRealm(realmConfig);
        LoggerService.info(`Platform realm initialized: ${platformRealm}`);
        
        // Create platform roles in Keycloak
        await this.createPlatformRoles(platformRealm);
        
        // Seed platform users with IDs
        await this.seedPlatformUsers(platformRealm);
      } else {
        LoggerService.info(`Platform realm already exists: ${platformRealm}`);
        
        // Ensure roles and users exist even if realm already exists
        await this.createPlatformRoles(platformRealm);
        await this.seedPlatformUsers(platformRealm);
      }

    } catch (error) {
      LoggerService.error('Initialize platform realm failed:', error);
      throw error;
    }
  }

  /**
   * Initialize the default tenant realm
   * This is the primary tenant realm for the platform, configurable via environment variables
   */
  private static async initializeDefaultTenantRealm(): Promise<void> {
    try {
      const tenantRealm = this.defaultTenantRealmName;
      const tenantId = process.env.KEYCLOAK_DEFAULT_TENANT_ID || 'default-tenant';
      const tenantName = process.env.KEYCLOAK_DEFAULT_TENANT_NAME || 'Default Tenant';
      const tenantDomain = process.env.KEYCLOAK_DEFAULT_TENANT_DOMAIN || 'tenant.thaliumx.com';
      
      if (!this.realms.has(tenantRealm)) {
        const tenantConfig: BrokerRealmConfig = {
          realm: tenantRealm,
          displayName: process.env.KEYCLOAK_DEFAULT_TENANT_DISPLAY_NAME || 'ThaliumX Default Tenant',
          enabled: true,
          brokerId: tenantId,
          brokerName: tenantName,
          domain: tenantDomain,
          branding: {
            logo: process.env.KEYCLOAK_DEFAULT_TENANT_LOGO || '/assets/logos/thaliumx-logo.png',
            favicon: process.env.KEYCLOAK_DEFAULT_TENANT_FAVICON || '/assets/favicons/thaliumx-favicon.ico',
            primaryColor: process.env.KEYCLOAK_DEFAULT_TENANT_PRIMARY_COLOR || '#1e40af',
            secondaryColor: process.env.KEYCLOAK_DEFAULT_TENANT_SECONDARY_COLOR || '#3b82f6',
            customCss: process.env.KEYCLOAK_DEFAULT_TENANT_CUSTOM_CSS || '.thaliumx-theme { --primary: #1e40af; --secondary: #3b82f6; }'
          },
          features: {
            trading: true,
            margin: true,
            nft: true,
            dex: true,
            presale: true
          },
          limits: {
            maxUsers: parseInt(process.env.KEYCLOAK_DEFAULT_TENANT_MAX_USERS || '1000000'),
            maxTradingVolume: parseInt(process.env.KEYCLOAK_DEFAULT_TENANT_MAX_TRADING_VOLUME || '1000000000'),
            maxMarginLeverage: parseInt(process.env.KEYCLOAK_DEFAULT_TENANT_MAX_MARGIN_LEVERAGE || '10')
          },
          apzhexIntegration: false,
          accessTokenLifespan: 300,
          ssoSessionIdleTimeout: 1800,
          ssoSessionMaxLifespan: 36000,
          offlineSessionIdleTimeout: 2592000,
          offlineSessionMaxLifespan: 5184000,
          accessCodeLifespan: 60,
          accessCodeLifespanUserAction: 300,
          accessCodeLifespanLogin: 1800,
          actionTokenGeneratedByAdminLifespan: 43200,
          actionTokenGeneratedByUserLifespan: 300,
          oauth2DeviceCodeLifespan: 600,
          oauth2DevicePollingInterval: 5,
          internationalizationEnabled: true,
          supportedLocales: ['en', 'es', 'fr', 'de', 'zh', 'ja'],
          defaultLocale: 'en',
          passwordPolicy: 'length(8) and digits(2) and lowerCase(2) and upperCase(2) and specialChars(1)',
          browserFlow: 'browser',
          directGrantFlow: 'direct grant',
          clientAuthenticationFlow: 'clients',
          dockerAuthenticationFlow: 'docker auth',
          resetCredentialsFlow: 'reset credentials',
          loginFlow: 'browser',
          firstBrokerLoginFlow: 'first broker login',
          registrationFlow: 'registration',
          registrationPageFlow: 'registration page',
          browserFlowSelection: 'browser',
          otpPolicyType: 'totp',
          otpPolicyAlgorithm: 'HmacSHA1',
          otpPolicyInitialCounter: 0,
          otpPolicyDigits: 6,
          otpPolicyLookAheadWindow: 1,
          otpPolicyPeriod: 30,
          webAuthnPolicyRpEntityName: tenantName,
          webAuthnPolicySignatureAlgorithms: ['ES256'],
          webAuthnPolicyRpId: tenantDomain,
          webAuthnPolicyAttestationConveyancePreference: 'not specified',
          webAuthnPolicyAuthenticatorAttachment: 'not specified',
          webAuthnPolicyRequireResidentKey: 'not specified',
          webAuthnPolicyUserVerificationRequirement: 'not specified',
          webAuthnPolicyCreateTimeout: 0,
          webAuthnPolicyAvoidSameAuthenticatorRegister: false,
          webAuthnPolicyAcceptableAaguids: [],
          webAuthnPolicyPasswordlessRpEntityName: tenantName,
          webAuthnPolicyPasswordlessSignatureAlgorithms: ['ES256'],
          webAuthnPolicyPasswordlessRpId: tenantDomain,
          webAuthnPolicyPasswordlessAttestationConveyancePreference: 'not specified',
          webAuthnPolicyPasswordlessAuthenticatorAttachment: 'not specified',
          webAuthnPolicyPasswordlessRequireResidentKey: 'not specified',
          webAuthnPolicyPasswordlessUserVerificationRequirement: 'not specified',
          webAuthnPolicyPasswordlessCreateTimeout: 0,
          webAuthnPolicyPasswordlessAvoidSameAuthenticatorRegister: false,
          webAuthnPolicyPasswordlessAcceptableAaguids: [],
          otpSupportedApplications: ['FreeOTP', 'Google Authenticator'],
          webAuthnSupportedApplications: ['Chrome', 'Firefox', 'Safari'],
          attributes: {
            'tenant.realm': ['true'],
            'tenant.id': [tenantId],
            'tenant.default': ['true'],
            'tenant.version': ['1.0.0']
          }
        };

        await this.createBrokerRealm(tenantConfig);
        LoggerService.info(`Default tenant realm initialized: ${tenantRealm}`, {
          tenantId,
          tenantName,
          tenantDomain
        });
        
        // Seed tenant users with IDs
        await this.seedTenantUsers(tenantRealm, tenantId);
      } else {
        LoggerService.info(`Default tenant realm already exists: ${tenantRealm}`);
        
        // Ensure users exist even if realm already exists
        await this.seedTenantUsers(tenantRealm, tenantId);
      }

    } catch (error) {
      LoggerService.error('Initialize default tenant realm failed:', error);
      throw error;
    }
  }

  private static async createRealm(realmConfig: RealmConfig): Promise<void> {
    try {
      await this.ensureAuthenticated();

      // Keycloak Admin API only accepts specific fields for realm creation
      // Send a minimal configuration that Keycloak will accept
      const minimalRealmConfig = {
        realm: realmConfig.realm,
        displayName: realmConfig.displayName,
        enabled: realmConfig.enabled,
        // Token lifespans
        accessTokenLifespan: realmConfig.accessTokenLifespan,
        ssoSessionIdleTimeout: realmConfig.ssoSessionIdleTimeout,
        ssoSessionMaxLifespan: realmConfig.ssoSessionMaxLifespan,
        offlineSessionIdleTimeout: realmConfig.offlineSessionIdleTimeout,
        offlineSessionMaxLifespan: realmConfig.offlineSessionMaxLifespan,
        accessCodeLifespan: realmConfig.accessCodeLifespan,
        accessCodeLifespanUserAction: realmConfig.accessCodeLifespanUserAction,
        accessCodeLifespanLogin: realmConfig.accessCodeLifespanLogin,
        // Internationalization
        internationalizationEnabled: realmConfig.internationalizationEnabled,
        supportedLocales: realmConfig.supportedLocales,
        defaultLocale: realmConfig.defaultLocale,
        // Password policy
        passwordPolicy: realmConfig.passwordPolicy,
        // OTP policy
        otpPolicyType: realmConfig.otpPolicyType,
        otpPolicyAlgorithm: realmConfig.otpPolicyAlgorithm,
        otpPolicyInitialCounter: realmConfig.otpPolicyInitialCounter,
        otpPolicyDigits: realmConfig.otpPolicyDigits,
        otpPolicyLookAheadWindow: realmConfig.otpPolicyLookAheadWindow,
        otpPolicyPeriod: realmConfig.otpPolicyPeriod,
        // Attributes (custom metadata)
        attributes: realmConfig.attributes
      };

      await this.adminClient.post('/admin/realms', minimalRealmConfig);

      LoggerService.info(`Realm created: ${realmConfig.realm}`);

    } catch (error: any) {
      // If realm already exists (409 Conflict), log and continue
      if (error?.response?.status === 409) {
        LoggerService.info(`Realm ${realmConfig.realm} already exists, skipping creation`);
        return;
      }
      LoggerService.error('Create realm failed:', error);
      throw error;
    }
  }

  private static async createBrokerClient(brokerConfig: BrokerRealmConfig): Promise<ClientRepresentation> {
    try {
      await this.ensureAuthenticated();

      const clientConfig: ClientRepresentation = {
        clientId: `${brokerConfig.brokerId}-client`,
        name: `${brokerConfig.brokerName} Client`,
        description: `Client for ${brokerConfig.brokerName} broker`,
        enabled: true,
        clientAuthenticatorType: 'client-secret',
        secret: this.generateClientSecret(),
        redirectUris: [
          `https://${brokerConfig.domain}/*`,
          `http://localhost:3000/*`,
          `http://localhost:3001/*`
        ],
        webOrigins: [
          `https://${brokerConfig.domain}`,
          'http://localhost:3000',
          'http://localhost:3001'
        ],
        protocol: 'openid-connect',
        attributes: {
          'broker.id': brokerConfig.brokerId,
          'broker.name': brokerConfig.brokerName,
          'broker.domain': brokerConfig.domain
        },
        defaultClientScopes: this.DEFAULT_CLIENT_SCOPES,
        optionalClientScopes: [],
        fullScopeAllowed: true,
        nodeReRegistrationTimeout: -1,
        defaultRoles: [this.DEFAULT_ROLES.BROKER_USER],
        surrogateAuthRequired: false,
        managementUrl: `https://${brokerConfig.domain}/admin`,
        baseUrl: `https://${brokerConfig.domain}`,
        adminUrl: `https://${brokerConfig.domain}/admin`,
        rootUrl: `https://${brokerConfig.domain}`,
        notBefore: 0,
        bearerOnly: false,
        consentRequired: false,
        standardFlowEnabled: true,
        implicitFlowEnabled: false,
        directAccessGrantsEnabled: true,
        serviceAccountsEnabled: true,
        publicClient: false,
        frontchannelLogout: true,
        protocolMappers: [
          {
            name: 'broker-id',
            protocol: 'openid-connect',
            protocolMapper: 'oidc-usermodel-attribute-mapper',
            config: {
              'user.attribute': 'brokerId',
              'claim.name': 'broker_id',
              'jsonType.label': 'String',
              'id.token.claim': 'true',
              'access.token.claim': 'true',
              'userinfo.token.claim': 'true'
            }
          },
          {
            name: 'tenant-id',
            protocol: 'openid-connect',
            protocolMapper: 'oidc-usermodel-attribute-mapper',
            config: {
              'user.attribute': 'tenantId',
              'claim.name': 'tenant_id',
              'jsonType.label': 'String',
              'id.token.claim': 'true',
              'access.token.claim': 'true',
              'userinfo.token.claim': 'true'
            }
          },
          {
            name: 'kyc-level',
            protocol: 'openid-connect',
            protocolMapper: 'oidc-usermodel-attribute-mapper',
            config: {
              'user.attribute': 'kycLevel',
              'claim.name': 'kyc_level',
              'jsonType.label': 'String',
              'id.token.claim': 'true',
              'access.token.claim': 'true',
              'userinfo.token.claim': 'true'
            }
          },
          {
            name: 'kyc-status',
            protocol: 'openid-connect',
            protocolMapper: 'oidc-usermodel-attribute-mapper',
            config: {
              'user.attribute': 'kycStatus',
              'claim.name': 'kyc_status',
              'jsonType.label': 'String',
              'id.token.claim': 'true',
              'access.token.claim': 'true',
              'userinfo.token.claim': 'true'
            }
          }
        ]
      };

      const response = await this.adminClient.post(
        `/admin/realms/${brokerConfig.realm}/clients`,
        clientConfig
      );

      const createdClient = response.data;
      LoggerService.info(`Broker client created: ${clientConfig.clientId}`);

      return {
        ...clientConfig,
        id: createdClient.id,
        secret: clientConfig.secret
      };

    } catch (error) {
      LoggerService.error('Create broker client failed:', error);
      throw error;
    }
  }

  private static async createBrokerRoles(brokerConfig: BrokerRealmConfig): Promise<void> {
    try {
      await this.ensureAuthenticated();

      const roles = [
        {
          name: this.DEFAULT_ROLES.BROKER_ADMIN,
          description: 'Broker administrator with full access',
          composite: false,
          clientRole: false
        },
        {
          name: this.DEFAULT_ROLES.BROKER_USER,
          description: 'Standard broker user',
          composite: false,
          clientRole: false
        },
        {
          name: this.DEFAULT_ROLES.TRADER,
          description: 'Trading user with trading permissions',
          composite: false,
          clientRole: false
        },
        {
          name: this.DEFAULT_ROLES.INVESTOR,
          description: 'Investment user with investment permissions',
          composite: false,
          clientRole: false
        },
        {
          name: this.DEFAULT_ROLES.KYC_USER,
          description: 'User with KYC verification',
          composite: false,
          clientRole: false
        }
      ];

      for (const role of roles) {
        await this.adminClient.post(
          `/admin/realms/${brokerConfig.realm}/roles`,
          role
        );
      }

      LoggerService.info(`Broker roles created for ${brokerConfig.realm}`);

    } catch (error) {
      LoggerService.error('Create broker roles failed:', error);
      throw error;
    }
  }

  private static async createBrokerGroups(brokerConfig: BrokerRealmConfig): Promise<void> {
    try {
      await this.ensureAuthenticated();

      const groups = [
        {
          name: 'broker-admins',
          path: '/broker-admins',
          attributes: {
            'group.type': ['admin'],
            'broker.id': [brokerConfig.brokerId]
          },
          realmRoles: [this.DEFAULT_ROLES.BROKER_ADMIN]
        },
        {
          name: 'broker-users',
          path: '/broker-users',
          attributes: {
            'group.type': ['user'],
            'broker.id': [brokerConfig.brokerId]
          },
          realmRoles: [this.DEFAULT_ROLES.BROKER_USER]
        },
        {
          name: 'traders',
          path: '/traders',
          attributes: {
            'group.type': ['trader'],
            'broker.id': [brokerConfig.brokerId]
          },
          realmRoles: [this.DEFAULT_ROLES.TRADER]
        },
        {
          name: 'investors',
          path: '/investors',
          attributes: {
            'group.type': ['investor'],
            'broker.id': [brokerConfig.brokerId]
          },
          realmRoles: [this.DEFAULT_ROLES.INVESTOR]
        }
      ];

      for (const group of groups) {
        await this.adminClient.post(
          `/admin/realms/${brokerConfig.realm}/groups`,
          group
        );
      }

      LoggerService.info(`Broker groups created for ${brokerConfig.realm}`);

    } catch (error) {
      LoggerService.error('Create broker groups failed:', error);
      throw error;
    }
  }

  private static async configureRealmSettings(brokerConfig: BrokerRealmConfig): Promise<void> {
    try {
      await this.ensureAuthenticated();

      // Configure realm-specific settings
      const realmSettings = {
        ...brokerConfig,
        attributes: {
          ...brokerConfig.attributes,
          'broker.features': JSON.stringify(brokerConfig.features),
          'broker.limits': JSON.stringify(brokerConfig.limits),
          'broker.branding': JSON.stringify(brokerConfig.branding)
        }
      };

      await this.adminClient.put(
        `/admin/realms/${brokerConfig.realm}`,
        realmSettings
      );

      LoggerService.info(`Realm settings configured for ${brokerConfig.realm}`);

    } catch (error) {
      LoggerService.error('Configure realm settings failed:', error);
      throw error;
    }
  }

  private static generateClientSecret(): string {
    // Cryptographically secure secret suitable for Keycloak client-secret.
    // 32 bytes -> 43 char base64url (no padding).
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Create platform roles in Keycloak realm
   */
  private static async createPlatformRoles(realmName: string): Promise<void> {
    try {
      await this.ensureAuthenticated();

      const platformRoles = [
        {
          name: this.DEFAULT_ROLES.PLATFORM_ADMIN,
          description: 'Platform Administrator - Full platform access with tenant lifecycle management',
          composite: false,
          clientRole: false
        },
        {
          name: 'platform-compliance',
          description: 'Platform Compliance Officer - Global compliance rules and oversight',
          composite: false,
          clientRole: false
        },
        {
          name: 'platform-finance',
          description: 'Platform Finance Manager - Platform financial operations and treasury management',
          composite: false,
          clientRole: false
        },
        {
          name: 'platform-support',
          description: 'Platform Support Manager - Platform-wide support operations',
          composite: false,
          clientRole: false
        },
        {
          name: 'platform-risk',
          description: 'Platform Risk Manager - Platform-wide risk management',
          composite: false,
          clientRole: false
        },
        {
          name: 'platform-content',
          description: 'Platform Content Manager - Platform content and documentation',
          composite: false,
          clientRole: false
        }
      ];

      for (const role of platformRoles) {
        try {
          // Check if role already exists
          await this.adminClient.get(
            `/admin/realms/${realmName}/roles/${role.name}`
          );
          LoggerService.info(`Platform role already exists: ${role.name}`);
        } catch (error: any) {
          // Role doesn't exist, create it
          if (error?.response?.status === 404) {
            await this.adminClient.post(
              `/admin/realms/${realmName}/roles`,
              role
            );
            LoggerService.info(`Platform role created: ${role.name}`);
          } else {
            throw error;
          }
        }
      }

      LoggerService.info(`Platform roles created for ${realmName}`);

    } catch (error) {
      LoggerService.error('Create platform roles failed:', error);
      throw error;
    }
  }

  /**
   * Seed platform users with specific IDs
   * All users are created with predefined IDs for consistency
   */
  private static async seedPlatformUsers(realmName: string): Promise<void> {
    try {
      await this.ensureAuthenticated();

      // Production safety: do not auto-create predictable users/passwords unless explicitly enabled.
      const nodeEnv = process.env.NODE_ENV || 'development';
      const seedUsers = String(process.env.KEYCLOAK_SEED_USERS || '').toLowerCase() === 'true';
      if (nodeEnv === 'production' && !seedUsers) {
        LoggerService.info(
          'Skipping Keycloak platform user seeding in production (set KEYCLOAK_SEED_USERS=true to enable).'
        );
        return;
      }

      const getPassword = (envVar: string, fallback: string): string => {
        const v = process.env[envVar];
        if (nodeEnv === 'production') {
          if (!v || v.trim().length < 12) {
            throw createError(
              `${envVar} is required when KEYCLOAK_SEED_USERS=true in production (min 12 chars)`,
              500,
              'KEYCLOAK_MISCONFIGURED'
            );
          }
          return v;
        }
        return v || fallback;
      };

      // Platform users with specific IDs (UUIDs for consistency)
      const platformUsers = [
        {
          id: '00000000-0000-0000-0000-000000000001', // Platform Admin
          username: 'platform-admin',
          email: 'platform-admin@thaliumx.com',
          firstName: 'Platform',
          lastName: 'Administrator',
          enabled: true,
          emailVerified: true,
          roles: [this.DEFAULT_ROLES.PLATFORM_ADMIN],
          credentials: [{
            type: 'password',
            value: getPassword('PLATFORM_ADMIN_PASSWORD', 'PlatformAdmin2025!'),
            temporary: false
          }]
        },
        {
          id: '00000000-0000-0000-0000-000000000002', // Compliance Officer
          username: 'platform-compliance',
          email: 'compliance@thaliumx.com',
          firstName: 'Compliance',
          lastName: 'Officer',
          enabled: true,
          emailVerified: true,
          roles: ['platform-compliance'],
          credentials: [{
            type: 'password',
            value: getPassword('PLATFORM_COMPLIANCE_PASSWORD', 'Compliance2025!'),
            temporary: false
          }]
        },
        {
          id: '00000000-0000-0000-0000-000000000003', // Finance Manager
          username: 'platform-finance',
          email: 'finance@thaliumx.com',
          firstName: 'Finance',
          lastName: 'Manager',
          enabled: true,
          emailVerified: true,
          roles: ['platform-finance'],
          credentials: [{
            type: 'password',
            value: getPassword('PLATFORM_FINANCE_PASSWORD', 'Finance2025!'),
            temporary: false
          }]
        },
        {
          id: '00000000-0000-0000-0000-000000000004', // Support Manager
          username: 'platform-support',
          email: 'support@thaliumx.com',
          firstName: 'Support',
          lastName: 'Manager',
          enabled: true,
          emailVerified: true,
          roles: ['platform-support'],
          credentials: [{
            type: 'password',
            value: getPassword('PLATFORM_SUPPORT_PASSWORD', 'Support2025!'),
            temporary: false
          }]
        },
        {
          id: '00000000-0000-0000-0000-000000000005', // Risk Manager
          username: 'platform-risk',
          email: 'risk@thaliumx.com',
          firstName: 'Risk',
          lastName: 'Manager',
          enabled: true,
          emailVerified: true,
          roles: ['platform-risk'],
          credentials: [{
            type: 'password',
            value: getPassword('PLATFORM_RISK_PASSWORD', 'Risk2025!'),
            temporary: false
          }]
        },
        {
          id: '00000000-0000-0000-0000-000000000006', // Content Manager
          username: 'platform-content',
          email: 'content@thaliumx.com',
          firstName: 'Content',
          lastName: 'Manager',
          enabled: true,
          emailVerified: true,
          roles: ['platform-content'],
          credentials: [{
            type: 'password',
            value: getPassword('PLATFORM_CONTENT_PASSWORD', 'Content2025!'),
            temporary: false
          }]
        }
      ];

      for (const userData of platformUsers) {
        try {
          // Check if user already exists by username
          const existingUsers = await this.adminClient.get(
            `/admin/realms/${realmName}/users`,
            {
              params: { username: userData.username, exact: true }
            }
          );

          if (existingUsers.data && existingUsers.data.length > 0) {
            const existingUser = existingUsers.data[0];
            LoggerService.info(`Platform user already exists: ${userData.username} (ID: ${existingUser.id})`);
            
            // Update user if needed (but preserve existing ID)
            await this.adminClient.put(
              `/admin/realms/${realmName}/users/${existingUser.id}`,
              {
                username: userData.username,
                email: userData.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                enabled: userData.enabled,
                emailVerified: userData.emailVerified,
                attributes: {
                  'platform.user.id': [userData.id],
                  'platform.user.type': ['platform'],
                  createdAt: [new Date().toISOString()],
                  updatedAt: [new Date().toISOString()]
                }
              }
            );

            // Assign roles
            if (userData.roles && userData.roles.length > 0) {
              await this.assignRolesToUser(realmName, existingUser.id, userData.roles);
            }
          } else {
            // Create new user
            const createResponse = await this.adminClient.post(
              `/admin/realms/${realmName}/users`,
              {
                username: userData.username,
                email: userData.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                enabled: userData.enabled,
                emailVerified: userData.emailVerified,
                attributes: {
                  'platform.user.id': [userData.id],
                  'platform.user.type': ['platform'],
                  createdAt: [new Date().toISOString()],
                  updatedAt: [new Date().toISOString()]
                },
                credentials: userData.credentials
              }
            );

            // Get the created user ID from Location header
            const location = createResponse.headers.location;
            if (location) {
              const userId = location.split('/').pop();
              if (userId && userData.roles && userData.roles.length > 0) {
                await this.assignRolesToUser(realmName, userId, userData.roles);
              }
              LoggerService.info(`Platform user created: ${userData.username} (ID: ${userId}, Seed ID: ${userData.id})`);
            }
          }
        } catch (error: any) {
          // If user creation fails due to conflict, log and continue
          if (error?.response?.status === 409) {
            LoggerService.warn(`Platform user ${userData.username} already exists, skipping`);
          } else {
            LoggerService.error(`Failed to create platform user ${userData.username}:`, error);
            // Continue with other users even if one fails
          }
        }
      }

      LoggerService.info(`Platform users seeded for ${realmName}`);

    } catch (error) {
      LoggerService.error('Seed platform users failed:', error);
      throw error;
    }
  }

  /**
   * Seed tenant users with specific IDs for platform-default-tenant realm
   * All users are created with predefined IDs for consistency
   */
  private static async seedTenantUsers(realmName: string, tenantId: string): Promise<void> {
    try {
      await this.ensureAuthenticated();

      // Production safety: do not auto-create predictable users/passwords unless explicitly enabled.
      const nodeEnv = process.env.NODE_ENV || 'development';
      const seedUsers = String(process.env.KEYCLOAK_SEED_USERS || '').toLowerCase() === 'true';
      if (nodeEnv === 'production' && !seedUsers) {
        LoggerService.info(
          'Skipping Keycloak tenant user seeding in production (set KEYCLOAK_SEED_USERS=true to enable).'
        );
        return;
      }

      const getPassword = (envVar: string, fallback: string): string => {
        const v = process.env[envVar];
        if (nodeEnv === 'production') {
          if (!v || v.trim().length < 12) {
            throw createError(
              `${envVar} is required when KEYCLOAK_SEED_USERS=true in production (min 12 chars)`,
              500,
              'KEYCLOAK_MISCONFIGURED'
            );
          }
          return v;
        }
        return v || fallback;
      };

      // Tenant users with specific IDs (UUIDs for consistency)
      const tenantUsers = [
        {
          id: '10000000-0000-0000-0000-000000000001', // Broker Admin
          username: 'tenant-admin',
          email: 'admin@tenant.thaliumx.com',
          firstName: 'Tenant',
          lastName: 'Administrator',
          enabled: true,
          emailVerified: true,
          roles: [this.DEFAULT_ROLES.BROKER_ADMIN],
          credentials: [{
            type: 'password',
            value: getPassword('TENANT_ADMIN_PASSWORD', 'TenantAdmin2025!'),
            temporary: false
          }]
        },
        {
          id: '10000000-0000-0000-0000-000000000002', // Broker User
          username: 'tenant-user',
          email: 'user@tenant.thaliumx.com',
          firstName: 'Tenant',
          lastName: 'User',
          enabled: true,
          emailVerified: true,
          roles: [this.DEFAULT_ROLES.BROKER_USER],
          credentials: [{
            type: 'password',
            value: getPassword('TENANT_USER_PASSWORD', 'TenantUser2025!'),
            temporary: false
          }]
        },
        {
          id: '10000000-0000-0000-0000-000000000003', // Trader
          username: 'tenant-trader',
          email: 'trader@tenant.thaliumx.com',
          firstName: 'Tenant',
          lastName: 'Trader',
          enabled: true,
          emailVerified: true,
          roles: [this.DEFAULT_ROLES.TRADER],
          credentials: [{
            type: 'password',
            value: getPassword('TENANT_TRADER_PASSWORD', 'TenantTrader2025!'),
            temporary: false
          }]
        },
        {
          id: '10000000-0000-0000-0000-000000000004', // Investor
          username: 'tenant-investor',
          email: 'investor@tenant.thaliumx.com',
          firstName: 'Tenant',
          lastName: 'Investor',
          enabled: true,
          emailVerified: true,
          roles: [this.DEFAULT_ROLES.INVESTOR],
          credentials: [{
            type: 'password',
            value: getPassword('TENANT_INVESTOR_PASSWORD', 'TenantInvestor2025!'),
            temporary: false
          }]
        },
        {
          id: '10000000-0000-0000-0000-000000000005', // KYC User
          username: 'tenant-kyc',
          email: 'kyc@tenant.thaliumx.com',
          firstName: 'Tenant',
          lastName: 'KYC User',
          enabled: true,
          emailVerified: true,
          roles: [this.DEFAULT_ROLES.KYC_USER],
          credentials: [{
            type: 'password',
            value: getPassword('TENANT_KYC_PASSWORD', 'TenantKYC2025!'),
            temporary: false
          }]
        },
        {
          id: '10000000-0000-0000-0000-000000000006', // Tenant User
          username: 'tenant-default',
          email: 'default@tenant.thaliumx.com',
          firstName: 'Tenant',
          lastName: 'Default User',
          enabled: true,
          emailVerified: true,
          roles: [this.DEFAULT_ROLES.TENANT_USER],
          credentials: [{
            type: 'password',
            value: getPassword('TENANT_DEFAULT_PASSWORD', 'TenantDefault2025!'),
            temporary: false
          }]
        }
      ];

      for (const userData of tenantUsers) {
        try {
          // Check if user already exists by username
          const existingUsers = await this.adminClient.get(
            `/admin/realms/${realmName}/users`,
            {
              params: { username: userData.username, exact: true }
            }
          );

          if (existingUsers.data && existingUsers.data.length > 0) {
            const existingUser = existingUsers.data[0];
            LoggerService.info(`Tenant user already exists: ${userData.username} (ID: ${existingUser.id})`);
            
            // Update user if needed (but preserve existing ID)
            await this.adminClient.put(
              `/admin/realms/${realmName}/users/${existingUser.id}`,
              {
                username: userData.username,
                email: userData.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                enabled: userData.enabled,
                emailVerified: userData.emailVerified,
                attributes: {
                  'tenant.user.id': [userData.id],
                  'tenant.user.type': ['tenant'],
                  'tenant.id': [tenantId],
                  createdAt: [new Date().toISOString()],
                  updatedAt: [new Date().toISOString()]
                }
              }
            );

            // Assign roles
            if (userData.roles && userData.roles.length > 0) {
              await this.assignRolesToUser(realmName, existingUser.id, userData.roles);
            }
          } else {
            // Create new user
            const createResponse = await this.adminClient.post(
              `/admin/realms/${realmName}/users`,
              {
                username: userData.username,
                email: userData.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                enabled: userData.enabled,
                emailVerified: userData.emailVerified,
                attributes: {
                  'tenant.user.id': [userData.id],
                  'tenant.user.type': ['tenant'],
                  'tenant.id': [tenantId],
                  createdAt: [new Date().toISOString()],
                  updatedAt: [new Date().toISOString()]
                },
                credentials: userData.credentials
              }
            );

            // Get the created user ID from Location header
            const location = createResponse.headers.location;
            if (location) {
              const userId = location.split('/').pop();
              if (userId && userData.roles && userData.roles.length > 0) {
                await this.assignRolesToUser(realmName, userId, userData.roles);
              }
              LoggerService.info(`Tenant user created: ${userData.username} (ID: ${userId}, Seed ID: ${userData.id})`);
            }
          }
        } catch (error: any) {
          // If user creation fails due to conflict, log and continue
          if (error?.response?.status === 409) {
            LoggerService.warn(`Tenant user ${userData.username} already exists, skipping`);
          } else {
            LoggerService.error(`Failed to create tenant user ${userData.username}:`, error);
            // Continue with other users even if one fails
          }
        }
      }

      LoggerService.info(`Tenant users seeded for ${realmName}`);

    } catch (error) {
      LoggerService.error('Seed tenant users failed:', error);
      throw error;
    }
  }
}
/**
 * THALIUMX_KEYCLOAK_DEPRECATE
 *
 * This service contains Keycloak-specific admin API coupling.
 * After Zitadel cutover is fully proven (OIDC-only integration), this file is expected
 * to be removed or replaced by a provider-agnostic OIDC + app-DB based identity layer.
 */
