/**
 * Error Logging Service
 * 
 * Centralized error logging service that replaces console.error calls
 * and provides structured error reporting to backend and external services
 */

export enum ErrorCategory {
  API = 'api',
  AUTH = 'auth',
  VALIDATION = 'validation',
  NETWORK = 'network',
  RUNTIME = 'runtime',
  UI = 'ui',
  UNKNOWN = 'unknown',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  url?: string;
  userAgent?: string;
  timestamp?: string;
  component?: string;
  action?: string;
  [key: string]: unknown;
}

export interface ErrorLog {
  message: string;
  error: Error | unknown;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context?: ErrorContext;
  stack?: string;
}

class ErrorLogger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private errorQueue: ErrorLog[] = [];
  private batchSize = 10;
  private flushInterval = 5000; // 5 seconds
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.startBatchFlush();
    }
  }

  /**
   * Log an error with context
   */
  log(
    error: Error | unknown,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: ErrorContext
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    const errorLog: ErrorLog = {
      message: errorMessage,
      error,
      category,
      severity,
      context: {
        ...context,
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      },
      stack: errorStack,
    };

    // In development, log to console for debugging
    if (this.isDevelopment) {
      console.error('[ErrorLogger]', errorLog);
    }

    // Add to queue for batch processing
    this.errorQueue.push(errorLog);

    // Flush immediately for critical errors
    if (severity === ErrorSeverity.CRITICAL) {
      this.flush();
    }

    // Flush if queue is full
    if (this.errorQueue.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Log API errors
   */
  logApiError(
    error: Error | unknown,
    endpoint?: string,
    method?: string,
    statusCode?: number,
    context?: ErrorContext
  ): void {
    const severity =
      statusCode && statusCode >= 500
        ? ErrorSeverity.HIGH
        : statusCode && statusCode >= 400
        ? ErrorSeverity.MEDIUM
        : ErrorSeverity.LOW;

    this.log(error, ErrorCategory.API, severity, {
      ...context,
      endpoint,
      method,
      statusCode,
    });
  }

  /**
   * Log authentication errors
   */
  logAuthError(
    error: Error | unknown,
    action?: string,
    context?: ErrorContext
  ): void {
    this.log(error, ErrorCategory.AUTH, ErrorSeverity.HIGH, {
      ...context,
      action,
    });
  }

  /**
   * Log validation errors
   */
  logValidationError(
    error: Error | unknown,
    field?: string,
    context?: ErrorContext
  ): void {
    this.log(error, ErrorCategory.VALIDATION, ErrorSeverity.LOW, {
      ...context,
      field,
    });
  }

  /**
   * Log network errors
   */
  logNetworkError(
    error: Error | unknown,
    context?: ErrorContext
  ): void {
    this.log(error, ErrorCategory.NETWORK, ErrorSeverity.MEDIUM, context);
  }

  /**
   * Log runtime errors
   */
  logRuntimeError(
    error: Error | unknown,
    component?: string,
    context?: ErrorContext
  ): void {
    this.log(error, ErrorCategory.RUNTIME, ErrorSeverity.HIGH, {
      ...context,
      component,
    });
  }

  /**
   * Flush error queue to backend
   */
  async flush(): Promise<void> {
    if (this.errorQueue.length === 0) {
      return;
    }

    const errorsToSend = [...this.errorQueue];
    this.errorQueue = [];

    try {
      // Send to backend error logging endpoint
      if (typeof window !== 'undefined') {
        await fetch('/api/errors/log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            errors: errorsToSend,
          }),
        }).catch(() => {
          // Silently fail - don't log logging errors
          // Re-queue errors if send fails
          this.errorQueue.unshift(...errorsToSend);
        });
      }
    } catch {
      // Silently fail - don't log logging errors
      // Re-queue errors if send fails
      this.errorQueue.unshift(...errorsToSend);
    }
  }

  /**
   * Start batch flush timer
   */
  private startBatchFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Stop batch flush timer
   */
  stopBatchFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    // Flush remaining errors
    this.flush();
  }
}

// Export singleton instance
export const errorLogger = new ErrorLogger();

// Export convenience functions
export const logError = (
  error: Error | unknown,
  category?: ErrorCategory,
  severity?: ErrorSeverity,
  context?: ErrorContext
) => errorLogger.log(error, category, severity, context);

export const logApiError = (
  error: Error | unknown,
  endpoint?: string,
  method?: string,
  statusCode?: number,
  context?: ErrorContext
) => errorLogger.logApiError(error, endpoint, method, statusCode, context);

export const logAuthError = (
  error: Error | unknown,
  action?: string,
  context?: ErrorContext
) => errorLogger.logAuthError(error, action, context);

export const logValidationError = (
  error: Error | unknown,
  field?: string,
  context?: ErrorContext
) => errorLogger.logValidationError(error, field, context);

export const logNetworkError = (
  error: Error | unknown,
  context?: ErrorContext
) => errorLogger.logNetworkError(error, context);

export const logRuntimeError = (
  error: Error | unknown,
  component?: string,
  context?: ErrorContext
) => errorLogger.logRuntimeError(error, component, context);
