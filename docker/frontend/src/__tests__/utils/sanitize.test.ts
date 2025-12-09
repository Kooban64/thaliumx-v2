/**
 * Unit Tests for Input Sanitization Utilities
 */

import {
  sanitizeText,
  sanitizeEmail,
  sanitizeNumeric,
  sanitizeWalletAddress,
  sanitizeUsername,
  sanitizeSearchQuery,
  sanitizeFileName,
  sanitizeHtml,
  containsSuspiciousPatterns,
  sanitizeFormInput,
  sanitizeObject,
} from '../../lib/sanitize';

describe('Input Sanitization Utilities', () => {
  describe('sanitizeText', () => {
    it('should trim whitespace', () => {
      expect(sanitizeText('  hello world  ')).toBe('hello world');
    });

    it('should remove dangerous characters', () => {
      expect(sanitizeText('<script>alert("xss")</script>')).toBe('scriptalert("xss")script');
    });

    it('should normalize whitespace', () => {
      expect(sanitizeText('hello   world')).toBe('hello world');
    });

    it('should limit length', () => {
      const longText = 'a'.repeat(2000);
      expect(sanitizeText(longText)).toHaveLength(1000);
    });

    it('should handle null/undefined', () => {
      expect(sanitizeText(null as any)).toBe('');
      expect(sanitizeText(undefined as any)).toBe('');
    });
  });

  describe('sanitizeEmail', () => {
    it('should trim and lowercase email', () => {
      expect(sanitizeEmail('  USER@EXAMPLE.COM  ')).toBe('user@example.com');
    });

    it('should remove dangerous characters', () => {
      expect(sanitizeEmail('user<script>@example.com')).toBe('user@exampl.com');
    });

    it('should limit length', () => {
      const longEmail = 'a'.repeat(300) + '@example.com';
      expect(sanitizeEmail(longEmail)).toHaveLength(254);
    });
  });

  describe('sanitizeNumeric', () => {
    it('should allow valid numbers', () => {
      expect(sanitizeNumeric('123.45')).toBe('123.45');
      expect(sanitizeNumeric('-123.45')).toBe('-123.45');
    });

    it('should remove invalid characters', () => {
      expect(sanitizeNumeric('123abc.45def')).toBe('123.45');
    });

    it('should handle multiple decimal points', () => {
      expect(sanitizeNumeric('123.45.67')).toBe('123.45');
    });

    it('should convert numbers to strings', () => {
      expect(sanitizeNumeric(123.45)).toBe('123.45');
    });
  });

  describe('sanitizeWalletAddress', () => {
    it('should clean wallet addresses', () => {
      expect(sanitizeWalletAddress('0x1234567890abcdef')).toBe('0x1234567890abcdef');
    });

    it('should add 0x prefix if missing', () => {
      expect(sanitizeWalletAddress('1234567890abcdef')).toBe('0x1234567890abcdef');
    });

    it('should limit length', () => {
      const longAddress = '0x' + 'a'.repeat(50);
      expect(sanitizeWalletAddress(longAddress)).toHaveLength(42);
    });
  });

  describe('sanitizeUsername', () => {
    it('should remove spaces and dangerous characters', () => {
      expect(sanitizeUsername('user name<script>')).toBe('username');
    });

    it('should limit length', () => {
      const longUsername = 'a'.repeat(100);
      expect(sanitizeUsername(longUsername)).toHaveLength(50);
    });
  });

  describe('sanitizeSearchQuery', () => {
    it('should remove dangerous characters', () => {
      expect(sanitizeSearchQuery('search<script>')).toBe('search');
    });

    it('should limit length', () => {
      const longQuery = 'a'.repeat(300);
      expect(sanitizeSearchQuery(longQuery)).toHaveLength(200);
    });
  });

  describe('sanitizeFileName', () => {
    it('should remove path separators and dangerous characters', () => {
      expect(sanitizeFileName('../../../etc/passwd')).toBe('etcpasswd');
    });

    it('should prevent directory traversal', () => {
      expect(sanitizeFileName('file..txt')).toBe('file.txt');
    });
  });

  describe('sanitizeHtml', () => {
    it('should escape HTML entities', () => {
      expect(sanitizeHtml('<script>alert("xss")</script>')).toBe('<script>alert("xss")</script>');
    });

    it('should handle null input', () => {
      expect(sanitizeHtml(null as any)).toBe('');
    });
  });

  describe('containsSuspiciousPatterns', () => {
    it('should detect script tags', () => {
      expect(containsSuspiciousPatterns('<script>alert("xss")</script>')).toBe(true);
    });

    it('should detect javascript URLs', () => {
      expect(containsSuspiciousPatterns('javascript:alert("xss")')).toBe(true);
    });

    it('should detect event handlers', () => {
      expect(containsSuspiciousPatterns('<img onload="alert(\'xss\')">')).toBe(true);
    });

    it('should return false for safe input', () => {
      expect(containsSuspiciousPatterns('hello world')).toBe(false);
    });
  });

  describe('sanitizeFormInput', () => {
    it('should sanitize based on type', () => {
      expect(sanitizeFormInput('user@example.com', 'email')).toBe('user@example.com');
      expect(sanitizeFormInput('123.45', 'number')).toBe('123.45');
      expect(sanitizeFormInput('0x123abc', 'wallet')).toBe('0x123abc');
    });

    it('should throw on suspicious patterns', () => {
      expect(() => sanitizeFormInput('<script>alert("xss")</script>', 'text')).toThrow();
    });

    it('should handle null/undefined', () => {
      expect(sanitizeFormInput(null, 'text')).toBe('');
      expect(sanitizeFormInput(undefined, 'text')).toBe('');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize object properties', () => {
      const obj = {
        email: 'USER@EXAMPLE.COM',
        name: 'John Doe<script>',
        age: '25',
      };

      const schema = {
        email: 'email' as const,
        name: 'text' as const,
        age: 'number' as const,
      };

      const result = sanitizeObject(obj, schema);
      expect(result.email).toBe('user@example.com');
      expect(result.name).toBe('John Doe');
      expect(result.age).toBe('25');
    });

    it('should handle arrays', () => {
      const arr = ['item1<script>', 'item2'];
      const result = sanitizeObject(arr);
      expect(result[0]).toBe('item1');
      expect(result[1]).toBe('item2');
    });

    it('should handle nested objects', () => {
      const obj = {
        user: {
          email: 'USER@EXAMPLE.COM',
          name: 'John<script>',
        },
      };

      const result = sanitizeObject(obj);
      expect(result.user.email).toBe('user@example.com');
      expect(result.user.name).toBe('John');
    });
  });
});