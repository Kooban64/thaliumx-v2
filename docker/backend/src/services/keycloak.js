"use strict";
/**
 * Keycloak Integration Service
 *
 * Complete Keycloak integration for white-label broker management:
 * - Multi-realm architecture (Platform + Broker realms)
 * - Automatic realm provisioning for new brokers
 * - User management across realms
 * - Role-based access control (RBAC)
 * - SSO and federation support
 * - Token management and validation
 * - User migration between brokers
 * - APZHEX default broker integration
 *
 * Production-ready with comprehensive error handling
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeycloakService = void 0;
const logger_1 = require("./logger");
const config_1 = require("./config");
const event_streaming_1 = require("./event-streaming");
const utils_1 = require("../utils");
// Keycloak Admin Client (using axios for better control)
const axios_1 = __importDefault(require("axios"));
// =============================================================================
// KEYCLOAK SERVICE CLASS
// =============================================================================
class KeycloakService {
    static isInitialized = false;
    static adminClient;
    static config;
    static accessToken = null;
    static tokenExpiry = 0;
    static realms = new Map();
    static brokerRealms = new Map();
    // Default roles for different user types
    static DEFAULT_ROLES = {
        PLATFORM_ADMIN: 'platform-admin',
        BROKER_ADMIN: 'broker-admin',
        BROKER_USER: 'broker-user',
        TRADER: 'trader',
        INVESTOR: 'investor',
        KYC_USER: 'kyc-user',
        APZHEX_USER: 'apzhex-user'
    };
    // Default client scopes
    static DEFAULT_CLIENT_SCOPES = [
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
    static async initialize() {
        try {
            logger_1.LoggerService.info('Initializing Keycloak Service...');
            // Load configuration
            this.config = this.loadKeycloakConfig();
            // Initialize admin client
            this.initializeAdminClient();
            // Authenticate admin user
            await this.authenticateAdmin();
            // Load existing realms
            await this.loadRealms();
            // Initialize platform realm
            await this.initializePlatformRealm();
            // Initialize APZHEX broker realm
            await this.initializeApzhexBroker();
            // Start periodic health monitoring
            this.startHealthMonitor();
            this.isInitialized = true;
            logger_1.LoggerService.info('✅ Keycloak Service initialized successfully');
            // Emit initialization event
            await event_streaming_1.EventStreamingService.emitSystemEvent('keycloak.initialized', 'KeycloakService', 'info', {
                message: 'Keycloak service initialized',
                realmsCount: this.realms.size,
                brokerRealmsCount: this.brokerRealms.size
            });
        }
        catch (error) {
            logger_1.LoggerService.error('❌ Keycloak Service initialization failed:', error);
            throw error;
        }
    }
    /**
     * Create broker realm
     */
    static async createBrokerRealm(brokerConfig) {
        try {
            logger_1.LoggerService.info(`Creating broker realm: ${brokerConfig.realm}`, {
                brokerId: brokerConfig.brokerId,
                brokerName: brokerConfig.brokerName
            });
            const result = {
                success: false,
                realmName: brokerConfig.realm,
                brokerId: brokerConfig.brokerId
            };
            // Check if realm already exists
            if (this.realms.has(brokerConfig.realm)) {
                result.warnings = ['Realm already exists'];
                logger_1.LoggerService.warn(`Realm ${brokerConfig.realm} already exists`);
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
            logger_1.LoggerService.info(`Broker realm created successfully: ${brokerConfig.realm}`, {
                brokerId: brokerConfig.brokerId,
                adminUrl: result.adminUrl
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('keycloak.broker.realm.created', 'broker_realm', brokerConfig.realm, {
                brokerId: brokerConfig.brokerId,
                brokerName: brokerConfig.brokerName,
                domain: brokerConfig.domain,
                features: brokerConfig.features
            });
            return result;
        }
        catch (error) {
            logger_1.LoggerService.error('Broker realm creation failed:', error);
            throw error;
        }
    }
    /**
     * Create user in specific realm
     */
    static async createUser(realmName, user) {
        try {
            await this.ensureAuthenticated();
            const response = await this.adminClient.post(`/admin/realms/${realmName}/users`, {
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
            });
            const createdUser = response.data;
            logger_1.LoggerService.info(`User created in realm ${realmName}: ${user.username}`, {
                userId: createdUser.id,
                realm: realmName,
                brokerId: user.brokerId
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('keycloak.user.created', 'user', createdUser.id, {
                username: user.username,
                email: user.email,
                realm: realmName,
                brokerId: user.brokerId
            });
            return createdUser;
        }
        catch (error) {
            logger_1.LoggerService.error('User creation failed:', error);
            throw error;
        }
    }
    /**
     * Migrate user between brokers
     */
    static async migrateUser(migrationRequest) {
        try {
            logger_1.LoggerService.info('Starting user migration', {
                userId: migrationRequest.userId,
                fromBroker: migrationRequest.fromBrokerId,
                toBroker: migrationRequest.toBrokerId
            });
            // Get user from source realm
            const sourceUser = await this.getUser(migrationRequest.fromBrokerId, migrationRequest.userId);
            if (!sourceUser) {
                throw (0, utils_1.createError)('User not found in source realm', 404, 'USER_NOT_FOUND');
            }
            // Create user in target realm
            const targetUser = {
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
                await this.assignRolesToUser(migrationRequest.toBrokerId, createdUser.id, sourceUser.roles);
            }
            // Copy groups if requested
            if (migrationRequest.preserveGroups && sourceUser.groups) {
                await this.assignGroupsToUser(migrationRequest.toBrokerId, createdUser.id, sourceUser.groups);
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
            logger_1.LoggerService.info('User migration completed successfully', {
                userId: migrationRequest.userId,
                fromBroker: migrationRequest.fromBrokerId,
                toBroker: migrationRequest.toBrokerId
            });
            // Emit audit event
            await event_streaming_1.EventStreamingService.emitAuditEvent('keycloak.user.migrated', 'user', migrationRequest.userId, {
                fromBroker: migrationRequest.fromBrokerId,
                toBroker: migrationRequest.toBrokerId,
                preserveRoles: migrationRequest.preserveRoles,
                preserveGroups: migrationRequest.preserveGroups
            });
            return true;
        }
        catch (error) {
            logger_1.LoggerService.error('User migration failed:', error);
            throw error;
        }
    }
    /**
     * Validate token
     */
    static async validateToken(realmName, token) {
        try {
            await this.ensureAuthenticated();
            const response = await this.adminClient.get(`/admin/realms/${realmName}/protocol/openid-connect/userinfo`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return response.data;
        }
        catch (error) {
            logger_1.LoggerService.error('Token validation failed:', error);
            throw (0, utils_1.createError)('Invalid token', 401, 'INVALID_TOKEN');
        }
    }
    /**
     * Get user by ID
     */
    static async getUser(realmName, userId) {
        try {
            await this.ensureAuthenticated();
            const response = await this.adminClient.get(`/admin/realms/${realmName}/users/${userId}`);
            return response.data;
        }
        catch (error) {
            if (error.response?.status === 404) {
                return null;
            }
            logger_1.LoggerService.error('Get user failed:', error);
            throw error;
        }
    }
    /**
     * Update user
     */
    static async updateUser(realmName, userId, updates) {
        try {
            await this.ensureAuthenticated();
            await this.adminClient.put(`/admin/realms/${realmName}/users/${userId}`, {
                ...updates,
                attributes: {
                    ...updates.attributes,
                    updatedAt: [new Date().toISOString()]
                }
            });
            logger_1.LoggerService.info(`User updated in realm ${realmName}: ${userId}`);
        }
        catch (error) {
            logger_1.LoggerService.error('Update user failed:', error);
            throw error;
        }
    }
    /**
     * Assign roles to user
     */
    static async assignRolesToUser(realmName, userId, roles) {
        try {
            await this.ensureAuthenticated();
            // Get realm roles
            const realmRoles = await this.getRealmRoles(realmName);
            const rolesToAssign = realmRoles.filter(role => roles.includes(role.name));
            if (rolesToAssign.length > 0) {
                await this.adminClient.post(`/admin/realms/${realmName}/users/${userId}/role-mappings/realm`, rolesToAssign);
            }
            logger_1.LoggerService.info(`Roles assigned to user ${userId} in realm ${realmName}`, {
                roles: rolesToAssign.map(r => r.name)
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Assign roles failed:', error);
            throw error;
        }
    }
    /**
     * Assign groups to user
     */
    static async assignGroupsToUser(realmName, userId, groupIds) {
        try {
            await this.ensureAuthenticated();
            for (const groupId of groupIds) {
                await this.adminClient.put(`/admin/realms/${realmName}/users/${userId}/groups/${groupId}`);
            }
            logger_1.LoggerService.info(`Groups assigned to user ${userId} in realm ${realmName}`, {
                groupIds
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Assign groups failed:', error);
            throw error;
        }
    }
    /**
     * Get realm roles
     */
    static async getRealmRoles(realmName) {
        try {
            await this.ensureAuthenticated();
            const response = await this.adminClient.get(`/admin/realms/${realmName}/roles`);
            return response.data;
        }
        catch (error) {
            logger_1.LoggerService.error('Get realm roles failed:', error);
            throw error;
        }
    }
    /**
     * Get broker realms
     */
    static getBrokerRealms() {
        return Array.from(this.brokerRealms.values());
    }
    /**
     * Get service health status
     */
    static isHealthy() {
        return this.isInitialized && this.accessToken !== null;
    }
    /**
     * Close connections
     */
    static async close() {
        try {
            logger_1.LoggerService.info('Closing Keycloak Service...');
            this.isInitialized = false;
            this.accessToken = null;
            this.tokenExpiry = 0;
            logger_1.LoggerService.info('✅ Keycloak Service closed');
        }
        catch (error) {
            logger_1.LoggerService.error('Error closing Keycloak Service:', error);
            throw error;
        }
    }
    // =============================================================================
    // PRIVATE METHODS
    // =============================================================================
    static loadKeycloakConfig() {
        const config = config_1.ConfigService.getConfig();
        return {
            baseUrl: process.env.KEYCLOAK_URL || 'http://localhost:8080',
            realm: process.env.KEYCLOAK_REALM || 'master',
            clientId: process.env.KEYCLOAK_CLIENT_ID || 'admin-cli',
            clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',
            adminUsername: process.env.KEYCLOAK_ADMIN_USERNAME || 'admin',
            adminPassword: process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin',
            timeout: parseInt(process.env.KEYCLOAK_TIMEOUT || '30000'),
            retryAttempts: parseInt(process.env.KEYCLOAK_RETRY_ATTEMPTS || '3')
        };
    }
    static initializeAdminClient() {
        this.adminClient = axios_1.default.create({
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
        this.adminClient.interceptors.response.use((response) => response, async (error) => {
            const originalConfig = error.config || {};
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
        });
    }
    static async authenticateAdmin() {
        try {
            const response = await axios_1.default.post(`${this.config.baseUrl}/realms/${this.config.realm}/protocol/openid-connect/token`, new URLSearchParams({
                grant_type: 'password',
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                username: this.config.adminUsername,
                password: this.config.adminPassword
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            const tokenData = response.data;
            this.accessToken = tokenData.access_token;
            this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000);
            logger_1.LoggerService.info('Keycloak admin authentication successful');
        }
        catch (error) {
            logger_1.LoggerService.error('Keycloak admin authentication failed:', error);
            throw (0, utils_1.createError)('Keycloak authentication failed', 401, 'KEYCLOAK_AUTH_FAILED');
        }
    }
    static async ensureAuthenticated() {
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
    static async loadRealms() {
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
                logger_1.LoggerService.info(`Loaded ${realms.length} existing realms`);
                return; // Success - exit retry loop
            }
            catch (error) {
                const isLastAttempt = attempt === maxRetries;
                const isSchemaError = error?.response?.status === 500 &&
                    (error?.response?.data?.error?.includes('relation') ||
                        error?.message?.includes('relation'));
                if (isSchemaError && !isLastAttempt) {
                    // Keycloak schema not initialized yet - retry with exponential backoff
                    const delay = baseDelay * Math.pow(2, attempt - 1);
                    logger_1.LoggerService.warn(`Keycloak schema may not be initialized yet (attempt ${attempt}/${maxRetries}). ` +
                        `Retrying in ${delay}ms...`, { error: error.message });
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                if (isLastAttempt) {
                    logger_1.LoggerService.error('Load realms failed after all retries:', error);
                    throw error;
                }
                // For other errors, retry with exponential backoff
                const delay = baseDelay * Math.pow(2, attempt - 1);
                logger_1.LoggerService.warn(`Load realms failed (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`, { error: error.message });
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    static startHealthMonitor() {
        const intervalMs = parseInt(process.env.KEYCLOAK_HEALTH_INTERVAL_MS || '30000');
        setInterval(async () => {
            try {
                await this.ensureAuthenticated();
                await this.adminClient.get('/admin/realms');
            }
            catch (error) {
                logger_1.LoggerService.warn('Keycloak health check failed', { error: error instanceof Error ? error.message : String(error) });
            }
        }, intervalMs);
    }
    /**
     * Ensure all broker realms exist; create missing realms with sane defaults.
     */
    static async syncBrokerRealms(brokers) {
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
                    };
                    await this.createBrokerRealm(cfg);
                    logger_1.LoggerService.info('Synchronized missing broker realm', { realm: realmName, brokerId: b.id });
                }
            }
        }
        catch (error) {
            logger_1.LoggerService.error('Sync broker realms failed:', error);
            throw error;
        }
    }
    static async initializePlatformRealm() {
        try {
            const platformRealm = 'thaliumx-platform';
            if (!this.realms.has(platformRealm)) {
                const realmConfig = {
                    realm: platformRealm,
                    displayName: 'ThaliumX Platform',
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
                logger_1.LoggerService.info('Platform realm initialized');
            }
        }
        catch (error) {
            logger_1.LoggerService.error('Initialize platform realm failed:', error);
            throw error;
        }
    }
    static async initializeApzhexBroker() {
        try {
            const apzhexRealm = 'apzhex-broker';
            if (!this.realms.has(apzhexRealm)) {
                const apzhexConfig = {
                    realm: apzhexRealm,
                    displayName: 'APZHEX Broker',
                    enabled: true,
                    brokerId: 'apzhex',
                    brokerName: 'APZHEX',
                    domain: 'apzhex.thaliumx.com',
                    branding: {
                        logo: '/assets/logos/apzhex-logo.png',
                        favicon: '/assets/favicons/apzhex-favicon.ico',
                        primaryColor: '#1e40af',
                        secondaryColor: '#3b82f6',
                        customCss: '.apzhex-theme { --primary: #1e40af; --secondary: #3b82f6; }'
                    },
                    features: {
                        trading: true,
                        margin: true,
                        nft: true,
                        dex: true,
                        presale: true
                    },
                    limits: {
                        maxUsers: 1000000,
                        maxTradingVolume: 1000000000,
                        maxMarginLeverage: 10
                    },
                    apzhexIntegration: true,
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
                    webAuthnPolicyRpEntityName: 'APZHEX Broker',
                    webAuthnPolicySignatureAlgorithms: ['ES256'],
                    webAuthnPolicyRpId: 'apzhex.thaliumx.com',
                    webAuthnPolicyAttestationConveyancePreference: 'not specified',
                    webAuthnPolicyAuthenticatorAttachment: 'not specified',
                    webAuthnPolicyRequireResidentKey: 'not specified',
                    webAuthnPolicyUserVerificationRequirement: 'not specified',
                    webAuthnPolicyCreateTimeout: 0,
                    webAuthnPolicyAvoidSameAuthenticatorRegister: false,
                    webAuthnPolicyAcceptableAaguids: [],
                    webAuthnPolicyPasswordlessRpEntityName: 'APZHEX Broker',
                    webAuthnPolicyPasswordlessSignatureAlgorithms: ['ES256'],
                    webAuthnPolicyPasswordlessRpId: 'apzhex.thaliumx.com',
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
                        'broker.id': ['apzhex'],
                        'broker.default': ['true'],
                        'broker.version': ['1.0.0']
                    }
                };
                await this.createBrokerRealm(apzhexConfig);
                logger_1.LoggerService.info('APZHEX broker realm initialized');
            }
        }
        catch (error) {
            logger_1.LoggerService.error('Initialize APZHEX broker failed:', error);
            throw error;
        }
    }
    static async createRealm(realmConfig) {
        try {
            await this.ensureAuthenticated();
            await this.adminClient.post('/admin/realms', realmConfig);
            logger_1.LoggerService.info(`Realm created: ${realmConfig.realm}`);
        }
        catch (error) {
            logger_1.LoggerService.error('Create realm failed:', error);
            throw error;
        }
    }
    static async createBrokerClient(brokerConfig) {
        try {
            await this.ensureAuthenticated();
            const clientConfig = {
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
            const response = await this.adminClient.post(`/admin/realms/${brokerConfig.realm}/clients`, clientConfig);
            const createdClient = response.data;
            logger_1.LoggerService.info(`Broker client created: ${clientConfig.clientId}`);
            return {
                ...clientConfig,
                id: createdClient.id,
                secret: clientConfig.secret
            };
        }
        catch (error) {
            logger_1.LoggerService.error('Create broker client failed:', error);
            throw error;
        }
    }
    static async createBrokerRoles(brokerConfig) {
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
                await this.adminClient.post(`/admin/realms/${brokerConfig.realm}/roles`, role);
            }
            logger_1.LoggerService.info(`Broker roles created for ${brokerConfig.realm}`);
        }
        catch (error) {
            logger_1.LoggerService.error('Create broker roles failed:', error);
            throw error;
        }
    }
    static async createBrokerGroups(brokerConfig) {
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
                await this.adminClient.post(`/admin/realms/${brokerConfig.realm}/groups`, group);
            }
            logger_1.LoggerService.info(`Broker groups created for ${brokerConfig.realm}`);
        }
        catch (error) {
            logger_1.LoggerService.error('Create broker groups failed:', error);
            throw error;
        }
    }
    static async configureRealmSettings(brokerConfig) {
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
            await this.adminClient.put(`/admin/realms/${brokerConfig.realm}`, realmSettings);
            logger_1.LoggerService.info(`Realm settings configured for ${brokerConfig.realm}`);
        }
        catch (error) {
            logger_1.LoggerService.error('Configure realm settings failed:', error);
            throw error;
        }
    }
    static generateClientSecret() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 32; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}
exports.KeycloakService = KeycloakService;
//# sourceMappingURL=keycloak.js.map