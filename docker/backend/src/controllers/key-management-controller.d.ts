/**
 * Key Management Controller
 *
 * Complete implementation matching original financial-svc
 * Handles HSM integration for encryption, decryption, signing, and verification
 *
 * Key Features:
 * - Key creation with configurable algorithms and expiration
 * - Key rotation with version tracking
 * - Key revocation with audit trail
 * - Encryption/decryption using AES-256-GCM
 * - Digital signatures using RSA-SHA256
 * - Key usage statistics and audit logging
 * - Key health monitoring and expiration alerts
 */
import { Request, Response } from 'express';
export declare class KeyManagementController {
    /**
     * Encrypt key material for storage
     */
    private encryptKeyMaterial;
    /**
     * Decrypt key material from storage
     */
    private decryptKeyMaterial;
    /**
     * Log audit event
     */
    private logAudit;
    /**
     * Create a new encryption key
     */
    createKey(req: Request, res: Response): Promise<void>;
    /**
     * Rotate a key - creates new key material while preserving the key ID
     */
    rotateKey(req: Request, res: Response): Promise<void>;
    /**
     * Revoke a key - marks key as unusable
     */
    revokeKey(req: Request, res: Response): Promise<void>;
    /**
     * Encrypt data using stored key
     */
    encryptData(req: Request, res: Response): Promise<void>;
    /**
     * Decrypt data using HSM
     */
    decryptData(req: Request, res: Response): Promise<void>;
    /**
     * Sign data using HSM
     */
    signData(req: Request, res: Response): Promise<void>;
    /**
     * Verify signature using HSM
     */
    verifySignature(req: Request, res: Response): Promise<void>;
    /**
     * Get key usage statistics
     */
    getKeyUsageStats(req: Request, res: Response): Promise<void>;
    /**
     * Get key audit logs
     */
    getKeyAuditLogs(req: Request, res: Response): Promise<void>;
    /**
     * Check key expiration - returns keys expiring soon and already expired
     */
    checkKeyExpiration(req: Request, res: Response): Promise<void>;
    /**
     * Get key health status - provides overview of key management system
     */
    getKeyHealth(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=key-management-controller.d.ts.map