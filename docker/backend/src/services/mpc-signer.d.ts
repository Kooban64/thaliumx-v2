/**
 * MPC Signer Service
 *
 * Multi-Party Computation (MPC) service for secure cryptographic operations:
 * - MPC Wallet Management
 * - Threshold Signature Schemes
 * - Secure Key Generation
 * - Transaction Signing
 * - Key Recovery & Backup
 * - Multi-Party Operations
 * - Security & Audit Trails
 *
 * Production-ready with full integration
 */
export declare enum MPCKeyType {
    ECDSA = "ecdsa",
    ED25519 = "ed25519",
    BLS = "bls",
    RSA = "rsa"
}
export declare enum MPCKeyStatus {
    GENERATING = "generating",
    ACTIVE = "active",
    SUSPENDED = "suspended",
    REVOKED = "revoked",
    RECOVERING = "recovering"
}
export declare enum MPCOperationType {
    KEY_GENERATION = "key_generation",
    SIGNATURE = "signature",
    KEY_RECOVERY = "key_recovery",
    KEY_ROTATION = "key_rotation",
    THRESHOLD_UPDATE = "threshold_update",
    BACKUP = "backup",
    RESTORE = "restore"
}
export declare enum MPCOperationStatus {
    PENDING = "pending",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    FAILED = "failed",
    CANCELLED = "cancelled"
}
export declare enum MPCKeyPurpose {
    WALLET = "wallet",
    TRANSACTION = "transaction",
    AUTHENTICATION = "authentication",
    ENCRYPTION = "encryption",
    BACKUP = "backup"
}
export interface MPCKey {
    id: string;
    brokerId: string;
    userId?: string;
    keyType: MPCKeyType;
    purpose: MPCKeyPurpose;
    status: MPCKeyStatus;
    threshold: number;
    totalParties: number;
    publicKey: string;
    keyShares: MPCKeyShare[];
    metadata: MPCKeyMetadata;
    createdAt: Date;
    updatedAt: Date;
}
export interface MPCKeyShare {
    id: string;
    keyId: string;
    partyId: string;
    shareIndex: number;
    encryptedShare: string;
    commitment: string;
    proof: string;
    status: MPCKeyStatus;
    createdAt: Date;
    updatedAt: Date;
}
export interface MPCKeyMetadata {
    derivationPath?: string;
    network?: string;
    address?: string;
    description?: string;
    tags?: string[];
    permissions?: string[];
    expiryDate?: Date;
    rotationSchedule?: string;
}
export interface MPCOperation {
    id: string;
    keyId: string;
    operationType: MPCOperationType;
    status: MPCOperationStatus;
    initiator: string;
    participants: string[];
    threshold: number;
    progress: number;
    result?: any;
    error?: string;
    metadata: MPCOperationMetadata;
    createdAt: Date;
    updatedAt: Date;
}
export interface MPCOperationMetadata {
    transactionHash?: string;
    message?: string;
    signature?: string;
    recoveryData?: any;
    backupData?: any;
    rotationData?: any;
    additionalData?: any;
}
export interface MPCSignatureRequest {
    id: string;
    keyId: string;
    message: string;
    messageHash: string;
    requester: string;
    participants: string[];
    threshold: number;
    status: MPCOperationStatus;
    signatures: MPCSignature[];
    finalSignature?: string;
    metadata: MPCSignatureMetadata;
    createdAt: Date;
    updatedAt: Date;
}
export interface MPCSignature {
    id: string;
    requestId: string;
    partyId: string;
    shareIndex: number;
    signature: string;
    proof: string;
    timestamp: Date;
}
export interface MPCSignatureMetadata {
    purpose?: string;
    transactionId?: string;
    nonce?: number;
    gasLimit?: number;
    gasPrice?: number;
    chainId?: number;
    timestamp?: number;
}
export interface MPCBackup {
    id: string;
    keyId: string;
    backupType: 'full' | 'incremental' | 'differential';
    encryptedData: string;
    checksum: string;
    size: number;
    createdBy: string;
    createdAt: Date;
    expiresAt?: Date;
}
export interface MPCAuditLog {
    id: string;
    keyId: string;
    operationType: MPCOperationType;
    actor: string;
    action: string;
    details: any;
    timestamp: Date;
    ipAddress?: string;
    userAgent?: string;
}
export interface MPCConfig {
    enabled: boolean;
    keyTypes: MPCKeyType[];
    defaultThreshold: number;
    maxThreshold: number;
    keyRotationInterval: number;
    backupRetentionDays: number;
    auditLogRetentionDays: number;
    securityLevel: 'low' | 'medium' | 'high' | 'critical';
    encryptionAlgorithm: string;
    hashAlgorithm: string;
    signatureAlgorithm: string;
}
export declare class MPCSignerService {
    private static isInitialized;
    private static config;
    private static keys;
    private static operations;
    private static signatureRequests;
    private static backups;
    private static auditLogs;
    private static readonly MPC_CONFIG;
    /**
     * Initialize MPC Signer Service
     */
    static initialize(): Promise<void>;
    /**
     * Get default MPC configuration
     */
    private static getDefaultConfig;
    /**
     * Load existing data from storage
     */
    private static loadExistingData;
    /**
     * Initialize MPC protocols
     */
    private static initializeMPCProtocols;
    /**
     * Start monitoring services
     */
    private static startMonitoringServices;
    /**
     * Monitor key rotation
     */
    private static monitorKeyRotation;
    /**
     * Perform automatic backup
     */
    private static performAutomaticBackup;
    /**
     * Monitor operations
     */
    private static monitorOperations;
    /**
     * Generate MPC key
     */
    static generateKey(brokerId: string, keyType: MPCKeyType, purpose: MPCKeyPurpose, threshold: number, totalParties: number, userId?: string, metadata?: Partial<MPCKeyMetadata>): Promise<MPCKey>;
    /**
     * Get MPC key by ID
     */
    static getKey(keyId: string): Promise<MPCKey | undefined>;
    /**
     * Get MPC keys by broker ID
     */
    static getKeysByBroker(brokerId: string): Promise<MPCKey[]>;
    /**
     * Get MPC keys by user ID
     */
    static getKeysByUser(userId: string): Promise<MPCKey[]>;
    /**
     * Sign message with MPC key
     */
    static signMessage(keyId: string, message: string, requester: string, participants: string[], metadata?: Partial<MPCSignatureMetadata>): Promise<MPCSignatureRequest>;
    /**
     * Add signature to request
     */
    static addSignature(requestId: string, partyId: string, signature: string, proof: string): Promise<MPCSignatureRequest>;
    /**
     * Complete signature request
     */
    private static completeSignature;
    /**
     * Create backup
     */
    static createBackup(keyId: string, backupType: 'full' | 'incremental' | 'differential'): Promise<MPCBackup>;
    /**
     * Rotate key
     */
    static rotateKey(keyId: string): Promise<MPCKey>;
    /**
     * Log audit event
     */
    private static logAuditEvent;
    /**
     * Get audit logs
     */
    static getAuditLogs(keyId?: string, limit?: number): Promise<MPCAuditLog[]>;
    /**
     * Health check
     */
    static isHealthy(): boolean;
    /**
     * Cleanup resources
     */
    static cleanup(): Promise<void>;
}
//# sourceMappingURL=mpc-signer.d.ts.map