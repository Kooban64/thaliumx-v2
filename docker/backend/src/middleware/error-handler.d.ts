/**
 * Error Handler Middleware
 *
 * Comprehensive error handling, authentication, and validation middleware.
 *
 * Features:
 * - Global error handler for all Express errors
 * - JWT token authentication middleware
 * - Role-based access control (RBAC)
 * - Permission-based access control
 * - Input validation and sanitization
 * - Rate limiting (general and financial)
 * - Security headers
 * - SQL injection protection
 * - XSS protection
 * - Request size limiting
 *
 * Authentication:
 * - authenticateToken - Validates JWT tokens
 * - requireRole - Enforces role requirements
 * - requirePermission - Enforces permission requirements
 *
 * Security:
 * - Input sanitization
 * - SQL injection detection
 * - XSS prevention
 * - Security headers (helmet)
 * - Rate limiting
 *
 * Error Handling:
 * - Structured error responses
 * - Error logging
 * - Request ID tracking
 * - Stack traces in development only
 */
import { Request, Response, NextFunction } from 'express';
import { JWTPayload } from '../types';
declare global {
    namespace Express {
        interface Request {
            user?: JWTPayload;
        }
    }
}
export declare const globalErrorHandler: (error: Error, req: Request, res: Response, _next: NextFunction) => void;
export declare const notFoundHandler: (req: Request, _res: Response, next: NextFunction) => void;
export declare const requestLogger: (req: Request, res: Response, next: NextFunction) => void;
export declare const rateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const financialRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const authenticateToken: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const requireRole: (roles: string[]) => (req: Request, _res: Response, next: NextFunction) => void;
export declare const requirePermission: (resource: string, action: string) => (req: Request, _res: Response, next: NextFunction) => void;
export declare const requireTenant: (req: Request, _res: Response, next: NextFunction) => void;
import * as Joi from 'joi';
export declare const validateRequest: (schema: Joi.ObjectSchema) => (req: Request, _res: Response, next: NextFunction) => void;
export declare const asyncHandler: (fn: Function) => (req: Request, res: Response, next: NextFunction) => void;
export declare const requestId: (req: Request, res: Response, next: NextFunction) => void;
export declare const securityHeaders: (req: Request, res: Response, next: NextFunction) => void;
export declare const sanitizeInput: (req: Request, res: Response, next: NextFunction) => void;
export declare const sqlInjectionProtection: (req: Request, res: Response, next: NextFunction) => void;
export declare const xssProtection: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateApiKey: (req: Request, _res: Response, next: NextFunction) => void;
export declare const requestSizeLimit: (req: Request, _res: Response, next: NextFunction) => void;
//# sourceMappingURL=error-handler.d.ts.map