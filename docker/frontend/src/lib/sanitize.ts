/**
 * Input Sanitization Utilities
 *
 * Provides comprehensive input sanitization for client-side security
 * Prevents XSS attacks and ensures clean user input
 */

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHtml(dirty: string): string {
  if (typeof dirty !== 'string') return '';

  // Escape HTML entities to prevent XSS.
  // IMPORTANT: `&` must be escaped first to avoid double-escaping.
  return dirty
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/\\/g, '&#x5C;')
    .replace(/`/g, '&#x60;');
}

/**
 * Sanitize text input (names, descriptions, etc.)
 */
export function sanitizeText(input: string): string {
  if (typeof input !== 'string') return '';

  return input
    .trim()
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .substring(0, 1000); // Limit length
}

/**
 * Sanitize email addresses
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return '';

  return email
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    // Keep only characters that are valid in common emails.
    .replace(/[^a-z0-9@._+\-]/g, '')
    .substring(0, 254); // RFC 5321 limit
}

/**
 * Sanitize numeric input
 */
export function sanitizeNumeric(input: string | number): string {
  if (typeof input === 'number') return input.toString();

  if (typeof input !== 'string') return '0';

  // Allow only numbers, decimal point, and negative sign
  let sanitized = input.replace(/[^0-9.-]/g, '');

  // Keep a single leading minus.
  const isNegative = sanitized.startsWith('-');
  sanitized = sanitized.replace(/-/g, '');

  // Ensure only one decimal point (keep only the first fractional part).
  const parts = sanitized.split('.');
  const intPart = parts[0] || '0';
  const fracPart = parts.length > 1 ? parts[1] : '';
  const out = fracPart ? `${intPart}.${fracPart}` : intPart;
  return isNegative ? `-${out}` : out;
}

/**
 * Sanitize wallet addresses (Ethereum, etc.)
 */
export function sanitizeWalletAddress(address: string): string {
  if (typeof address !== 'string') return '';

  const trimmed = address.trim();
  const noPrefix = trimmed.replace(/^0x/i, '');
  const hex = noPrefix.replace(/[^0-9a-fA-F]/g, '').substring(0, 40);
  return `0x${hex}`;
}

/**
 * Sanitize usernames
 */
export function sanitizeUsername(username: string): string {
  if (typeof username !== 'string') return '';

  return username
    .trim()
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/[<>'"&\\\/\s]/g, '') // Remove dangerous chars and spaces
    .substring(0, 50); // Reasonable username length
}

/**
 * Sanitize search queries
 */
export function sanitizeSearchQuery(query: string): string {
  if (typeof query !== 'string') return '';

  return query
    .trim()
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/[<>'"&\\]/g, '') // Remove dangerous characters
    .substring(0, 200); // Limit search query length
}

/**
 * Sanitize file names
 */
export function sanitizeFileName(filename: string): string {
  if (typeof filename !== 'string') return '';

  // Remove path separators, collapse traversal dots, keep a single dot for extensions.
  const noSlashes = filename.trim().replace(/[\\\/\r\n]/g, '');
  const collapsedDots = noSlashes.replace(/\.+/g, '.').replace(/^\.+/g, '');
  return collapsedDots
    .replace(/[<>'"&:*?"<>|]/g, '')
    .substring(0, 255); // Reasonable filename length
}

/**
 * Check if input contains suspicious patterns
 */
export function containsSuspiciousPatterns(input: string): boolean {
  if (typeof input !== 'string') return false;

  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /vbscript:/i,
    /data:\s*text\/html/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /expression\s*\(/i,
    /vbscript:/i,
    /onload\s*=/i,
    /onerror\s*=/i,
  ];

  return suspiciousPatterns.some(pattern => pattern.test(input));
}

/**
 * Comprehensive input sanitization for forms
 */
export function sanitizeFormInput(input: any, type: 'text' | 'email' | 'number' | 'wallet' | 'username' | 'search' | 'filename'): string {
  if (input === null || input === undefined) return '';

  const stringInput = String(input);

  // Check for suspicious patterns first
  if (containsSuspiciousPatterns(stringInput)) {
    throw new Error('Input contains suspicious patterns');
  }

  switch (type) {
    case 'email':
      return sanitizeEmail(stringInput);
    case 'number':
      return sanitizeNumeric(stringInput);
    case 'wallet':
      return sanitizeWalletAddress(stringInput);
    case 'username':
      return sanitizeUsername(stringInput);
    case 'search':
      return sanitizeSearchQuery(stringInput);
    case 'filename':
      return sanitizeFileName(stringInput);
    case 'text':
    default:
      return sanitizeText(stringInput);
  }
}

/**
 * Sanitize object properties recursively
 */
export function sanitizeObject(obj: any, schema?: Record<string, 'text' | 'email' | 'number' | 'wallet' | 'username' | 'search' | 'filename'>): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeText(obj);
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, schema));
  }

  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    if (schema && schema[key]) {
      try {
        sanitized[key] = sanitizeFormInput(value, schema[key]);
      } catch (error) {
        // Schema path is strict (can throw). For object-wide sanitization, prefer best-effort.
        sanitized[key] = typeof value === 'string' ? sanitizeText(value) : sanitizeObject(value, schema);
      }
    } else {
      // Default sanitization for unknown fields
      if (typeof value === 'string') {
        // Lightweight heuristic: treat fields named like "email" as emails.
        if (/email/i.test(key)) sanitized[key] = sanitizeEmail(value);
        else sanitized[key] = sanitizeText(value);
      } else {
        sanitized[key] = sanitizeObject(value, schema);
      }
    }
  }

  return sanitized;
}
