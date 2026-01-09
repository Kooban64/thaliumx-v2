/**
 * Enterprise Log Correlation Utility
 * 
 * Manages correlation IDs and request context propagation across async operations
 * for distributed tracing and log correlation.
 * 
 * Features:
 * - Correlation ID generation and management
 * - Async context propagation (using AsyncLocalStorage)
 * - Request ID extraction from headers
 * - Trace context integration with OpenTelemetry
 * - Support for distributed tracing across services
 * 
 * Usage:
 * - Call setCorrelationContext() at request start
 * - Correlation IDs automatically included in all logs
 * - Context propagates through async/await chains
 */

import { AsyncLocalStorage } from 'async_hooks';
import { trace } from '@opentelemetry/api';
import * as crypto from 'crypto';

export interface CorrelationContext {
  correlationId: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  tenantId?: string;
  brokerId?: string;
  [key: string]: unknown;
}

class LogCorrelation {
  private static asyncLocalStorage = new AsyncLocalStorage<CorrelationContext>();
  private static initialized = false;

  /**
   * Initialize correlation system
   */
  public static initialize(): void {
    this.initialized = true;
  }

  /**
   * Generate a new correlation ID (UUID v4)
   */
  public static generateCorrelationId(): string {
    // Use crypto.randomUUID if available (Node 14.17+), otherwise fallback
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    // Fallback for older Node versions
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set correlation context for current async execution context
   * 
   * @param context - Correlation context to set
   * @param callback - Optional callback to run within this context
   */
  public static setCorrelationContext<T>(
    correlationContext: CorrelationContext,
    callback?: () => T
  ): T | void {
    if (!this.initialized) {
      this.initialize();
    }

    // Extract trace context from OpenTelemetry if available
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      const spanContext = activeSpan.spanContext();
      correlationContext.traceId = spanContext.traceId;
      correlationContext.spanId = spanContext.spanId;
    }

    if (callback) {
      return this.asyncLocalStorage.run(correlationContext, callback);
    } else {
      this.asyncLocalStorage.enterWith(correlationContext);
    }
  }

  /**
   * Get current correlation context
   */
  public static getCorrelationContext(): CorrelationContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * Get correlation ID from current context
   */
  public static getCorrelationId(): string | undefined {
    const ctx = this.getCorrelationContext();
    return ctx?.correlationId;
  }

  /**
   * Get request ID from current context
   */
  public static getRequestId(): string | undefined {
    const ctx = this.getCorrelationContext();
    return ctx?.requestId || ctx?.correlationId;
  }

  /**
   * Get trace ID from current context or OpenTelemetry
   */
  public static getTraceId(): string | undefined {
    const ctx = this.getCorrelationContext();
    if (ctx?.traceId) {
      return ctx.traceId;
    }
    
    // Try to get from OpenTelemetry active span
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      return activeSpan.spanContext().traceId;
    }
    
    return undefined;
  }

  /**
   * Get span ID from current context or OpenTelemetry
   */
  public static getSpanId(): string | undefined {
    const ctx = this.getCorrelationContext();
    if (ctx?.spanId) {
      return ctx.spanId;
    }
    
    // Try to get from OpenTelemetry active span
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      return activeSpan.spanContext().spanId;
    }
    
    return undefined;
  }

  /**
   * Extract correlation context from Express request
   */
  public static extractFromRequest(req: any): CorrelationContext {
    const correlationId = 
      req.headers['x-correlation-id'] || 
      req.headers['x-request-id'] || 
      this.generateCorrelationId();
    
    const requestId = req.headers['x-request-id'] || correlationId;
    const traceId = req.headers['x-trace-id'];
    const spanId = req.headers['x-span-id'];
    const userId = (req as any).user?.id || (req as any).userId;
    const tenantId = (req as any).tenantId || req.headers['x-tenant-id'];
    const brokerId = (req as any).brokerId || req.headers['x-broker-id'];

    return {
      correlationId,
      requestId,
      traceId,
      spanId,
      userId,
      tenantId,
      brokerId,
    };
  }

  /**
   * Run a function within a correlation context
   * Useful for wrapping async operations
   */
  public static async runWithContext<T>(
    correlationContext: CorrelationContext,
    fn: () => Promise<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      void this.asyncLocalStorage.run(correlationContext, async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Wrap a function to preserve correlation context
   * Useful for callbacks and event handlers
   */
  public static wrapWithContext<T extends (...args: any[]) => any>(
    fn: T
  ): T {
    const currentContext = this.getCorrelationContext();
    
    return ((...args: Parameters<T>) => {
      if (currentContext) {
        return this.asyncLocalStorage.run(currentContext, () => fn(...args));
      }
      return fn(...args);
    }) as T;
  }

  /**
   * Get all correlation metadata for logging
   */
  public static getLogMetadata(): Record<string, unknown> {
    const ctx = this.getCorrelationContext();
    if (!ctx) {
      return {};
    }

    const metadata: Record<string, unknown> = {
      correlationId: ctx.correlationId,
    };

    if (ctx.requestId && ctx.requestId !== ctx.correlationId) {
      metadata.requestId = ctx.requestId;
    }

    if (ctx.traceId) {
      metadata.traceId = ctx.traceId;
    }

    if (ctx.spanId) {
      metadata.spanId = ctx.spanId;
    }

    if (ctx.userId) {
      metadata.userId = ctx.userId;
    }

    if (ctx.tenantId) {
      metadata.tenantId = ctx.tenantId;
    }

    if (ctx.brokerId) {
      metadata.brokerId = ctx.brokerId;
    }

    return metadata;
  }
}

export { LogCorrelation };