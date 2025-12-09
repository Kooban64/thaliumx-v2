/**
 * Utility Functions
 *
 * Common utility functions for password hashing, JWT operations, and general helpers.
 *
 * Features:
 * - Password hashing and comparison (bcrypt)
 * - Random password generation
 * - JWT token generation and validation
 * - Permission checking utilities
 * - General helper functions
 *
 * Security:
 * - Passwords hashed with bcrypt (12 rounds)
 * - Secure random password generation
 * - JWT token validation
 *
 * Usage:
 * - Imported throughout the application
 * - Provides consistent utility functions
 * - Used by services and middleware
 */
import { JWTPayload, User, UserRole } from '../types';
export declare const hashPassword: (password: string) => Promise<string>;
export declare const comparePassword: (password: string, hash: string) => Promise<boolean>;
export declare const generateRandomPassword: (length?: number) => string;
export declare const generateAccessToken: (payload: Omit<JWTPayload, "iat" | "exp">) => string;
export declare const generateRefreshToken: (payload: Omit<JWTPayload, "iat" | "exp">) => string;
export declare const verifyToken: (token: string, isRefreshToken?: boolean) => JWTPayload;
export declare const generateId: () => string;
export declare const generateShortId: (length?: number) => string;
export declare const generateReferenceId: (prefix?: string) => string;
export declare const isValidEmail: (email: string) => boolean;
export declare const isValidPhone: (phone: string) => boolean;
export declare const isValidPassword: (password: string) => boolean;
export declare const sanitizeInput: (input: string) => string;
export declare const hasPermission: (user: User, resource: string, action: string) => boolean;
export declare const hasRole: (user: User, role: UserRole) => boolean;
export declare const hasAnyRole: (user: User, roles: UserRole[]) => boolean;
export declare const isAdmin: (user: User) => boolean;
export declare const isSuperAdmin: (user: User) => boolean;
export declare const formatDate: (date: Date, format?: string) => string;
export declare const addDays: (date: Date, days: number) => Date;
export declare const addHours: (date: Date, hours: number) => Date;
export declare const isExpired: (date: Date) => boolean;
export declare const capitalize: (str: string) => string;
export declare const camelCase: (str: string) => string;
export declare const kebabCase: (str: string) => string;
export declare const snakeCase: (str: string) => string;
export declare const unique: <T>(array: T[]) => T[];
export declare const groupBy: <T, K extends keyof T>(array: T[], key: K) => Record<string, T[]>;
export declare const sortBy: <T>(array: T[], key: keyof T, direction?: "asc" | "desc") => T[];
export declare const pick: <T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]) => Pick<T, K>;
export declare const omit: <T, K extends keyof T>(obj: T, keys: K[]) => Omit<T, K>;
export declare const deepMerge: <T extends Record<string, any>>(target: T, source: Partial<T>) => T;
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly isOperational: boolean;
    readonly code: string;
    constructor(message: string, statusCode?: number, code?: string);
}
export declare const createError: (message: string, statusCode?: number, code?: string) => AppError;
export declare const isAppError: (error: any) => error is AppError;
//# sourceMappingURL=index.d.ts.map