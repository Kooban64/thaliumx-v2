/**
 * Error Handler Middleware
 * 
 * Comprehensive error handling, authentication, and validation middleware.
 * 
 * Features:
 * - Global error handler for all Express errors
 * - JWT token authentication middleware
 * - Role-based access control (RBAC)
 * - Permission-based access control
 * - Input validation and sanitization
 * - Rate limiting (general and financial)
 * - Security headers
 * - SQL injection protection
 * - XSS protection
 * - Request size limiting
 * 
 * Authentication:
 * - authenticateToken - Validates JWT tokens
 * - requireRole - Enforces role requirements
 * - requirePermission - Enforces permission requirements
 * 
 * Security:
 * - Input sanitization
 * - SQL injection detection
 * - XSS prevention
 * - Security headers (helmet)
 * - Rate limiting
 * 
 * Error Handling:
 * - Structured error responses
 * - Error logging
 * - Request ID tracking
 * - Stack traces in development only
 */

import type { Request, Response, NextFunction } from 'express';
import { createError, AppError } from '../utils';
import { LoggerService } from '../services/logger';
import type { AuthContext, JWTPayload, SessionChannel } from '../types';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      authContext?: AuthContext;
      tenantId?: string;
      channel?: SessionChannel;
      brokerId?: string;
      brokerSlug?: string;
    }
  }
}

// =============================================================================
// GLOBAL ERROR HANDLER
// =============================================================================

export const globalErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let code = 'INTERNAL_ERROR';

  // Handle known error types
  // NOTE:
  // This codebase currently has *two* `AppError` classes:
  // - [`AppError`](docker/backend/src/utils/index.ts:313) (simple)
  // - [`AppError`](docker/backend/src/utils/error-handler.ts:88) (rich, with ErrorCode enum + static helpers)
  // Not all modules import the same one, so `instanceof AppError` is not sufficient.
  // Treat any error that looks like an AppError (has numeric statusCode) as structured.
  const anyErr = error as any;

  if (error instanceof AppError || (typeof anyErr?.statusCode === 'number' && anyErr?.code)) {
    statusCode = typeof anyErr.statusCode === 'number' ? anyErr.statusCode : 500;
    message = typeof anyErr.message === 'string' ? anyErr.message : message;
    code = String(anyErr.code || code);
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    code = 'VALIDATION_ERROR';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
    code = 'UNAUTHORIZED';
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden';
    code = 'FORBIDDEN';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Not Found';
    code = 'NOT_FOUND';
  }

  // Log error
  LoggerService.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
                statusCode
  });

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    },
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || 'unknown'
  });
};

// =============================================================================
// NOT FOUND HANDLER
// =============================================================================

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  const error = createError(`Route ${req.originalUrl} not found`, 404, 'NOT_FOUND');
  next(error);
};

// =============================================================================
// REQUEST LOGGER
// =============================================================================

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || 'unknown';

  // Log request
  LoggerService.info('Incoming request:', {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length')
  });

  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const duration = Date.now() - start;
    
    LoggerService.info('Request completed:', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length')
    });
    
    return originalEnd(chunk, encoding, cb);
  };

  next();
};

// =============================================================================
// RATE LIMITER
// =============================================================================

import rateLimit from 'express-rate-limit';

// Create Redis store for distributed rate limiting
// const redisClient = RedisService.getClient(); // Used in rate limiter configuration

// Enhanced rate limiter with tiered limits
// Using in-memory store (no Redis store) to prevent "failed to limit count" errors
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req: Request) => {
    // Skip rate limiting in test environment
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true') {
      return Number.MAX_SAFE_INTEGER; // Effectively disable rate limiting
    }

    // Dynamic limits based on user role and endpoint
    const user = req.user;
    const path = req.path;

    // Financial endpoints get stricter limits
    if (path.includes('/financial') || path.includes('/margin') || path.includes('/exchange')) {
      if (user?.role === 'super_admin' || user?.role === 'admin') {
        return 1000; // High limit for admins
      }
      return 50; // Stricter for financial operations
    }

    // Auth endpoints
    if (path.includes('/auth')) {
      return 10; // Very strict for auth
    }

    // Default limits
    if (user?.role === 'super_admin' || user?.role === 'admin') {
      return 500;
    }

    return 100; // Standard limit
  },
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Skip rate limiting for health checks and metrics
    if (req.path === '/health' || req.path === '/metrics' || req.path === '/ready' || req.path === '/live') {
      return true;
    }

    // Skip static assets (favicon, images, etc.)
    if (req.path.match(/\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot)$/i)) {
      return true;
    }

    // IMPORTANT (ThaliumX auth contract):
    // Public auth endpoints are already rate-limited at the gateway (APISIX) with
    // per-IP controls. Applying this global 15-min limiter to `/api/auth/*` causes
    // false-positive lockouts during normal UI flows (csrf-token, login, profile/me, etc.).
    if (req.path.startsWith('/api/auth/')) {
      return true;
    }
    // Skip rate limiting in test environment
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true') {
      return true;
    }
    return false;
  },
  handler: (req: Request, res: Response) => {
    LoggerService.warn('Rate limit exceeded:', {
      ip: req.ip,
      url: req.url,
      userAgent: req.get('User-Agent'),
      userId: req.user?.userId,
      role: req.user?.role
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later.'
      },
      timestamp: new Date().toISOString(),
      retryAfter: Math.ceil(res.getHeader('Retry-After') as number / 1000) || 900
    });
  },
  // Skip on errors to prevent 500s when store fails
  skipFailedRequests: true
});

// Additional rate limiter for sensitive financial operations
// Using in-memory store to prevent store errors
export const financialRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: (_req: Request) => {
    // Skip rate limiting in test environment
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true') {
      return Number.MAX_SAFE_INTEGER; // Effectively disable rate limiting
    }
    return 10; // 10 requests per minute for financial operations
  },
  message: {
    success: false,
    error: {
      code: 'FINANCIAL_RATE_LIMIT_EXCEEDED',
      message: 'Too many financial operations, please slow down.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req: Request) => {
    // Skip rate limiting in test environment
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true') {
      return true;
    }
    return false;
  },
  handler: (req: Request, res: Response) => {
    LoggerService.warn('Financial rate limit exceeded:', {
      ip: req.ip,
      url: req.url,
      userId: req.user?.userId,
      role: req.user?.role
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'FINANCIAL_RATE_LIMIT_EXCEEDED',
        message: 'Too many financial operations, please slow down.'
      },
      timestamp: new Date().toISOString(),
      retryAfter: 60
    });
  }
});

// =============================================================================
// AUTHENTICATION MIDDLEWARE
// =============================================================================

import * as jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import type { JwksClient } from 'jwks-rsa';
// User type imported but not directly used - used in type annotations via req.user

// Cache JWKS clients per JWKS URI (enterprise-grade: avoids per-request discovery)
const jwksClients = new Map<string, JwksClient>();

const getJwksClient = (jwksUri: string): JwksClient => {
  const existing = jwksClients.get(jwksUri);
  if (existing) return existing;

  const client = jwksRsa({
    jwksUri,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 10 * 60 * 1000,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
    timeout: 10_000,
  });

  jwksClients.set(jwksUri, client);
  return client;
};

const normalizeIssuer = (iss: string): string => iss.replace(/\/+$/, '');

const normalizeSessionChannel = (channel: unknown): SessionChannel | null => {
  if (typeof channel !== 'string') return null;
  const normalized = channel.trim().toLowerCase();
  if (normalized === 'direct' || normalized === 'broker') return normalized;
  return null;
};

const normalizeAudience = (aud: unknown): string[] => {
  if (Array.isArray(aud)) return aud.filter((v): v is string => typeof v === 'string');
  if (typeof aud === 'string') return [aud];
  return [];
};

const getStringClaim = (decoded: Record<string, unknown>, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = decoded[key];
    if (typeof value === 'string' && value.trim().length) return value;
  }
  return undefined;
};

const getStringArrayClaim = (decoded: Record<string, unknown>, ...keys: string[]): string[] => {
  for (const key of keys) {
    const value = decoded[key];
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
    }
    if (typeof value === 'string' && value.length > 0) {
      return value
        .split(/[\s,]+/)
        .map(v => v.trim())
        .filter(Boolean);
    }
  }
  return [];
};


const getAllowedIssuers = (): string[] => {
  // Comma-separated allowlist. If unset, default to internal JWT issuer only.
  const raw = (process.env.OIDC_ALLOWED_ISSUERS || '').trim();
  const list = raw
    ? raw
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(normalizeIssuer)
    : [];

  // Default to internal JWT issuer if no issuers configured
  const defaultIssuer = process.env.JWT_ISSUER || 'thaliumx-platform';
  return list.length ? Array.from(new Set(list)) : [defaultIssuer];
};

const getAuthentikIssuerDefault = (): string => {
  const explicitIssuer = (process.env.AUTHENTIK_ISSUER || '').trim();
  if (explicitIssuer) return normalizeIssuer(explicitIssuer);

  // Default Authentik issuer for ThaliumX
  return normalizeIssuer('https://thaliumx.com/application/o/thaliumx/');
};

const getExpectedAudience = (): string[] => {
  const values = [
    process.env.AUTHENTIK_AUDIENCE,
    process.env.AUTHENTIK_CLIENT_ID,
    process.env.AUTHENTIK_AUDIENCE,
    process.env.AUTHENTIK_CLIENT_ID,
  ]
    .filter((v): v is string => typeof v === 'string')
    .map(v => v.trim())
    .filter(Boolean);

  return Array.from(new Set(values));
};

const getJwtVerificationProvider = (): { name: 'internal-jwt' | 'authentik'; issuer: string; jwksUri: string } => {
  // Check if Authentik JWT is explicitly enabled
  const useAuthentik = (process.env.USE_AUTHENTIK_JWT || 'false').trim().toLowerCase() === 'true';
  
  if (useAuthentik) {
    const authentikIssuer = getAuthentikIssuerDefault();
    const authentikJwks = (process.env.AUTHENTIK_JWKS_URI || '').trim() || 
      `${authentikIssuer}jwks/`;
    return {
      name: 'authentik' as const,
      issuer: authentikIssuer,
      jwksUri: authentikJwks,
    };
  }

  // Default to internal JWT
  return {
    name: 'internal-jwt' as const,
    issuer: process.env.JWT_ISSUER || 'thaliumx-platform',
    jwksUri: '', // Internal JWT doesn't need JWKS
  };
};

const extractRoleClaims = (decoded: Record<string, unknown>): string[] => {
  const claimRoles = getStringArrayClaim(decoded, 'roles', 'broker_roles', 'platform_roles');
  const realmRoles =
    typeof decoded.realm_access === 'object' && decoded.realm_access !== null
      ? getStringArrayClaim(decoded.realm_access as Record<string, unknown>, 'roles')
      : [];
  return Array.from(new Set([...claimRoles, ...realmRoles]));
};

const enforceContextInvariants = (
  req: Request,
  opts: {
    channel: SessionChannel;
    brokerId?: string;
    brokerSlug?: string;
    provider: 'Authentik' | 'authentik' | 'internal-jwt';
  },
): void => {
  const allowDirectBrokerContext = (process.env.AUTH_ALLOW_DIRECT_BROKER_CONTEXT || 'false')
    .trim()
    .toLowerCase() === 'true';

  const headerChannel = normalizeSessionChannel(req.headers['x-channel']);
  const headerBrokerIdRaw = req.headers['x-broker-id'];
  const headerBrokerId =
    typeof headerBrokerIdRaw === 'string' && headerBrokerIdRaw.trim().length
      ? headerBrokerIdRaw.trim()
      : undefined;
  const headerBrokerSlugRaw = req.headers['x-broker-slug'];
  const headerBrokerSlug =
    typeof headerBrokerSlugRaw === 'string' && headerBrokerSlugRaw.trim().length
      ? headerBrokerSlugRaw.trim()
      : undefined;

  if (headerChannel && headerChannel !== opts.channel) {
    throw createError('Channel mismatch between gateway and token context', 403, 'AUTH_CONTEXT_MISMATCH');
  }

  if (opts.channel === 'broker') {
    if (!opts.brokerId || !opts.brokerSlug) {
      throw createError(
        `Missing broker context claims for ${opts.provider} broker-channel token`,
        401,
        'INVALID_TOKEN',
      );
    }

    if (headerBrokerId && headerBrokerId !== opts.brokerId) {
      throw createError('Broker ID mismatch between gateway and token', 403, 'AUTH_CONTEXT_MISMATCH');
    }

    if (headerBrokerSlug && headerBrokerSlug !== opts.brokerSlug) {
      throw createError('Broker slug mismatch between gateway and token', 403, 'AUTH_CONTEXT_MISMATCH');
    }
  }

  if (opts.channel === 'direct' && !allowDirectBrokerContext && (opts.brokerId || opts.brokerSlug)) {
    throw createError('Direct channel token contains broker context', 403, 'AUTH_CONTEXT_MISMATCH');
  }
};

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Token authentication - supports Authentik OIDC tokens and internal JWT tokens.
    // Tokens are stored in frontend memory and sent via Authorization header (high security).
    const authHeader = req.headers.authorization;
    const bearer = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const headerToken = (req.headers['x-access-token'] as string | undefined) || undefined;

    // Priority: Bearer token > Header token (no cookie fallback - tokens in memory only)
    const token = bearer || headerToken;

    if (!token) {
      throw createError('Access token required', 401, 'MISSING_TOKEN');
    }

    const decoded: any = jwt.decode(token) || {};
    const issuerRaw: string | undefined = typeof decoded.iss === 'string' ? decoded.iss : undefined;
    const issuerNorm = issuerRaw ? normalizeIssuer(issuerRaw) : undefined;

    const verificationProvider = getJwtVerificationProvider();
    const configuredIssuers = new Set<string>([
      normalizeIssuer(verificationProvider.issuer),
      ...getAllowedIssuers(),
    ]);
    const isOidcToken = !!(issuerNorm && configuredIssuers.has(issuerNorm));

    // ------------------------------
    // Authentik OIDC token verification
    // ------------------------------
    if (isOidcToken) {
      const jwksUri = verificationProvider.jwksUri;

      const client = getJwksClient(jwksUri);
      const getKey: jwt.GetPublicKeyOrSecret = (header, callback) => {
        const kid = header.kid;
        if (!kid) return callback(new Error('Missing kid'), undefined);
        client.getSigningKey(kid, (err, key) => {
          if (err) return callback(err, undefined);
          if (!key) return callback(new Error('No signing key returned'), undefined);
          const signingKey = key.getPublicKey();
          callback(null, signingKey);
        });
      };

      const issuers = issuerNorm ? [issuerNorm, `${issuerNorm}/`] : [];
      if (!issuerNorm || issuers.length === 0 || !configuredIssuers.has(issuerNorm)) {
        throw new Error('No valid issuer found');
      }
      
      await new Promise((resolve, reject) => {
        const expectedAudiences = getExpectedAudience();

        // Build JWT verification options - include audience validation for security
        const jwtVerifyOptions: jwt.VerifyOptions = {
          algorithms: ['RS256'],
          // Accept normalized issuer and one trailing-slash variant only.
          issuer: issuers.length === 1 ? issuers[0] : issuers as [string, ...string[]],
        };

        // Add audience validation to JWT verification to prevent token substitution attacks
        // Only validate if expected audiences are configured
        if (expectedAudiences.length > 0) {
          // Cast to the required tuple type for jsonwebtoken
          jwtVerifyOptions.audience = expectedAudiences as [string, ...string[]];
        }

        jwt.verify(
          token,
          getKey,
          jwtVerifyOptions,
          (err: Error | null, payload: any) => {
            if (err) return reject(err);
            resolve(payload);
          },
        );
      });

      const expectedAudiences = getExpectedAudience();
      if (expectedAudiences.length) {
        const aud = decoded?.aud;
        const audList = Array.isArray(aud) ? aud : typeof aud === 'string' ? [aud] : [];
        const audienceMatch = expectedAudiences.some(expectedAud => audList.includes(expectedAud));
        if (!audienceMatch) {
          throw createError('Invalid token audience', 401, 'INVALID_TOKEN');
        }
      }

      const allRoles = extractRoleClaims(decoded as Record<string, unknown>);

      // Normalize roles using RoleMapperService
      const { RoleMapperService } = await import('../services/role-mapper');
      const normalizedRoles = RoleMapperService.normalizeRoles(allRoles);
      const rolePriority = ['master_system_admin', 'platform_admin', 'broker_admin', 'platform_compliance', 'broker_compliance', 'platform_finance', 'broker_finance', 'platform_support', 'broker_support', 'user_trader', 'user_viewer'];
      const selectedRole = normalizedRoles.find((r: string) => rolePriority.includes(r)) || normalizedRoles[0] || 'user_viewer';

      const claimChannel = normalizeSessionChannel(decoded?.channel);
      const claimBrokerId =
        (decoded?.broker_id as string | undefined) || (decoded?.brokerId as string | undefined) || undefined;
      const claimBrokerSlug =
        (decoded?.broker_slug as string | undefined) ||
        (decoded?.brokerSlug as string | undefined) ||
        undefined;
      const channel: SessionChannel = claimChannel || (claimBrokerId || claimBrokerSlug ? 'broker' : 'direct');

      enforceContextInvariants(req, {
        channel,
        brokerId: claimBrokerId,
        brokerSlug: claimBrokerSlug,
        provider: verificationProvider.name,
      });

      const headerTenantId = (req.headers['x-tenant-id'] as string | undefined) || undefined;
      const tokenTenantId = (decoded?.tenant_id as string | undefined) || (decoded?.tenantId as string | undefined) || undefined;
      const resolvedTenantId =
        tokenTenantId ||
        claimBrokerId ||
        headerTenantId ||
        process.env.DEFAULT_TENANT_ID ||
        '10000000-0000-0000-0000-000000000000';

      const userId = (decoded?.sub as string) || 'unknown';
      const email = (decoded?.email as string) || (decoded?.preferred_username as string) || 'unknown';

      const payload: JWTPayload = {
        id: userId,
        userId: userId,
        email: email,
        role: selectedRole as any,
        roles: normalizedRoles as any,
        tenantId: resolvedTenantId,
        brokerId: claimBrokerId,
        brokerSlug: claimBrokerSlug,
        channel,
        customerId: getStringClaim(decoded as Record<string, unknown>, 'customer_id', 'customerId'),
        mandateScopes: getStringArrayClaim(decoded as Record<string, unknown>, 'mandate_scopes', 'mandateScopes'),
        sessionType: getStringClaim(decoded as Record<string, unknown>, 'session_type', 'sessionType'),
        authProvider: verificationProvider.name,
        issuer: issuerNorm,
        audience: normalizeAudience(decoded?.aud),
        permissions: [],
        iat: typeof decoded?.iat === 'number' ? decoded.iat : Math.floor(Date.now() / 1000),
        exp: typeof decoded?.exp === 'number' ? decoded.exp : Math.floor(Date.now() / 1000) + 300,
      };

      req.user = payload;
      req.tenantId = resolvedTenantId;
      req.channel = channel;
      req.brokerId = claimBrokerId;
      req.brokerSlug = claimBrokerSlug;
      req.authContext = {
        provider: verificationProvider.name,
        channel,
        brokerId: claimBrokerId,
        brokerSlug: claimBrokerSlug,
        customerId: payload.customerId,
        mandateScopes: payload.mandateScopes || [],
        sessionType: payload.sessionType,
        subject: userId,
        issuer: issuerNorm,
        audience: payload.audience || [],
        resolvedHost:
          (req.headers['x-resolved-host'] as string | undefined) ||
          (req.headers.host as string | undefined) ||
          undefined,
      };

      // Log successful authentication
      try {
        await LoggerService.logAudit('authentication_success', 'authentication', { userId }, {
          email,
          result: 'success',
          ip: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          method: 'Authentik_oidc',
          mfaUsed: false, // MFA status would come from token claims if available
        });
      } catch (logError) {
        // Don't fail authentication on audit log errors
        LoggerService.warn('Failed to log authentication event', logError);
      }

      next();
      return;
    }

    // ------------------------------
    // Our own JWT token verification (primary method)
    // ------------------------------
    // If not a recognized OIDC token, verify as our own JWT token
    try {
      const { TokenService } = await import('../services/token-service');
      const payload = TokenService.verifyAccessToken(token) as JWTPayload;

      // Ensure tenantId is present for client separation
      const headerTenantId = (req.headers['x-tenant-id'] as string | undefined) || undefined;
      const resolvedTenantId = payload.tenantId || headerTenantId || process.env.DEFAULT_TENANT_ID || '10000000-0000-0000-0000-000000000000';

      // Update payload with resolved tenantId
      payload.tenantId = resolvedTenantId;
      const channel: SessionChannel = payload.channel || (payload.brokerId ? 'broker' : 'direct');
      enforceContextInvariants(req, {
        channel,
        brokerId: payload.brokerId,
        brokerSlug: payload.brokerSlug,
        provider: 'internal-jwt',
      });
      payload.channel = channel;
      payload.authProvider = payload.authProvider || 'internal-jwt';

      req.user = payload;
      req.tenantId = resolvedTenantId;
      req.channel = channel;
      req.brokerId = payload.brokerId;
      req.brokerSlug = payload.brokerSlug;
      req.authContext = {
        provider: payload.authProvider,
        channel,
        brokerId: payload.brokerId,
        brokerSlug: payload.brokerSlug,
        customerId: payload.customerId,
        mandateScopes: payload.mandateScopes || [],
        sessionType: payload.sessionType,
        subject: payload.userId,
        issuer: payload.issuer,
        audience: payload.audience || [],
        resolvedHost:
          (req.headers['x-resolved-host'] as string | undefined) ||
          (req.headers.host as string | undefined) ||
          undefined,
      };

      // Log successful authentication
      try {
        await LoggerService.logAudit('authentication_success', 'authentication', { userId: payload.userId }, {
          email: payload.email,
          result: 'success',
          ip: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          method: 'jwt',
          mfaUsed: (payload as any).mfa_enabled || false,
          tenantId: resolvedTenantId,
        });
      } catch (logError) {
        // Don't fail authentication on audit log errors
        LoggerService.warn('Failed to log authentication event', logError);
      }

      next();
      return;
    } catch (jwtError: any) {
      // JWT verification failed
      LoggerService.warn('JWT token verification failed', {
        error: jwtError.message,
        hasIssuer: !!issuerRaw
      });
      throw createError('Invalid or expired token', 401, 'INVALID_TOKEN');
    }

  } catch (error) {
    // Log failed authentication
    try {
      const decoded: any = req.headers.authorization ? jwt.decode(req.headers.authorization.toString().replace('Bearer ', '')) : {};
      await LoggerService.logAudit('authentication_failure', 'authentication', { userId: decoded?.sub }, {
        email: decoded?.email || decoded?.preferred_username,
        result: 'failure',
        reason: error instanceof Error ? error.message : 'unknown_error',
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        method: 'Authentik_oidc',
      });
    } catch {
      // Ignore audit log errors
    }

    // Record JWT validation failure metric
    try {
      const { MetricsService } = await import('../services/metrics');
      if (error instanceof jwt.JsonWebTokenError) {
        MetricsService.recordJWTValidationFailure('invalid_token');
        next(createError('Invalid token', 401, 'INVALID_TOKEN'));
      } else if (error instanceof jwt.TokenExpiredError) {
        MetricsService.recordJWTValidationFailure('token_expired');
        next(createError('Token expired', 401, 'TOKEN_EXPIRED'));
      } else {
        MetricsService.recordJWTValidationFailure('unknown_error');
        next(error);
      }
    } catch {
      // Don't fail on metrics errors
      if (error instanceof jwt.JsonWebTokenError) {
        next(createError('Invalid token', 401, 'INVALID_TOKEN'));
      } else if (error instanceof jwt.TokenExpiredError) {
        next(createError('Token expired', 401, 'TOKEN_EXPIRED'));
      } else {
        next(error);
      }
    }
  }
};

// =============================================================================
// AUTHORIZATION MIDDLEWARE
// =============================================================================

export const requireRole = (roles: string[]) => {
  // Import RoleMapperService for role normalization
  const { RoleMapperService } = require('../services/role-mapper');

  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(createError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
      return;
    }

    // Normalize required roles
    const normalizedRequired = RoleMapperService.normalizeRoles(roles);

    // Get user roles and normalize them
    const userRoles = Array.from(
      new Set([
        req.user.role,
        ...(Array.isArray((req.user as any).roles) ? ((req.user as any).roles as string[]) : [])
      ].filter(Boolean))
    );
    const normalizedUserRoles = RoleMapperService.normalizeRoles(userRoles);

    // Check if any normalized user role matches any normalized required role
    const isAllowed = normalizedUserRoles.some((userRole: any) => 
      normalizedRequired.some((requiredRole: any) => 
        RoleMapperService.matchesAny(userRole, [requiredRole])
      )
    );

    if (!isAllowed) {
      next(createError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
      return;
    }

    next();
  };
};

export const requirePermission = (resource: string, action: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(createError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
      return;
    }

    const hasPermission = req.user.permissions.some(
      permission => permission.resource === resource && permission.action === action
    );

    if (!hasPermission) {
      next(createError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
      return;
    }

    next();
  };
};

// =============================================================================
// TENANT MIDDLEWARE
// =============================================================================

export const requireTenant = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    next(createError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
    return;
  }

  if (!req.user.tenantId) {
    next(createError('Tenant context required', 400, 'TENANT_REQUIRED'));
    return;
  }

  next();
};

// =============================================================================
// VALIDATION MIDDLEWARE
// =============================================================================

import type * as Joi from 'joi';

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      next(createError(`Validation error: ${errorMessage}`, 400, 'VALIDATION_ERROR'));
      return;
    }

    next();
  };
};

// =============================================================================
// ASYNC ERROR HANDLER
// =============================================================================

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// =============================================================================
// REQUEST ID MIDDLEWARE
// =============================================================================

export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const id = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-ID', id);
  next();
};

// =============================================================================
// SECURITY HEADERS MIDDLEWARE
// =============================================================================

export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Strict-Transport-Security (only for HTTPS)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  next();
};

// =============================================================================
// INPUT SANITIZATION MIDDLEWARE
// =============================================================================

// IMPORTANT:
// - This backend compiles to CommonJS ([`tsconfig.json`](docker/backend/tsconfig.json:1)).
// - Recent versions of jsdom/parse5 are ESM and will fail to load via `require()`.
// To keep production runtime stable and Jest-compatible, use the lightweight `xss`
// library (already a dependency) to strip tags from untrusted input.
import xss from 'xss';

export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  // Sanitize string fields in body
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      // Strip all tags/attributes while preserving text.
      return xss(obj, {
        whiteList: {},
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script']
      });
    } else if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    } else if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  next();
};

// =============================================================================
// SQL INJECTION PROTECTION MIDDLEWARE
// =============================================================================

export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction): void => {
  const suspiciousPatterns = [
    /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/i,
    /('|(\\x27)|(\\x2D\\x2D)|#|%27|%22|%3B|%3C|%3E|%00|(\\x2D\\x2D))/i,
    /('|(\\x27)|(\\x2D\\x2D)|#|%27|%22|%3B|%3C|%3E|%00|(\\x2D\\x2D)|;|--|#|\*)/i
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(value));
    } else if (Array.isArray(value)) {
      return value.some(checkValue);
    } else if (value && typeof value === 'object') {
      return Object.values(value).some(checkValue);
    }
    return false;
  };

  const hasSuspiciousContent = checkValue(req.body) || checkValue(req.query) || checkValue(req.params);

  if (hasSuspiciousContent) {
    LoggerService.warn('SQL injection attempt detected', {
      ip: req.ip,
      url: req.url,
      userAgent: req.get('User-Agent'),
      userId: req.user?.userId
    });

    return next(createError('Invalid input detected', 400, 'INVALID_INPUT'));
  }

  next();
};

// =============================================================================
// XSS PROTECTION MIDDLEWARE
// =============================================================================

export const xssProtection = (req: Request, res: Response, next: NextFunction): void => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /onmouseover\s*=/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi
  ];

  const checkXSS = (value: any): boolean => {
    if (typeof value === 'string') {
      return xssPatterns.some(pattern => pattern.test(value));
    } else if (Array.isArray(value)) {
      return value.some(checkXSS);
    } else if (value && typeof value === 'object') {
      return Object.values(value).some(checkXSS);
    }
    return false;
  };

  const hasXSS = checkXSS(req.body) || checkXSS(req.query) || checkXSS(req.params);

  if (hasXSS) {
    LoggerService.warn('XSS attempt detected', {
      ip: req.ip,
      url: req.url,
      userAgent: req.get('User-Agent'),
      userId: req.user?.userId
    });

    return next(createError('Invalid input detected', 400, 'INVALID_INPUT'));
  }

  next();
};

// =============================================================================
// API KEY VALIDATION MIDDLEWARE
// =============================================================================

import { apiKeyRateLimiter } from './rate-limiter';

export const validateApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Apply rate limiting for API key validation attempts (10 per minute per IP)
  // This should be called before any validation logic to prevent brute-force attacks
  return apiKeyRateLimiter(req, res, async () => {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      return next(createError('API key required', 401, 'MISSING_API_KEY'));
    }

    try {
      // Validate the API key against the database
      const { ApiKeyService } = await import('../services/api-key');
      const validatedKey = await ApiKeyService.validateKey(apiKey, req.ip);

      // Attach validated key info to request for downstream use
      (req as any).apiKey = {
        id: validatedKey.id,
        name: validatedKey.name,
        userId: validatedKey.userId,
        tenantId: validatedKey.tenantId,
        brokerId: validatedKey.brokerId,
        scopes: validatedKey.scopes,
        rateLimit: validatedKey.rateLimit
      };

      next();
    } catch (error: any) {
      // Log the failed API key attempt
      LoggerService.warn('API key validation failed', {
        ip: req.ip,
        url: req.url,
        userAgent: req.get('User-Agent'),
        errorCode: error.code || 'UNKNOWN'
      });

      // Pass the error to the error handler
      next(error);
    }
  });
};

// =============================================================================
// REQUEST SIZE LIMIT MIDDLEWARE
// =============================================================================

export const requestSizeLimit = (req: Request, _res: Response, next: NextFunction): void => {
  const contentLength = parseInt(req.headers['content-length'] || '0');

  // Limit to 10MB for regular requests, 50MB for file uploads
  const maxSize = req.path.includes('/upload') || req.path.includes('/kyc') ? 50 * 1024 * 1024 : 10 * 1024 * 1024;

  if (contentLength > maxSize) {
    LoggerService.warn('Request size limit exceeded', {
      ip: req.ip,
      url: req.url,
      contentLength,
                maxSize
    });

    return next(createError('Request too large', 413, 'REQUEST_TOO_LARGE'));
  }

  next();
};
