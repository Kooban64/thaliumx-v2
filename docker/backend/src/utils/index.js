"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAppError = exports.createError = exports.AppError = exports.deepMerge = exports.omit = exports.pick = exports.sortBy = exports.groupBy = exports.unique = exports.snakeCase = exports.kebabCase = exports.camelCase = exports.capitalize = exports.isExpired = exports.addHours = exports.addDays = exports.formatDate = exports.isSuperAdmin = exports.isAdmin = exports.hasAnyRole = exports.hasRole = exports.hasPermission = exports.sanitizeInput = exports.isValidPassword = exports.isValidPhone = exports.isValidEmail = exports.generateReferenceId = exports.generateShortId = exports.generateId = exports.verifyToken = exports.generateRefreshToken = exports.generateAccessToken = exports.generateRandomPassword = exports.comparePassword = exports.hashPassword = void 0;
const bcrypt = __importStar(require("bcryptjs"));
const jwt = __importStar(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const types_1 = require("../types");
// =============================================================================
// PASSWORD UTILITIES
// =============================================================================
const hashPassword = async (password) => {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
};
exports.hashPassword = hashPassword;
const comparePassword = async (password, hash) => {
    return bcrypt.compare(password, hash);
};
exports.comparePassword = comparePassword;
const generateRandomPassword = (length = 16) => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
};
exports.generateRandomPassword = generateRandomPassword;
// =============================================================================
// JWT UTILITIES
// =============================================================================
const generateAccessToken = (payload) => {
    const secret = process.env.JWT_SECRET || '';
    const expiresIn = process.env.JWT_EXPIRES_IN || '15m';
    return jwt.sign(payload, secret, {
        expiresIn,
        issuer: process.env.JWT_ISSUER || 'thaliumx',
        audience: process.env.JWT_AUDIENCE || 'thaliumx-users'
    });
};
exports.generateAccessToken = generateAccessToken;
const generateRefreshToken = (payload) => {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || '';
    const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    return jwt.sign(payload, secret, {
        expiresIn,
        issuer: process.env.JWT_ISSUER || 'thaliumx',
        audience: process.env.JWT_AUDIENCE || 'thaliumx-users'
    });
};
exports.generateRefreshToken = generateRefreshToken;
const verifyToken = (token, isRefreshToken = false) => {
    const secret = isRefreshToken ? (process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || '') : (process.env.JWT_SECRET || '');
    return jwt.verify(token, secret, {
        issuer: process.env.JWT_ISSUER || 'thaliumx',
        audience: process.env.JWT_AUDIENCE || 'thaliumx-users'
    });
};
exports.verifyToken = verifyToken;
// =============================================================================
// ID UTILITIES
// =============================================================================
const generateId = () => {
    return (0, uuid_1.v4)();
};
exports.generateId = generateId;
const generateShortId = (length = 8) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};
exports.generateShortId = generateShortId;
const generateReferenceId = (prefix = 'REF') => {
    const timestamp = Date.now().toString(36);
    const random = (0, exports.generateShortId)(6);
    return `${prefix}-${timestamp}-${random}`.toUpperCase();
};
exports.generateReferenceId = generateReferenceId;
// =============================================================================
// VALIDATION UTILITIES
// =============================================================================
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
exports.isValidEmail = isValidEmail;
const isValidPhone = (phone) => {
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
};
exports.isValidPhone = isValidPhone;
const isValidPassword = (password) => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
};
exports.isValidPassword = isValidPassword;
const sanitizeInput = (input) => {
    return input.trim().replace(/[<>]/g, '');
};
exports.sanitizeInput = sanitizeInput;
// =============================================================================
// PERMISSION UTILITIES
// =============================================================================
const hasPermission = (user, resource, action) => {
    return user.permissions.some(permission => permission.resource === resource && permission.action === action);
};
exports.hasPermission = hasPermission;
const hasRole = (user, role) => {
    return user.role === role;
};
exports.hasRole = hasRole;
const hasAnyRole = (user, roles) => {
    return roles.includes(user.role);
};
exports.hasAnyRole = hasAnyRole;
const isAdmin = (user) => {
    return (0, exports.hasAnyRole)(user, [types_1.UserRole.ADMIN, types_1.UserRole.SUPER_ADMIN]);
};
exports.isAdmin = isAdmin;
const isSuperAdmin = (user) => {
    return user.role === types_1.UserRole.SUPER_ADMIN;
};
exports.isSuperAdmin = isSuperAdmin;
// =============================================================================
// DATE UTILITIES
// =============================================================================
const formatDate = (date, format = 'YYYY-MM-DD') => {
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
exports.formatDate = formatDate;
const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};
exports.addDays = addDays;
const addHours = (date, hours) => {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
};
exports.addHours = addHours;
const isExpired = (date) => {
    return date < new Date();
};
exports.isExpired = isExpired;
// =============================================================================
// STRING UTILITIES
// =============================================================================
const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};
exports.capitalize = capitalize;
const camelCase = (str) => {
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
    }).replace(/\s+/g, '');
};
exports.camelCase = camelCase;
const kebabCase = (str) => {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
};
exports.kebabCase = kebabCase;
const snakeCase = (str) => {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
};
exports.snakeCase = snakeCase;
// =============================================================================
// ARRAY UTILITIES
// =============================================================================
const unique = (array) => {
    return Array.from(new Set(array));
};
exports.unique = unique;
const groupBy = (array, key) => {
    return array.reduce((groups, item) => {
        const group = String(item[key]);
        groups[group] = groups[group] || [];
        groups[group].push(item);
        return groups;
    }, {});
};
exports.groupBy = groupBy;
const sortBy = (array, key, direction = 'asc') => {
    return [...array].sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];
        if (aVal < bVal)
            return direction === 'asc' ? -1 : 1;
        if (aVal > bVal)
            return direction === 'asc' ? 1 : -1;
        return 0;
    });
};
exports.sortBy = sortBy;
// =============================================================================
// OBJECT UTILITIES
// =============================================================================
const pick = (obj, keys) => {
    const result = {};
    keys.forEach(key => {
        if (key in obj) {
            result[key] = obj[key];
        }
    });
    return result;
};
exports.pick = pick;
const omit = (obj, keys) => {
    const result = { ...obj };
    keys.forEach(key => {
        delete result[key];
    });
    return result;
};
exports.omit = omit;
const deepMerge = (target, source) => {
    const result = { ...target };
    for (const key in source) {
        if (source[key] !== undefined) {
            if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
                result[key] = (0, exports.deepMerge)(result[key], source[key]);
            }
            else {
                result[key] = source[key];
            }
        }
    }
    return result;
};
exports.deepMerge = deepMerge;
// =============================================================================
// ERROR UTILITIES
// =============================================================================
class AppError extends Error {
    statusCode;
    isOperational;
    code;
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
const createError = (message, statusCode = 500, code = 'INTERNAL_ERROR') => {
    return new AppError(message, statusCode, code);
};
exports.createError = createError;
const isAppError = (error) => {
    return error instanceof AppError;
};
exports.isAppError = isAppError;
//# sourceMappingURL=index.js.map