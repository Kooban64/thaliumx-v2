/**
 * Error Handler Utilities
 *
 * Standardized error handling with error codes, error classes, and error factories.
 *
 * Features:
 * - ErrorCode enum: Comprehensive error code enumeration
 * - AppError class: Application error with status codes and details
 * - ErrorHandler class: Error handling and formatting utilities
 * - createError function: Factory function for creating errors
 *
 * Error Categories:
 * - Authentication errors (INVALID_CREDENTIALS, TOKEN_EXPIRED, etc.)
 * - Validation errors (VALIDATION_ERROR, REQUIRED_FIELD_MISSING, etc.)
 * - Business logic errors (INSUFFICIENT_BALANCE, ORDER_NOT_FOUND, etc.)
 * - Financial errors (LIQUIDATION_TRIGGERED, MARGIN_CALL, etc.)
 * - Compliance errors (KYC_REQUIRED, AML_FLAG, SANCTIONS_HIT, etc.)
 * - System errors (DATABASE_ERROR, REDIS_ERROR, etc.)
 *
 * AppError Static Methods:
 * - badRequest, unauthorized, forbidden, notFound
 * - conflict, unprocessableEntity, tooManyRequests
 * - internal, serviceUnavailable
 * - Financial: insufficientBalance, insufficientMargin, liquidationTriggered, marginCall
 * - Compliance: kycRequired, sanctionsHit, amlFlag
 *
 * Usage:
 * - Used throughout application for consistent error handling
 * - Integrates with global error handler middleware
 * - Provides structured error responses
 */
export declare enum ErrorCode {
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
    TOKEN_EXPIRED = "TOKEN_EXPIRED",
    TOKEN_INVALID = "TOKEN_INVALID",
    INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
    MFA_REQUIRED = "MFA_REQUIRED",
    MFA_INVALID = "MFA_INVALID",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    REQUIRED_FIELD_MISSING = "REQUIRED_FIELD_MISSING",
    INVALID_FORMAT = "INVALID_FORMAT",
    VALUE_OUT_OF_RANGE = "VALUE_OUT_OF_RANGE",
    INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
    INSUFFICIENT_MARGIN = "INSUFFICIENT_MARGIN",
    POSITION_NOT_FOUND = "POSITION_NOT_FOUND",
    ORDER_NOT_FOUND = "ORDER_NOT_FOUND",
    DUPLICATE_TRANSACTION = "DUPLICATE_TRANSACTION",
    LIQUIDATION_TRIGGERED = "LIQUIDATION_TRIGGERED",
    MARGIN_CALL = "MARGIN_CALL",
    RISK_LIMIT_EXCEEDED = "RISK_LIMIT_EXCEEDED",
    KYC_REQUIRED = "KYC_REQUIRED",
    AML_FLAG = "AML_FLAG",
    SANCTIONS_HIT = "SANCTIONS_HIT",
    COMPLIANCE_VIOLATION = "COMPLIANCE_VIOLATION",
    DATABASE_ERROR = "DATABASE_ERROR",
    REDIS_ERROR = "REDIS_ERROR",
    EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
    INTERNAL_ERROR = "INTERNAL_ERROR",
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
    NOT_FOUND = "NOT_FOUND",
    BAD_REQUEST = "BAD_REQUEST"
}
export interface ThaliumXError extends Error {
    code: ErrorCode;
    statusCode: number;
    details?: any;
    isOperational: boolean;
}
export declare class AppError extends Error implements ThaliumXError {
    readonly code: ErrorCode;
    readonly statusCode: number;
    readonly details?: any;
    readonly isOperational: boolean;
    constructor(code: ErrorCode, message: string, statusCode?: number, details?: any, isOperational?: boolean);
    static badRequest(message: string, details?: any): AppError;
    static unauthorized(message?: string): AppError;
    static forbidden(message?: string): AppError;
    static notFound(message?: string): AppError;
    static conflict(message: string, details?: any): AppError;
    static unprocessableEntity(message: string, details?: any): AppError;
    static tooManyRequests(message?: string): AppError;
    static internal(message?: string, details?: any): AppError;
    static serviceUnavailable(message?: string): AppError;
    static insufficientBalance(amount: number, available: number): AppError;
    static insufficientMargin(required: number, available: number): AppError;
    static liquidationTriggered(positionId: string, loss: number): AppError;
    static marginCall(positionId: string, marginRatio: number): AppError;
    static kycRequired(userId: string): AppError;
    static sanctionsHit(entity: string, sanctionsList: string): AppError;
    static amlFlag(transactionId: string, riskScore: number): AppError;
}
export declare class ErrorHandler {
    static handleError(error: Error | AppError, context?: any): AppError;
    static formatErrorResponse(error: AppError): any;
    static isOperationalError(error: Error): boolean;
    static logError(error: Error | AppError, context?: any): void;
}
export declare function createError(code: ErrorCode, message: string, statusCode?: number, details?: any): AppError;
//# sourceMappingURL=error-handler.d.ts.map