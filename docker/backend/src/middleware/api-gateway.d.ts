/**
 * API Gateway Middleware
 *
 * Advanced API gateway functionality with request routing, throttling, and circuit breaking.
 *
 * Features:
 * - Request routing and load balancing
 * - Circuit breaker pattern for service protection
 * - Request throttling and rate limiting
 * - IP blocking and allowlisting
 * - Trusted proxy support
 * - Request timeout handling
 * - Concurrent request limiting
 *
 * Configuration:
 * - Trusted proxies configuration
 * - Allowed origins (CORS)
 * - Blocked IP addresses
 * - Rate limiting by IP or user
 * - Circuit breaker thresholds
 * - Request timeout settings
 *
 * Security:
 * - IP-based access control
 * - Origin validation
 * - Request throttling
 * - DDoS protection
 *
 * Production Features:
 * - Health check endpoint
 * - Rate limit cleanup
 * - Circuit breaker state management
 */
import { Request, Response, NextFunction } from 'express';
interface APIGatewayConfig {
    enabled: boolean;
    trustedProxies: string[];
    allowedOrigins: string[];
    blockedIPs: string[];
    rateLimitByIP: boolean;
    rateLimitByUser: boolean;
    enableCircuitBreaker: boolean;
    enableRequestThrottling: boolean;
    maxConcurrentRequests: number;
    requestTimeout: number;
}
interface CircuitBreakerState {
    failures: number;
    lastFailureTime: number;
    state: 'closed' | 'open' | 'half-open';
}
export declare const apiGateway: (config?: Partial<APIGatewayConfig>) => (req: Request, res: Response, next: NextFunction) => void;
export declare const gatewayHealthCheck: (_req: Request, res: Response) => void;
export declare const cleanupRateLimits: () => void;
export declare const getGatewayStats: () => {
    activeRequests: number;
    queuedRequests: number;
    circuitBreakerState: CircuitBreakerState;
    ipRateLimitsActive: number;
    userRateLimitsActive: number;
    blockedIPs: number;
};
export {};
//# sourceMappingURL=api-gateway.d.ts.map