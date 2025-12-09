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

import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { JWTPayload, User, UserRole } from '../types';

// =============================================================================
// PASSWORD UTILITIES
// =============================================================================

export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateRandomPassword = (length: number = 16): string => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

// =============================================================================
// JWT UTILITIES
// =============================================================================

export const generateAccessToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  const secret = process.env.JWT_SECRET || '';
  const expiresIn = process.env.JWT_EXPIRES_IN || '15m';
  return jwt.sign(payload, secret, { 
    expiresIn,
    issuer: process.env.JWT_ISSUER || 'thaliumx',
    audience: process.env.JWT_AUDIENCE || 'thaliumx-users'
  } as jwt.SignOptions);
};

export const generateRefreshToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || '';
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  return jwt.sign(payload, secret, { 
    expiresIn,
    issuer: process.env.JWT_ISSUER || 'thaliumx',
    audience: process.env.JWT_AUDIENCE || 'thaliumx-users'
  } as jwt.SignOptions);
};

export const verifyToken = (token: string, isRefreshToken: boolean = false): JWTPayload => {
  const secret = isRefreshToken ? (process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || '') : (process.env.JWT_SECRET || '');
  return jwt.verify(token, secret, {
    issuer: process.env.JWT_ISSUER || 'thaliumx',
    audience: process.env.JWT_AUDIENCE || 'thaliumx-users'
  }) as JWTPayload;
};

// =============================================================================
// ID UTILITIES
// =============================================================================

export const generateId = (): string => {
  return uuidv4();
};

export const generateShortId = (length: number = 8): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const generateReferenceId = (prefix: string = 'REF'): string => {
  const timestamp = Date.now().toString(36);
  const random = generateShortId(6);
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
};

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
};

export const isValidPassword = (password: string): boolean => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

// =============================================================================
// PERMISSION UTILITIES
// =============================================================================

export const hasPermission = (user: User, resource: string, action: string): boolean => {
  return user.permissions.some(permission => 
    permission.resource === resource && permission.action === action
  );
};

export const hasRole = (user: User, role: UserRole): boolean => {
  return user.role === role;
};

export const hasAnyRole = (user: User, roles: UserRole[]): boolean => {
  return roles.includes(user.role);
};

export const isAdmin = (user: User): boolean => {
  return hasAnyRole(user, [UserRole.ADMIN, UserRole.SUPER_ADMIN]);
};

export const isSuperAdmin = (user: User): boolean => {
  return user.role === UserRole.SUPER_ADMIN;
};

// =============================================================================
// DATE UTILITIES
// =============================================================================

export const formatDate = (date: Date, format: string = 'YYYY-MM-DD'): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return format
    .replace('YYYY', year.toString())
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const addHours = (date: Date, hours: number): Date => {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
};

export const isExpired = (date: Date): boolean => {
  return date < new Date();
};

// =============================================================================
// STRING UTILITIES
// =============================================================================

export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const camelCase = (str: string): string => {
  return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
    return index === 0 ? word.toLowerCase() : word.toUpperCase();
  }).replace(/\s+/g, '');
};

export const kebabCase = (str: string): string => {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
};

export const snakeCase = (str: string): string => {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
};

// =============================================================================
// ARRAY UTILITIES
// =============================================================================

export const unique = <T>(array: T[]): T[] => {
  return Array.from(new Set(array));
};

export const groupBy = <T, K extends keyof T>(array: T[], key: K): Record<string, T[]> => {
  return array.reduce((groups, item) => {
    const group = String(item[key]);
    groups[group] = groups[group] || [];
    groups[group].push(item);
    return groups;
  }, {} as Record<string, T[]>);
};

export const sortBy = <T>(array: T[], key: keyof T, direction: 'asc' | 'desc' = 'asc'): T[] => {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
};

// =============================================================================
// OBJECT UTILITIES
// =============================================================================

export const pick = <T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> => {
  const result = {} as Pick<T, K>;
  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
};

export const omit = <T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> => {
  const result = { ...obj };
  keys.forEach(key => {
    delete result[key];
  });
  return result;
};

export const deepMerge = <T extends Record<string, any>>(target: T, source: Partial<T>): T => {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] !== undefined) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        result[key] = deepMerge(result[key] as any, source[key] as any);
      } else {
        result[key] = source[key] as T[Extract<keyof T, string>];
      }
    }
  }
  
  return result;
};

// =============================================================================
// ERROR UTILITIES
// =============================================================================

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export const createError = (message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR'): AppError => {
  return new AppError(message, statusCode, code);
};

export const isAppError = (error: any): error is AppError => {
  return error instanceof AppError;
};
