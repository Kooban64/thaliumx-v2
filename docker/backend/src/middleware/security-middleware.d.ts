/**
 * Security Middleware
 *
 * Advanced security middleware for input sanitization and attack prevention.
 *
 * Features:
 * - SQL injection detection and prevention
 * - XSS (Cross-Site Scripting) prevention using DOMPurify
 * - Input sanitization
 * - HTML/script tag removal
 * - Command injection detection
 * - Path traversal detection
 *
 * Sanitization:
 * - HTML sanitization using DOMPurify
 * - Script tag removal
 * - Event handler removal
 * - URL sanitization
 *
 * Detection:
 * - SQL injection patterns
 * - XSS patterns
 * - Command injection patterns
 * - Path traversal patterns
 *
 * Security:
 * - Automatic request blocking on threats
 * - Comprehensive logging
 * - Error responses with security codes
 * - Integration with threat detection
 */
import { Request, Response, NextFunction } from 'express';
export declare class SecurityMiddleware {
    private static readonly SQL_INJECTION_PATTERNS;
    static sanitizeInput(req: Request, res: Response, next: NextFunction): void;
    static detectSQLInjection(req: Request, res: Response, next: NextFunction): void;
    static detectXSS(req: Request, res: Response, next: NextFunction): void;
    static contentSecurityPolicy(req: Request, res: Response, next: NextFunction): void;
    static limitRequestSize(maxSize?: string): (req: Request, res: Response, next: NextFunction) => void;
    static secureFileUpload(allowedTypes?: string[], maxFileSize?: number): (req: Request, res: Response, next: NextFunction) => void;
    static sensitiveOperationRateLimit(windowMs?: number, maxRequests?: number): (req: Request, res: Response, next: NextFunction) => void;
    private static sanitizeObject;
    private static scanForSQLInjection;
    private static scanForXSS;
    private static extractInputs;
    private static flattenObject;
    private static parseSize;
}
//# sourceMappingURL=security-middleware.d.ts.map