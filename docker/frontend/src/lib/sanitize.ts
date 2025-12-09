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

  // Escape all HTML entities to prevent XSS
  return dirty
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
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
    .replace(/[<>'"&]/g, '') // Remove potentially dangerous characters
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
    .replace(/[<>'"&\\]/g, '') // Remove dangerous characters
    .substring(0, 254); // RFC 5321 limit
}

/**
 * Sanitize numeric input
 */
export function sanitizeNumeric(input: string | number): string {
  if (typeof input === 'number') return input.toString();

  if (typeof input !== 'string') return '0';

  // Allow only numbers, decimal point, and negative sign
  const sanitized = input.replace(/[^0-9.-]/g, '');

  // Ensure only one decimal point
  const parts = sanitized.split('.');
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('');
  }

  return sanitized;
}

/**
 * Sanitize wallet addresses (Ethereum, etc.)
 */
export function sanitizeWalletAddress(address: string): string {
  if (typeof address !== 'string') return '';

  // Remove all non-hex characters except '0x' prefix
  return address
    .trim()
    .replace(/[^0-9a-fA-Fx]/g, '')
    .substring(0, 42); // Ethereum address max length
}

/**
 * Sanitize usernames
 */
export function sanitizeUsername(username: string): string {
  if (typeof username !== 'string') return '';

  return username
    .trim()
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
    .replace(/[<>'"&\\]/g, '') // Remove dangerous characters
    .substring(0, 200); // Limit search query length
}

/**
 * Sanitize file names
 */
export function sanitizeFileName(filename: string): string {
  if (typeof filename !== 'string') return '';

  return filename
    .trim()
    .replace(/[<>'"&\\\/:*?"<>|\r\n]/g, '') // Remove dangerous chars and path separators
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
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, schema));
  }

  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    if (schema && schema[key]) {
      sanitized[key] = sanitizeFormInput(value, schema[key]);
    } else {
      // Default sanitization for unknown fields
      sanitized[key] = typeof value === 'string' ? sanitizeText(value) : value;
    }
  }

  return sanitized;
}