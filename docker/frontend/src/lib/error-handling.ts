/**
 * Enhanced Error Handling and Retry Mechanisms
 *
 * Provides structured error responses, user-friendly messages,
 * and intelligent retry logic for API calls
 */

import { sanitizeText } from './sanitize';

export interface ApiError {
  code: string;
  message: string;
  details?: any;
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

export interface StructuredResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: string;
  requestId?: string;
}

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
      const response = await fetch(url, {
        ...options,
        signal: options.signal || AbortSignal.timeout(10000), // 10 second timeout
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
export function parseApiError(response: Response, data?: any): ApiError {
  const timestamp = new Date().toISOString();

  if (data && data.error) {
    return {
      code: data.error.code || 'UNKNOWN_ERROR',
      message: sanitizeText(data.error.message || 'An unknown error occurred'),
      details: data.error.details,
      timestamp,
      requestId: data.requestId,
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
export async function apiCall<T = any>(
  url: string,
  options: RequestInit = {},
  retryConfig?: Partial<RetryConfig>
): Promise<StructuredResponse<T>> {
  try {
    const response = await fetchWithRetry(url, options, retryConfig);

    let data: any;
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const error = parseApiError(response, data);
      return {
        success: false,
        error,
        timestamp: new Date().toISOString(),
        requestId: data?.requestId,
      };
    }

    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      requestId: data?.requestId,
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
export function useApiCall<T = any>() {
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
    console.error('Unhandled promise rejection:', event.reason);

    // Prevent the default browser behavior (logging to console)
    event.preventDefault();

    // In production, send to error reporting service
    if (process.env.NODE_ENV === 'production') {
      // reportError(event.reason);
    }
  });

  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error);

    // In production, send to error reporting service
    if (process.env.NODE_ENV === 'production') {
      // reportError(event.error);
    }
  });
}

/**
 * Error reporting function (placeholder for error reporting service)
 */
export function reportError(error: Error | string, context?: any) {
  const errorData = {
    message: typeof error === 'string' ? error : error.message,
    stack: typeof error === 'string' ? undefined : error.stack,
    context,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
  };

  console.error('Error reported:', errorData);

  // In production, send to error reporting service
  // Example: Sentry, LogRocket, Bugsnag, etc.
  // if (process.env.NEXT_PUBLIC_ERROR_REPORTING_ENABLED) {
  //   // Send to error reporting service
  // }
}