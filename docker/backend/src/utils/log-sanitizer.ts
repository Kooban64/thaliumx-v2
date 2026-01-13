/**
 * Enterprise Log Sanitization Utility
 * 
 * Automatically redacts PII and sensitive data from log entries to ensure
 * compliance with GDPR, PCI-DSS, and other data protection regulations.
 * 
 * Features:
 * - Deep object traversal to sanitize nested structures
 * - Configurable redaction patterns via environment variables
 * - Preserves structure while redacting values
 * - Performance optimized with pattern caching
 * - Supports custom redaction patterns
 */

interface SanitizationConfig {
  sanitizePII: boolean;
  redactEmails: boolean;
  redactPhones: boolean;
  customPatterns: RegExp[];
}

// Sensitive field names (case-insensitive matching)
const SENSITIVE_FIELDS = new Set([
  'password',
  'passwd',
  'pwd',
  'secret',
  'apikey',
  'api_key',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'token',
  'authorization',
  'auth',
  'private_key',
  'privateKey',
  'privatekey',
  'secretkey',
  'secret_key',
  'ssn',
  'social_security',
  'credit_card',
  'creditcard',
  'card_number',
  'cardnumber',
  'cvv',
  'cvc',
  'pin',
  'iban',
  'routing_number',
  'routingnumber',
  'account_number',
  'accountnumber',
]);

// Credit card patterns (Luhn algorithm compatible patterns)
const CREDIT_CARD_PATTERN = /\b(?:\d[ -]*?){13,19}\b/g;

// SSN pattern (XXX-XX-XXXX or XXXXXXXXX)
const SSN_PATTERN = /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g;

// IBAN pattern (2 letters + 2 digits + up to 30 alphanumeric)
const IBAN_PATTERN = /\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/g;

// Email pattern (optional redaction)
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// Phone number patterns (various formats)
const PHONE_PATTERNS = [
  /\b\d{3}[-\s.]?\d{3}[-\s.]?\d{4}\b/g, // US format
  /\b\+?\d{1,3}[-\s.]?\d{1,4}[-\s.]?\d{1,4}[-\s.]?\d{1,9}\b/g, // International
];

// Crypto private key patterns (hex, base58, WIF formats)
const CRYPTO_KEY_PATTERNS = [
  /\b[0-9a-fA-F]{64}\b/g, // 64-char hex (Bitcoin private key)
  /\b5[HJK][1-9A-HJ-NP-Za-km-z]{49,51}\b/g, // WIF format
  /\b[1-9A-HJ-NP-Za-km-z]{51,52}\b/g, // Base58 private key
];

const REDACTION_PLACEHOLDER = '[REDACTED]';
const PARTIAL_REDACTION_PLACEHOLDER = '***';

class LogSanitizer {
  private static config: SanitizationConfig;
  private static initialized = false;
  private static patternCache: Map<string, RegExp> = new Map();

  /**
   * Initialize sanitizer with configuration from environment variables
   */
  public static initialize(): void {
    this.config = {
      sanitizePII: process.env.LOG_SANITIZE_PII !== 'false', // Default: true
      redactEmails: process.env.LOG_REDACT_EMAILS === 'true', // Default: false
      redactPhones: process.env.LOG_REDACT_PHONES === 'true', // Default: false
      customPatterns: this.loadCustomPatterns(),
    };
    this.initialized = true;
  }

  /**
   * Load custom redaction patterns from environment variable
   * Format: LOG_CUSTOM_PATTERNS="pattern1,pattern2" (comma-separated regex patterns)
   */
  private static loadCustomPatterns(): RegExp[] {
    const customPatternsEnv = process.env.LOG_CUSTOM_PATTERNS;
    if (!customPatternsEnv) {
      return [];
    }

    return customPatternsEnv
      .split(',')
      .map((pattern) => pattern.trim())
      .filter((pattern) => pattern.length > 0)
      .map((pattern) => {
        try {
          // Cache compiled regex patterns
          if (this.patternCache.has(pattern)) {
            return this.patternCache.get(pattern)!;
          }
          const regex = new RegExp(pattern, 'gi');
          this.patternCache.set(pattern, regex);
          return regex;
        } catch {
          // Invalid regex pattern, skip it
          return null;
        }
      })
      .filter((pattern): pattern is RegExp => pattern !== null);
  }

  /**
   * Sanitize a value based on its type and content
   */
  private static sanitizeValue(value: unknown, fieldName: string | undefined, visited: WeakSet<object>): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    // Check if field name indicates sensitive data
    if (fieldName && SENSITIVE_FIELDS.has(fieldName.toLowerCase())) {
      return REDACTION_PLACEHOLDER;
    }

    // Handle strings
    if (typeof value === 'string') {
      let sanitized = value;

      // Apply credit card pattern
      if (CREDIT_CARD_PATTERN.test(sanitized)) {
        sanitized = sanitized.replace(CREDIT_CARD_PATTERN, REDACTION_PLACEHOLDER);
      }

      // Apply SSN pattern
      if (SSN_PATTERN.test(sanitized)) {
        sanitized = sanitized.replace(SSN_PATTERN, REDACTION_PLACEHOLDER);
      }

      // Apply IBAN pattern
      if (IBAN_PATTERN.test(sanitized)) {
        sanitized = sanitized.replace(IBAN_PATTERN, REDACTION_PLACEHOLDER);
      }

      // Apply crypto key patterns
      for (const pattern of CRYPTO_KEY_PATTERNS) {
        if (pattern.test(sanitized)) {
          sanitized = sanitized.replace(pattern, REDACTION_PLACEHOLDER);
        }
      }

      // Apply email pattern (if enabled)
      if (this.config.redactEmails && EMAIL_PATTERN.test(sanitized)) {
        sanitized = sanitized.replace(EMAIL_PATTERN, (match) => {
          // Partial redaction: show first char and domain
          const [local, domain] = match.split('@');
          if (local && domain) {
            return `${local[0]}${PARTIAL_REDACTION_PLACEHOLDER}@${domain}`;
          }
          return REDACTION_PLACEHOLDER;
        });
      }

      // Apply phone patterns (if enabled)
      if (this.config.redactPhones) {
        for (const pattern of PHONE_PATTERNS) {
          if (pattern.test(sanitized)) {
            sanitized = sanitized.replace(pattern, REDACTION_PLACEHOLDER);
          }
        }
      }

      // Apply custom patterns
      for (const pattern of this.config.customPatterns) {
        if (pattern.test(sanitized)) {
          sanitized = sanitized.replace(pattern, REDACTION_PLACEHOLDER);
        }
      }

      return sanitized;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeValue(item, undefined, visited));
    }

    // Handle objects - check for circular reference BEFORE processing
    if (typeof value === 'object' && value !== null) {
      // Check for circular reference
      if (visited.has(value)) {
        return { '[CIRCULAR]': true };
      }
      return this.sanitizeObject(value as Record<string, unknown>, visited);
    }

    // Return primitive values as-is
    return value;
  }

  /**
   * Recursively sanitize an object with cycle detection
   */
  private static sanitizeObject(obj: Record<string, unknown>, visited: WeakSet<object>): Record<string, unknown> {
    // Cycle detection - prevent infinite recursion
    if (visited.has(obj)) {
      return { '[CIRCULAR]': true };
    }
    visited.add(obj);

    const sanitized: Record<string, unknown> = {};

    try {
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeValue(value, key, visited);
      }
    } catch {
      // If Object.entries fails (e.g., on circular structures), return minimal object
      return { '[ERROR]': 'Failed to sanitize object' };
    }

    return sanitized;
  }

  /**
   * Sanitize log data (main public API)
   * 
   * @param data - The data to sanitize (can be any type)
   * @returns Sanitized data with same structure
   */
  public static sanitize(data: unknown): unknown {
    if (!this.initialized) {
      this.initialize();
    }

    if (!this.config.sanitizePII) {
      return data;
    }

    if (data === null || data === undefined) {
      return data;
    }

    const visited = new WeakSet<object>();

    // Handle primitives
    if (typeof data !== 'object') {
      return this.sanitizeValue(data, undefined, visited);
    }

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeValue(item, undefined, visited));
    }

    // Handle objects
    if (typeof data === 'object') {
      return this.sanitizeObject(data as Record<string, unknown>, visited);
    }

    return data;
  }

  /**
   * Check if a field name indicates sensitive data
   */
  public static isSensitiveField(fieldName: string): boolean {
    return SENSITIVE_FIELDS.has(fieldName.toLowerCase());
  }

  /**
   * Get sanitization statistics (for monitoring)
   */
  public static getConfig(): Readonly<SanitizationConfig> {
    if (!this.initialized) {
      this.initialize();
    }
    return { ...this.config };
  }
}

export { LogSanitizer, REDACTION_PLACEHOLDER };