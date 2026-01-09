/**
 * Enterprise Log Encryption Utility
 * 
 * Encrypts log files at rest using AES-256-GCM encryption for compliance
 * with data protection regulations (GDPR, PCI-DSS, SOX).
 * 
 * Features:
 * - AES-256-GCM encryption (authenticated encryption)
 * - Encryption keys stored in Vault (not hardcoded)
 * - Support for both encrypted and plaintext modes
 * - Automatic key rotation support
 * - Decryption utility for log analysis
 * 
 * Security:
 * - Keys never logged or exposed
 * - Each log entry encrypted with unique IV
 * - Authentication tag prevents tampering
 * - Keys stored securely in Vault
 */

import * as crypto from 'crypto';
import { SecretsService } from '../services/secrets';
import { LoggerService } from '../services/logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const TAG_LENGTH = 16; // 128 bits for authentication tag
const KEY_LENGTH = 32; // 256 bits
const SALT_LENGTH = 32; // 256 bits

interface EncryptionConfig {
  enabled: boolean;
  keyPath: string;
  key?: Buffer;
  keyDerivationSalt?: Buffer;
}

class LogEncryption {
  private static config: EncryptionConfig;
  private static initialized = false;
  private static keyCache: Map<string, { key: Buffer; expiresAt: number }> = new Map();
  private static readonly KEY_CACHE_TTL_MS = 3600000; // 1 hour

  /**
   * Initialize encryption with configuration from environment variables
   */
  public static async initialize(): Promise<void> {
    this.config = {
      enabled: process.env.LOG_ENCRYPTION_ENABLED === 'true',
      keyPath: process.env.LOG_ENCRYPTION_KEY_PATH || 'thaliumx/logging/encryption-key',
    };

    if (!this.config.enabled) {
      this.initialized = true;
      return;
    }

    try {
      await this.loadEncryptionKey();
      this.initialized = true;
    } catch (error) {
      // If key loading fails, disable encryption but log warning
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Use LoggerService if available, otherwise fall back to console (bootstrap scenario)
      if (LoggerService && typeof LoggerService.error === 'function') {
        LoggerService.error('LogEncryption: Failed to load encryption key', {
          error: errorMessage,
          action: 'Encryption disabled. Logs will be stored in plaintext.',
        });
      } else {
        // Fallback for bootstrap scenario when LoggerService not yet initialized
        console.error(`[LogEncryption] Failed to load encryption key: ${errorMessage}`);
        console.error('[LogEncryption] Encryption disabled. Logs will be stored in plaintext.');
      }
      this.config.enabled = false;
      this.initialized = true;
    }
  }

  /**
   * Load encryption key from Vault or environment variable
   */
  private static async loadEncryptionKey(): Promise<void> {
    // Check cache first
    const cached = this.keyCache.get(this.config.keyPath);
    if (cached && cached.expiresAt > Date.now()) {
      this.config.key = cached.key;
      return;
    }

    // Try to get key from Vault
    let keyString: string | undefined;
    
    if (SecretsService.isConnected()) {
      try {
        keyString = await SecretsService.getSecret(this.config.keyPath, 'key');
      } catch {
        // Vault not available or key not found, fall back to env
      }
    }

    // Fall back to environment variable
    if (!keyString) {
      keyString = process.env.LOG_ENCRYPTION_KEY;
    }

    if (!keyString) {
      throw new Error('Encryption key not found in Vault or environment variable');
    }

    // Derive key from string using PBKDF2
    const salt = process.env.LOG_ENCRYPTION_SALT 
      ? Buffer.from(process.env.LOG_ENCRYPTION_SALT, 'hex')
      : crypto.randomBytes(SALT_LENGTH);

    this.config.keyDerivationSalt = salt;

    // Derive 256-bit key using PBKDF2
    this.config.key = crypto.pbkdf2Sync(
      keyString,
      salt,
      100000, // 100k iterations
      KEY_LENGTH,
      'sha256'
    );

    // Cache the key
    this.keyCache.set(this.config.keyPath, {
      key: this.config.key,
      expiresAt: Date.now() + this.KEY_CACHE_TTL_MS,
    });
  }

  /**
   * Encrypt a log entry
   * 
   * Format: IV (16 bytes) + Tag (16 bytes) + Encrypted Data
   * 
   * @param plaintext - The log entry to encrypt (string or Buffer)
   * @returns Encrypted data as Buffer, or original data if encryption disabled
   */
  public static encrypt(plaintext: string | Buffer): Buffer {
    if (!this.initialized) {
      throw new Error('LogEncryption not initialized. Call initialize() first.');
    }

    if (!this.config.enabled || !this.config.key) {
      // Return as Buffer if already Buffer, otherwise convert string
      return Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext, 'utf8');
    }

    const plaintextBuffer = Buffer.isBuffer(plaintext) 
      ? plaintext 
      : Buffer.from(plaintext, 'utf8');

    // Generate random IV for each encryption
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, this.config.key, iv);

    // Encrypt
    const encrypted = Buffer.concat([
      cipher.update(plaintextBuffer),
      cipher.final(),
    ]);

    // Get authentication tag
    const tag = cipher.getAuthTag();

    // Combine IV + Tag + Encrypted Data
    return Buffer.concat([iv, tag, encrypted]);
  }

  /**
   * Decrypt a log entry
   * 
   * @param encrypted - Encrypted data (Buffer with IV + Tag + Data)
   * @returns Decrypted data as Buffer
   */
  public static decrypt(encrypted: Buffer): Buffer {
    if (!this.initialized) {
      throw new Error('LogEncryption not initialized. Call initialize() first.');
    }

    if (!this.config.enabled || !this.config.key) {
      // Assume plaintext if encryption disabled
      return encrypted;
    }

    // Extract IV, tag, and encrypted data
    const iv = encrypted.subarray(0, IV_LENGTH);
    const tag = encrypted.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encryptedData = encrypted.subarray(IV_LENGTH + TAG_LENGTH);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, this.config.key, iv);
    decipher.setAuthTag(tag);

    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);

    return decrypted;
  }

  /**
   * Check if data is encrypted (heuristic check)
   * 
   * @param data - Data to check
   * @returns True if data appears to be encrypted
   */
  public static isEncrypted(data: Buffer): boolean {
    if (!this.config.enabled) {
      return false;
    }

    // Encrypted data should be at least IV + Tag + some data
    const minEncryptedSize = IV_LENGTH + TAG_LENGTH + 1;
    if (data.length < minEncryptedSize) {
      return false;
    }

    // Check if first bytes look random (encrypted data should be random)
    // This is a heuristic and not foolproof
    return true;
  }

  /**
   * Get encryption status
   */
  public static isEnabled(): boolean {
    if (!this.initialized) {
      return false;
    }
    return this.config.enabled;
  }

  /**
   * Rotate encryption key (for key rotation scenarios)
   * 
   * Note: This only loads a new key. Actual re-encryption of existing logs
   * must be done separately.
   */
  public static async rotateKey(): Promise<void> {
    // Clear cache
    this.keyCache.clear();
    
    // Load new key
    await this.loadEncryptionKey();
  }

  /**
   * Decrypt a log file (utility for log analysis)
   * 
   * @param encryptedFilePath - Path to encrypted log file
   * @param outputFilePath - Optional output path (default: stdout)
   */
  public static async decryptFile(
    encryptedFilePath: string,
    outputFilePath?: string
  ): Promise<void> {
    const fs = await import('fs/promises');
    
    // Read encrypted file
    const encryptedData = await fs.readFile(encryptedFilePath);
    
    // Decrypt (assuming each line is separately encrypted, or entire file)
    // For simplicity, we'll assume the file is a single encrypted blob
    const decrypted = this.decrypt(encryptedData);
    
    if (outputFilePath) {
      await fs.writeFile(outputFilePath, decrypted);
    } else {
      process.stdout.write(decrypted);
    }
  }
}

export { LogEncryption };