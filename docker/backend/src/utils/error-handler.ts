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

import { LoggerService } from '../services/logger';

export enum ErrorCode {
  // Authentication Errors
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  MFA_REQUIRED = 'MFA_REQUIRED',
  MFA_INVALID = 'MFA_INVALID',

  // Validation Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING',
  INVALID_FORMAT = 'INVALID_FORMAT',
  VALUE_OUT_OF_RANGE = 'VALUE_OUT_OF_RANGE',

  // Business Logic Errors
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INSUFFICIENT_MARGIN = 'INSUFFICIENT_MARGIN',
  POSITION_NOT_FOUND = 'POSITION_NOT_FOUND',
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  DUPLICATE_TRANSACTION = 'DUPLICATE_TRANSACTION',

  // Financial Errors
  LIQUIDATION_TRIGGERED = 'LIQUIDATION_TRIGGERED',
  MARGIN_CALL = 'MARGIN_CALL',
  RISK_LIMIT_EXCEEDED = 'RISK_LIMIT_EXCEEDED',

  // Compliance Errors
  KYC_REQUIRED = 'KYC_REQUIRED',
  AML_FLAG = 'AML_FLAG',
  SANCTIONS_HIT = 'SANCTIONS_HIT',
  COMPLIANCE_VIOLATION = 'COMPLIANCE_VIOLATION',

  // System Errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  REDIS_ERROR = 'REDIS_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Generic Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  NOT_FOUND = 'NOT_FOUND',
  BAD_REQUEST = 'BAD_REQUEST'
}

export interface ThaliumXError extends Error {
  code: ErrorCode;
  statusCode: number;
  details?: any;
  isOperational: boolean;
}

export class AppError extends Error implements ThaliumXError {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: any): AppError {
    return new AppError(ErrorCode.BAD_REQUEST, message, 400, details);
  }

  static unauthorized(message: string = 'Unauthorized'): AppError {
    return new AppError(ErrorCode.INVALID_CREDENTIALS, message, 401);
  }

  static forbidden(message: string = 'Forbidden'): AppError {
    return new AppError(ErrorCode.INSUFFICIENT_PERMISSIONS, message, 403);
  }

  static notFound(message: string = 'Resource not found'): AppError {
    return new AppError(ErrorCode.NOT_FOUND, message, 404);
  }

  static conflict(message: string, details?: any): AppError {
    return new AppError(ErrorCode.DUPLICATE_TRANSACTION, message, 409, details);
  }

  static unprocessableEntity(message: string, details?: any): AppError {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, 422, details);
  }

  static tooManyRequests(message: string = 'Too many requests'): AppError {
    return new AppError(ErrorCode.RATE_LIMIT_EXCEEDED, message, 429);
  }

  static internal(message: string = 'Internal server error', details?: any): AppError {
    return new AppError(ErrorCode.INTERNAL_ERROR, message, 500, details);
  }

  static serviceUnavailable(message: string = 'Service unavailable'): AppError {
    return new AppError(ErrorCode.SERVICE_UNAVAILABLE, message, 503);
  }

  // Financial-specific errors
  static insufficientBalance(amount: number, available: number): AppError {
    return new AppError(
      ErrorCode.INSUFFICIENT_BALANCE,
      `Insufficient balance. Required: ${amount}, Available: ${available}`,
      422,
      { required: amount, available }
    );
  }

  static insufficientMargin(required: number, available: number): AppError {
    return new AppError(
      ErrorCode.INSUFFICIENT_MARGIN,
      `Insufficient margin. Required: ${required}, Available: ${available}`,
      422,
      { required, available }
    );
  }

  static liquidationTriggered(positionId: string, loss: number): AppError {
    return new AppError(
      ErrorCode.LIQUIDATION_TRIGGERED,
      `Position liquidated due to insufficient margin. Loss: ${loss}`,
      422,
      { positionId, loss }
    );
  }

  static marginCall(positionId: string, marginRatio: number): AppError {
    return new AppError(
      ErrorCode.MARGIN_CALL,
      `Margin call triggered. Current ratio: ${marginRatio}%`,
      422,
      { positionId, marginRatio }
    );
  }

  // Compliance-specific errors
  static kycRequired(userId: string): AppError {
    return new AppError(
      ErrorCode.KYC_REQUIRED,
      'KYC verification required before proceeding',
      403,
      { userId }
    );
  }

  static sanctionsHit(entity: string, sanctionsList: string): AppError {
    return new AppError(
      ErrorCode.SANCTIONS_HIT,
      `Entity ${entity} found on sanctions list: ${sanctionsList}`,
      403,
      { entity, sanctionsList }
    );
  }

  static amlFlag(transactionId: string, riskScore: number): AppError {
    return new AppError(
      ErrorCode.AML_FLAG,
      `Transaction flagged by AML system. Risk score: ${riskScore}`,
      403,
      { transactionId, riskScore }
    );
  }
}

export class ErrorHandler {
  static handleError(error: Error | AppError, context?: any): AppError {
    // If it's already an AppError, return it
    if (error instanceof AppError) {
      return error;
    }

    // Handle known error types
    if (error.name === 'ValidationError') {
      return AppError.unprocessableEntity('Validation failed', error.message);
    }

    if (error.name === 'JsonWebTokenError') {
      return AppError.unauthorized('Invalid token');
    }

    if (error.name === 'TokenExpiredError') {
      return new AppError(ErrorCode.TOKEN_EXPIRED, 'Token expired', 401);
    }

    if (error.message.includes('duplicate key value')) {
      return AppError.conflict('Resource already exists');
    }

    if (error.message.includes('violates foreign key constraint')) {
      return AppError.unprocessableEntity('Invalid reference');
    }

    // Log the error with context
    LoggerService.error('Unhandled error:', {
      error: error.message,
      stack: error.stack,
      context
    });

    // Return generic internal error for unknown errors
    return AppError.internal('An unexpected error occurred');
  }

  static formatErrorResponse(error: AppError): any {
    const response: any = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        timestamp: new Date().toISOString()
      }
    };

    // Include details in development or for specific error types
    if (process.env.NODE_ENV === 'development' || error.details) {
      response.error.details = error.details;
    }

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development') {
      response.error.stack = error.stack;
    }

    return response;
  }

  static isOperationalError(error: Error): boolean {
    if (error instanceof AppError) {
      return error.isOperational;
    }

    // Consider database connection errors as operational
    if (error.message.includes('connection') || error.message.includes('timeout')) {
      return true;
    }

    // Consider external service errors as operational
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      return true;
    }

    return false;
  }

  static logError(error: Error | AppError, context?: any): void {
    const logData = {
      message: error.message,
      code: error instanceof AppError ? error.code : 'UNKNOWN_ERROR',
      stack: error.stack,
      context
    };

    if (this.isOperationalError(error)) {
      LoggerService.warn('Operational error:', logData);
    } else {
      LoggerService.error('Programming error:', logData);
    }
  }
}

// Global error factory function
export function createError(
  code: ErrorCode,
  message: string,
  statusCode?: number,
  details?: any
): AppError {
  return new AppError(code, message, statusCode, details);
}