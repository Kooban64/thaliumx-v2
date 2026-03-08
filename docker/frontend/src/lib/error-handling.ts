/**
 * Enhanced Error Handling and Retry Mechanisms
 *
 * Provides structured error responses, user-friendly messages,
 * and intelligent retry logic for API calls
 */

import { sanitizeText } from './sanitize';
import { ErrorCategory, ErrorSeverity, logError } from '@/lib/services/errorLogger';

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
  requestId?: string;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableErrors: string[];
}

export interface StructuredResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: string;
  requestId?: string;
}

type AbortSignalWithTimeout = {
  timeout?: (ms: number) => AbortSignal;
};

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  requestId?: string;
  timestamp?: string;
  success?: boolean;
  data?: unknown;
};

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffFactor: 2,
  retryableErrors: [
    'NETWORK_ERROR',
    'TIMEOUT',
    'SERVER_ERROR',
    'RATE_LIMITED',
    'SERVICE_UNAVAILABLE',
  ],
};

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: ApiError, config: RetryConfig = DEFAULT_RETRY_CONFIG): boolean {
  return config.retryableErrors.includes(error.code);
}

/**
 * Calculate delay for exponential backoff
 */
export function calculateRetryDelay(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  const delay = config.baseDelay * Math.pow(config.backoffFactor, attempt - 1);
  return Math.min(delay, config.maxDelay);
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Enhanced fetch with retry logic
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryConfig: Partial<RetryConfig> = {}
): Promise<Response> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  let lastError: Error;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const timeoutSignal = (() => {
        // Jest/jsdom environments may not implement AbortSignal.timeout.
        const abortSignalWithTimeout = AbortSignal as unknown as AbortSignalWithTimeout;
        if (typeof abortSignalWithTimeout.timeout === 'function') {
          return abortSignalWithTimeout.timeout(10000);
        }
        return undefined;
      })();

      const response = await fetch(url, {
        ...options,
        signal: options.signal || timeoutSignal, // 10 second timeout when supported
      });

      // Don't retry on client errors (4xx) except rate limiting
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }

      // Don't retry on successful responses
      if (response.status < 400) {
        return response;
      }

      // Retry on server errors (5xx) and rate limiting
      if (attempt === config.maxAttempts) {
        return response;
      }

      const delay = calculateRetryDelay(attempt, config);
      await sleep(delay);

    } catch (error) {
      lastError = error as Error;

      // Don't retry on abort or client-side errors
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('User aborted'))) {
        throw error;
      }

      if (attempt === config.maxAttempts) {
        throw lastError;
      }

      const delay = calculateRetryDelay(attempt, config);
      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * Parse API error response
 */
export function parseApiError(response: Response, data?: unknown): ApiError {
  const timestamp = new Date().toISOString();
  const payload = (data && typeof data === 'object') ? (data as ApiErrorPayload) : undefined;

  if (payload?.error) {
    return {
      code: payload.error.code || 'UNKNOWN_ERROR',
      message: sanitizeText(payload.error.message || 'An unknown error occurred'),
      details: payload.error.details,
      timestamp,
      requestId: payload.requestId,
    };
  }

  // Map HTTP status codes to error codes
  const statusErrorMap: Record<number, { code: string; message: string }> = {
    400: { code: 'BAD_REQUEST', message: 'Invalid request data' },
    401: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    403: { code: 'FORBIDDEN', message: 'Access denied' },
    404: { code: 'NOT_FOUND', message: 'Resource not found' },
    409: { code: 'CONFLICT', message: 'Resource conflict' },
    422: { code: 'VALIDATION_ERROR', message: 'Validation failed' },
    429: { code: 'RATE_LIMITED', message: 'Too many requests' },
    500: { code: 'SERVER_ERROR', message: 'Internal server error' },
    502: { code: 'BAD_GATEWAY', message: 'Bad gateway' },
    503: { code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable' },
    504: { code: 'TIMEOUT', message: 'Request timeout' },
  };

  const errorInfo = statusErrorMap[response.status] || {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
  };

  return {
    code: errorInfo.code,
    message: errorInfo.message,
    timestamp,
  };
}

/**
 * Extract detailed error information from OPA decisions
 */
export function extractOPAErrorDetails(error: ApiError): {
  message: string;
  ruleId?: string;
  reason?: string;
  actionable?: string;
} {
  // Check if error details contain OPA decision information
  if (error.details && typeof error.details === 'object') {
    const details = error.details as Record<string, unknown>;
    
    // Check for OPA decision structure
    if (details.complianceDecision || details.decision) {
      const decision = (details.complianceDecision || details.decision) as Record<string, unknown>;
      const ruleId = typeof decision.rule_id === 'string'
        ? decision.rule_id
        : (typeof decision.ruleId === 'string' ? decision.ruleId : undefined);
      const reason = typeof decision.reason === 'string' ? decision.reason : undefined;
      
      // Map rule IDs to actionable messages
      const actionableMessages: Record<string, string> = {
        'TX-LIMIT-001': 'Try a smaller amount or upgrade your KYC level to increase limits.',
        'TX-LIMIT-002': 'Wait until tomorrow or upgrade your KYC level for higher daily limits.',
        'TX-LIMIT-003': 'Wait until next month or upgrade your KYC level for higher monthly limits.',
        'TX-LIMIT-004': 'This currency requires a higher KYC level. Complete KYC verification to access more currencies.',
        'KYC-RISK-001': 'Contact support to review your account status.',
        'KYC-COMP-001': 'Contact support for assistance with compliance requirements.',
        'KYC-EXP-001': 'Complete KYC verification again to restore access.',
        'WF-KYC-001': 'Complete KYC verification to execute this workflow.',
        'WF-RISK-001': 'Contact support to review your account risk status.',
        'RATE-LIMIT-001': 'Please wait a few minutes before trying again.',
      };
      
      return {
        message: reason || getUserFriendlyErrorMessage(error),
        ruleId,
        reason,
        actionable: ruleId ? actionableMessages[ruleId] : undefined
      };
    }
    
    // Check for limit exceeded details
    if (details.limit_type || details.limit_value) {
      const limitType = details.limit_type;
      const limitValue = details.limit_value;
      const actualValue = details.actual_value;

      const limitValueText = typeof limitValue === 'number' ? limitValue.toLocaleString() : 'unknown';
      const actualValueText = typeof actualValue === 'number' ? actualValue.toLocaleString() : undefined;
      
      let message = `Your ${String(limitType)} limit is ${limitValueText}`;
      if (actualValueText) {
        message += `, but you attempted ${actualValueText}`;
      }
      
      return {
        message,
        actionable: 'Upgrade your KYC level to increase limits, or try a smaller amount.'
      };
    }
  }
  
  return {
    message: getUserFriendlyErrorMessage(error)
  };
}

/**
 * Create user-friendly error messages
 */
export function getUserFriendlyErrorMessage(error: ApiError): string {
  const errorMessages: Record<string, string> = {
    'BAD_REQUEST': 'Please check your input and try again.',
    'UNAUTHORIZED': 'Please sign in to continue.',
    'FORBIDDEN': 'You don\'t have permission to perform this action.',
    'NOT_FOUND': 'The requested resource was not found.',
    'CONFLICT': 'This action conflicts with existing data.',
    'VALIDATION_ERROR': 'Please correct the highlighted fields.',
    'RATE_LIMITED': 'Too many requests. Please wait a moment and try again.',
    'NETWORK_ERROR': 'Connection failed. Please check your internet and try again.',
    'TIMEOUT': 'Request timed out. Please try again.',
    'SERVER_ERROR': 'Something went wrong on our end. Please try again later.',
    'SERVICE_UNAVAILABLE': 'Service is temporarily unavailable. Please try again later.',
    'BAD_GATEWAY': 'Connection issue. Please try again.',
    'UNKNOWN_ERROR': 'An unexpected error occurred. Please try again.',
  };

  return errorMessages[error.code] || error.message || 'An unexpected error occurred.';
}

/**
 * Enhanced API call with structured error handling
 */
export async function apiCall<T = unknown>(
  url: string,
  options: RequestInit = {},
  retryConfig?: Partial<RetryConfig>
): Promise<StructuredResponse<T>> {
  try {
    const response = await fetchWithRetry(url, options, retryConfig);

    // Be tolerant in test environments/mocks where headers may be missing.
    let data: unknown;
    const hasJson = typeof response.json === 'function';
    if (hasJson) {
      try {
        data = await response.json();
      } catch {
        data = typeof response.text === 'function' ? await response.text() : undefined;
      }
    } else {
      data = typeof response.text === 'function' ? await response.text() : undefined;
    }

    // If backend uses { success: boolean, data, error, timestamp, requestId } shape,
    // normalize it here so callers can depend on `StructuredResponse<T>`.
    const maybeStructured = (data && typeof data === 'object') ? (data as ApiErrorPayload) : null;

    if (!response.ok || maybeStructured?.success === false) {
      const error = parseApiError(response, data);
      return {
        success: false,
        error,
        timestamp: maybeStructured?.timestamp || new Date().toISOString(),
        requestId: maybeStructured?.requestId,
      };
    }

    const payload = (maybeStructured && 'data' in maybeStructured) ? (maybeStructured.data as T) : (data as T);
    return {
      success: true,
      data: payload,
      timestamp: maybeStructured?.timestamp || new Date().toISOString(),
      requestId: maybeStructured?.requestId,
    };

  } catch (error) {
    const apiError: ApiError = {
      code: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Network request failed',
      timestamp: new Date().toISOString(),
    };

    return {
      success: false,
      error: apiError,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Hook for API calls with error handling and retry
 */
export function useApiCall<T = unknown>() {
  return {
    call: apiCall<T>,
    getErrorMessage: getUserFriendlyErrorMessage,
    isRetryableError,
  };
}

/**
 * Global error handler for unhandled errors
 */
export function setupGlobalErrorHandling() {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logError(event.reason, undefined, ErrorSeverity.HIGH, {
      type: 'unhandledRejection',
      component: 'global',
    });

    // Prevent the default browser behavior (logging to console)
    event.preventDefault();
  });

  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    logError(event.error, undefined, ErrorSeverity.CRITICAL, {
      type: 'uncaughtError',
      component: 'global',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });
}

/**
 * Error reporting function - Reports errors to backend and external services
 */
export function reportError(error: Error | string, context?: unknown) {
  const contextObject = (context && typeof context === 'object')
    ? (context as Record<string, unknown>)
    : {};

  // Determine category from context
  const category = (contextObject.category as ErrorCategory | undefined) || ErrorCategory.UNKNOWN;
  const severity = (contextObject.severity as ErrorSeverity | undefined) || ErrorSeverity.MEDIUM;

  // Log error using error logger (which will batch and send to backend)
  logError(
    typeof error === 'string' ? new Error(error) : error,
    category,
    severity,
    {
      ...contextObject,
      type: 'reportedError',
      reportedAt: new Date().toISOString(),
    }
  );

  // In production, optionally send to external error reporting services
  // Example: Sentry, LogRocket, Bugsnag, etc.
  if (process.env.NEXT_PUBLIC_ERROR_REPORTING_ENABLED === 'true') {
    // External error reporting service integration can be added here
    // For now, errors are logged via the error logger which sends to backend
  }
}
