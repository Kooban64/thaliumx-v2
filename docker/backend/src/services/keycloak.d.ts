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
export declare class KeycloakService {
    private static isInitialized;
    private static adminClient;
    private static config;
    private static accessToken;
    private static tokenExpiry;
    private static realms;
    private static brokerRealms;
    private static readonly DEFAULT_ROLES;
    private static readonly DEFAULT_CLIENT_SCOPES;
    /**
     * Initialize Keycloak service
     */
    static initialize(): Promise<void>;
    /**
     * Create broker realm
     */
    static createBrokerRealm(brokerConfig: BrokerRealmConfig): Promise<RealmProvisioningResult>;
    /**
     * Create user in specific realm
     */
    static createUser(realmName: string, user: UserRepresentation): Promise<UserRepresentation>;
    /**
     * Migrate user between brokers
     */
    static migrateUser(migrationRequest: UserMigrationRequest): Promise<boolean>;
    /**
     * Validate token
     */
    static validateToken(realmName: string, token: string): Promise<any>;
    /**
     * Get user by ID
     */
    static getUser(realmName: string, userId: string): Promise<UserRepresentation | null>;
    /**
     * Update user
     */
    static updateUser(realmName: string, userId: string, updates: Partial<UserRepresentation>): Promise<void>;
    /**
     * Assign roles to user
     */
    static assignRolesToUser(realmName: string, userId: string, roles: string[]): Promise<void>;
    /**
     * Assign groups to user
     */
    static assignGroupsToUser(realmName: string, userId: string, groupIds: string[]): Promise<void>;
    /**
     * Get realm roles
     */
    static getRealmRoles(realmName: string): Promise<RoleRepresentation[]>;
    /**
     * Get broker realms
     */
    static getBrokerRealms(): BrokerRealmConfig[];
    /**
     * Get service health status
     */
    static isHealthy(): boolean;
    /**
     * Close connections
     */
    static close(): Promise<void>;
    private static loadKeycloakConfig;
    private static initializeAdminClient;
    private static authenticateAdmin;
    private static ensureAuthenticated;
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
    private static loadRealms;
    private static startHealthMonitor;
    /**
     * Ensure all broker realms exist; create missing realms with sane defaults.
     */
    static syncBrokerRealms(brokers: Array<{
        id: string;
        name: string;
        slug: string;
        domain: string;
    }>): Promise<void>;
    private static initializePlatformRealm;
    private static initializeApzhexBroker;
    private static createRealm;
    private static createBrokerClient;
    private static createBrokerRoles;
    private static createBrokerGroups;
    private static configureRealmSettings;
    private static generateClientSecret;
}
//# sourceMappingURL=keycloak.d.ts.map