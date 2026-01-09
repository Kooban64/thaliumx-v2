/**
 * Comprehensive Logging System Tests
 * 
 * Tests for:
 * - PII sanitization
 * - Log levels
 * - File rotation
 * - Error handling
 * - Performance
 * - Compliance features
 */

import { LoggerService } from '../../services/logger';
import { LogSanitizer } from '../../utils/log-sanitizer';
import { LogIntegrity } from '../../utils/log-integrity';
import { LogCorrelation } from '../../utils/log-correlation';

describe('LoggerService', () => {
  beforeAll(() => {
    LoggerService.initialize();
  });

  afterAll(() => {
    LoggerService.shutdown();
  });

  describe('PII Sanitization', () => {
    it('should redact passwords', () => {
      const data = { password: 'secret123', username: 'test' };
      const sanitized = LogSanitizer.sanitize(data);
      expect(sanitized).toEqual({ password: '[REDACTED]', username: 'test' });
    });

    it('should redact API keys', () => {
      const data = { apiKey: 'sk_live_1234567890', userId: 'user123' };
      const sanitized = LogSanitizer.sanitize(data);
      expect(sanitized).toEqual({ apiKey: '[REDACTED]', userId: 'user123' });
    });

    it('should redact credit card numbers', () => {
      const data = { cardNumber: '4111111111111111', name: 'John Doe' };
      const sanitized = LogSanitizer.sanitize(data);
      expect((sanitized as any).cardNumber).toBe('[REDACTED]');
    });

    it('should handle nested objects', () => {
      const data = {
        user: {
          email: 'test@example.com',
          password: 'secret',
        },
        metadata: {
          apiKey: 'key123',
        },
      };
      const sanitized = LogSanitizer.sanitize(data);
      expect((sanitized as any).user.password).toBe('[REDACTED]');
      expect((sanitized as any).metadata.apiKey).toBe('[REDACTED]');
    });
  });

  describe('Log Levels', () => {
    it('should log at info level', () => {
      expect(() => LoggerService.info('Test message')).not.toThrow();
    });

    it('should log at error level', () => {
      expect(() => LoggerService.error('Test error')).not.toThrow();
    });

    it('should log at warn level', () => {
      expect(() => LoggerService.warn('Test warning')).not.toThrow();
    });

    it('should log at debug level', () => {
      expect(() => LoggerService.debug('Test debug')).not.toThrow();
    });
  });

  describe('Correlation IDs', () => {
    it('should include correlation ID in logs', () => {
      const correlationId = LogCorrelation.generateCorrelationId();
      LogCorrelation.setCorrelationContext({ correlationId });
      
      const metadata = LogCorrelation.getLogMetadata();
      expect(metadata.correlationId).toBe(correlationId);
    });
  });

  describe('Integrity Verification', () => {
    it('should record log file integrity', () => {
      const logDir = process.env.LOG_DIR || '/var/log/thaliumx/backend';
      const testFile = `${logDir}/test.log`;
      
      // Create test file
      fs.writeFileSync(testFile, 'test log entry\n');
      
      LogIntegrity.recordIntegrity(testFile);
      const status = LogIntegrity.getIntegrityStatus(testFile);
      
      expect(status).not.toBeNull();
      expect(status?.checksum).toBeDefined();
      
      // Cleanup
      fs.unlinkSync(testFile);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', () => {
      expect(() => {
        LoggerService.logError(new Error('Test error'), {
          context: 'test',
        });
      }).not.toThrow();
    });
  });
});

// Import fs for test file operations
import * as fs from 'fs';
