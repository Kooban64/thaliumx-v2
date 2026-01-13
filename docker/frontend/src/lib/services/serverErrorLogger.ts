/**
 * Server-Side Error Logging Service
 * 
 * Production-ready error logging for Next.js API routes (server-side)
 * Sends errors to backend error reporting endpoint
 */

export enum ErrorCategory {
  API = 'api',
  AUTH = 'auth',
  VALIDATION = 'validation',
  NETWORK = 'network',
  RUNTIME = 'runtime',
  UNKNOWN = 'unknown',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ErrorContext {
  endpoint?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  sessionId?: string;
  url?: string;
  userAgent?: string;
  timestamp?: string;
  [key: string]: any;
}

/**
 * Log error to backend (server-side)
 * This is used in Next.js API routes
 */
export async function logServerError(
  error: Error | unknown,
  category: ErrorCategory = ErrorCategory.UNKNOWN,
  severity: ErrorSeverity = ErrorSeverity.MEDIUM,
  context?: ErrorContext
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  const errorLog = {
    message: errorMessage,
    error: errorMessage,
    category,
    severity,
    context: {
      ...context,
      timestamp: new Date().toISOString(),
    },
    stack: errorStack,
  };

  // In development, also log to console
  if (process.env.NODE_ENV === 'development') {
    console.error('[ServerErrorLogger]', errorLog);
  }

  // In production, send to backend error reporting endpoint
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://thaliumx-backend:3002';
    const errorEndpoint = `${backendUrl}/api/log-error`;

    await fetch(errorEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorLog),
      // Don't wait for response - fire and forget to avoid blocking
    }).catch(() => {
      // Silently fail - don't log logging errors
      // In production, you might want to use a queue or external service
    });
  } catch {
    // Silently fail - don't log logging errors
    // In production, consider using a message queue or external service
  }
}

/**
 * Log API proxy errors
 */
export async function logApiProxyError(
  error: Error | unknown,
  endpoint: string,
  method: string,
  context?: ErrorContext
): Promise<void> {
  const severity = error instanceof Error && error.message.includes('ECONNREFUSED')
    ? ErrorSeverity.CRITICAL
    : ErrorSeverity.HIGH;

  await logServerError(
    error,
    ErrorCategory.API,
    severity,
    {
      ...context,
      endpoint,
      method,
      type: 'proxy_error',
    }
  );
}
