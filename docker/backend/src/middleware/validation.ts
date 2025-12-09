import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../services/logger';
import { createError } from '../utils';

/**
 * Input validation and sanitization middleware
 * Based on thaliumx shared input-validator patterns
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Sanitize query parameters
    if (req.query) {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          req.query[key] = sanitizeInput(value);
        }
      }
    }

    // Sanitize body parameters
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Check for SQL injection patterns
    if (detectSQLInjection(req)) {
      const ip = getClientIP(req);
      
      LoggerService.logSecurity('sql_injection_attempt', {
        ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        body: req.body,
        query: req.query,
      });

      res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Request contains potentially malicious content',
        code: 'SECURITY_VIOLATION',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'security_violation'
      });
      return;
    }

    // Check for XSS patterns
    if (detectXSS(req)) {
      const ip = getClientIP(req);
      
      LoggerService.logSecurity('xss_attempt', {
        ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        body: req.body,
        query: req.query,
      });

      res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Request contains potentially malicious content',
        code: 'SECURITY_VIOLATION',
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || 'security_violation'
      });
      return;
    }

    next();
  } catch (error: any) {
    LoggerService.error('Validation middleware error:', error);
    next(error);
  }
};

/**
 * Sanitize input string
 */
import * as DOMPurifyModule from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const DOMPurify = (DOMPurifyModule as any).default || DOMPurifyModule;
const DOMPurifyInstance = DOMPurify(window as any);

function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return input;
  
  return DOMPurifyInstance.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
    .trim()
    .substring(0, 1000); // Limit length
}
/**
 * Sanitize object recursively
 */
function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return typeof obj === 'string' ? sanitizeInput(obj) : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeObject(value);
  }
  return sanitized;
}

/**
 * Detect SQL injection patterns
 */
function detectSQLInjection(req: Request): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(\b(OR|AND)\s+['"]\s*=\s*['"])/i,
    /(UNION\s+SELECT)/i,
    /(DROP\s+TABLE)/i,
    /(INSERT\s+INTO)/i,
    /(DELETE\s+FROM)/i,
    /(UPDATE\s+.*\s+SET)/i,
    /(CREATE\s+TABLE)/i,
    /(ALTER\s+TABLE)/i,
    /(EXEC\s*\()/i,
    /(SCRIPT\s*\()/i,
    /(WAITFOR\s+DELAY)/i,
    /(BULK\s+INSERT)/i,
    /(SHUTDOWN)/i,
    /(XP_)/i,
    /(SP_)/i
  ];

  const checkString = (str: string): boolean => {
    return sqlPatterns.some(pattern => pattern.test(str));
  };

  // Check query parameters
  if (req.query) {
    for (const value of Object.values(req.query)) {
      if (typeof value === 'string' && checkString(value)) {
        return true;
      }
    }
  }

  // Check body parameters
  if (req.body) {
    const bodyStr = JSON.stringify(req.body);
    if (checkString(bodyStr)) {
      return true;
    }
  }

  // Check URL path
  if (checkString(req.path)) {
    return true;
  }

  return false;
}

/**
 * Detect XSS patterns
 */
function detectXSS(req: Request): boolean {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /<object[^>]*>.*?<\/object>/gi,
    /<embed[^>]*>.*?<\/embed>/gi,
    /<link[^>]*>.*?<\/link>/gi,
    /<meta[^>]*>.*?<\/meta>/gi,
    /<style[^>]*>.*?<\/style>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /onmouseover\s*=/gi,
    /onfocus\s*=/gi,
    /onblur\s*=/gi,
    /onchange\s*=/gi,
    /onsubmit\s*=/gi,
    /onreset\s*=/gi,
    /onselect\s*=/gi,
    /onkeydown\s*=/gi,
    /onkeyup\s*=/gi,
    /onkeypress\s*=/gi,
    /onmousedown\s*=/gi,
    /onmouseup\s*=/gi,
    /onmousemove\s*=/gi,
    /onmouseout\s*=/gi,
    /onmouseenter\s*=/gi,
    /onmouseleave\s*=/gi,
    /oncontextmenu\s*=/gi,
    /ondblclick\s*=/gi,
    /onabort\s*=/gi,
    /onbeforeunload\s*=/gi,
    /onerror\s*=/gi,
    /onhashchange\s*=/gi,
    /onload\s*=/gi,
    /onmessage\s*=/gi,
    /onoffline\s*=/gi,
    /ononline\s*=/gi,
    /onpagehide\s*=/gi,
    /onpageshow\s*=/gi,
    /onpopstate\s*=/gi,
    /onresize\s*=/gi,
    /onstorage\s*=/gi,
    /onunload\s*=/gi
  ];

  const checkString = (str: string): boolean => {
    return xssPatterns.some(pattern => pattern.test(str));
  };

  // Check query parameters
  if (req.query) {
    for (const value of Object.values(req.query)) {
      if (typeof value === 'string' && checkString(value)) {
        return true;
      }
    }
  }

  // Check body parameters
  if (req.body) {
    const bodyStr = JSON.stringify(req.body);
    if (checkString(bodyStr)) {
      return true;
    }
  }

  // Check URL path
  if (checkString(req.path)) {
    return true;
  }

  return false;
}

/**
 * Get client IP address
 */
function getClientIP(req: Request): string {
  return req.ip || 
         (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
         (req.headers['x-real-ip'] as string) || 
         req.connection.remoteAddress || 
         'unknown';
}

/**
 * Create validation middleware for specific schemas
 */
export function createValidationMiddleware(schema: any, options: { sanitize?: boolean } = {}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const dataToValidate = {
        ...req.body,
        ...req.query,
        ...req.params
      };

      // Basic validation - can be extended with Joi or similar
      const result = validateData(dataToValidate, schema, options.sanitize !== false);

      if (!result.isValid) {
        LoggerService.warn('Input validation failed', {
          errors: result.errors,
          ip: getClientIP(req),
          path: req.path,
          method: req.method
        });

        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Input validation failed',
          details: result.errors,
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] || 'validation_error'
        });
        return;
      }

      // Attach sanitized data to request
      if (result.sanitizedData) {
        (req as any).validatedData = result.sanitizedData;
      }

      next();
    } catch (error: any) {
      LoggerService.error('Validation middleware error:', error);
      next(error);
    }
  };
}

/**
 * Basic data validation function
 */
interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'email' | 'boolean';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
}

interface ValidationSchema {
  [key: string]: ValidationRule;
}

function validateData(data: any, schema: ValidationSchema, sanitize: boolean = true): { isValid: boolean; errors: any[]; sanitizedData?: any } {
  const errors: any[] = [];
  let sanitizedData = data;

  // Basic validation logic - can be extended
  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field,
        message: `${field} is required`
      });
    }

    if (value !== undefined && rules.type) {
      if (rules.type === 'string' && typeof value !== 'string') {
        errors.push({
          field,
          message: `${field} must be a string`
        });
      } else if (rules.type === 'number' && typeof value !== 'number') {
        errors.push({
          field,
          message: `${field} must be a number`
        });
      } else if (rules.type === 'email' && !/\S+@\S+\.\S+/.test(value)) {
        errors.push({
          field,
          message: `${field} must be a valid email`
        });
      } else if (rules.type === 'boolean' && typeof value !== 'boolean') {
        errors.push({
          field,
          message: `${field} must be a boolean`
        });
      }
    }

    if (value !== undefined && rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
      errors.push({
        field,
        message: `${field} must be at least ${rules.minLength} characters`
      });
    }

    if (value !== undefined && rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
      errors.push({
        field,
        message: `${field} must be no more than ${rules.maxLength} characters`
      });
    }

    if (value !== undefined && rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
      errors.push({
        field,
        message: `${field} format is invalid`
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: sanitize ? sanitizedData : undefined
  };
}
