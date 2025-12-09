/**
 * Authentication Validation Middleware
 *
 * Express validation middleware for authentication endpoints.
 *
 * Validators:
 * - validateLogin - Validates email and password
 * - validateRegister - Validates registration data
 * - validateRefreshToken - Validates refresh token
 * - validateChangePassword - Validates password change request
 * - validateResetPassword - Validates password reset request
 * - validateConfirmResetPassword - Validates password reset confirmation
 *
 * Validation Rules:
 * - Email format validation
 * - Password strength requirements
 * - Required field checks
 * - Token format validation
 *
 * Error Handling:
 * - Returns 400 with detailed error messages
 * - Includes request ID for tracing
 */
import { Request, Response, NextFunction } from 'express';
export declare const validateLogin: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateRegister: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateRefreshToken: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateChangePassword: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateResetPassword: (req: Request, res: Response, next: NextFunction) => void;
export declare const validateConfirmResetPassword: (req: Request, res: Response, next: NextFunction) => void;
export declare const login: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const register: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const refreshToken: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const logout: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const changePassword: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const requestPasswordReset: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const confirmPasswordReset: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const enableMFA: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const verifyMFA: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const disableMFA: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getProfile: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const updateProfile: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map