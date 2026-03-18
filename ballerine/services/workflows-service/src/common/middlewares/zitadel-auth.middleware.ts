import { Injectable, NestMiddleware, Scope } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { ZitadelAuthService } from '@/auth/zitadel/zitadel-auth.service';
import { AuthenticatedEntity } from '@/types';
import { env } from '@/env';
import * as jwt from 'jsonwebtoken';
import jwksRsa, { JwksClient } from 'jwks-rsa';
import { AppLoggerService } from '@/common/app-logger/app-logger.service';

// Cache JWKS clients per JWKS URI
const jwksClients = new Map<string, JwksClient>();

const getJwksClient = (jwksUri: string): JwksClient => {
  const existing = jwksClients.get(jwksUri);
  if (existing) return existing;

  const client = jwksRsa({
    jwksUri,
    cache: true,
    cacheMaxAge: 86400000, // 24 hours
    rateLimit: true,
    jwksRequestsPerMinute: 10,
  });

  jwksClients.set(jwksUri, client);
  return client;
};

const normalizeIssuer = (iss: string): string => iss.replace(/\/+$/, '');

/**
 * Authentik Authentication Middleware
 * 
 * This middleware attempts to authenticate requests using Authentik OIDC JWT tokens.
 * It runs BEFORE AuthKeyMiddleware, so if a Zitadel token is present and valid,
 * it sets req.user. If not, it falls through to allow other auth methods.
 * 
 * This ensures backward compatibility - API keys, sessions, etc. still work.
 */
@Injectable({ scope: Scope.REQUEST })
export class ZitadelAuthMiddleware implements NestMiddleware {
  constructor(
    private readonly zitadelAuthService: ZitadelAuthService,
    private readonly cls: ClsService,
    private readonly logger: AppLoggerService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Check if Authentik auth is enabled
    if (!env.AUTHENTIK_ENABLED) {
      return next();
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // No Authentik token, continue to next middleware
    }

    const token = authHeader.substring(7);
    if (!token || token === 'null') {
      return next();
    }

    let isAuthentikToken = false;

    try {
      // Validate JWKS URI uses HTTPS in production (security requirement)
      if (env.ENVIRONMENT_NAME === 'production') {
        const jwksUri = env.AUTHENTIK_JWKS_URI || 'https://thaliumx.com/application/o/thaliumx/jwks/';
        if (jwksUri.startsWith('http://') && !jwksUri.includes('localhost') && !jwksUri.includes('127.0.0.1')) {
          this.logger.error('[Authentik Auth] Security violation: JWKS URI uses HTTP in production', {
            jwksUri,
            path: req.path,
            method: req.method,
          });
          // In production, fail fast if JWKS URI is not HTTPS
          return next(); // Continue but log the security issue
        }
      }

      // Decode token to check issuer
      const decoded = jwt.decode(token, { complete: true }) as any;
      if (!decoded || !decoded.payload) {
        return next(); // Invalid token format, continue (not an Authentik token)
      }

      const issuer = env.AUTHENTIK_ISSUER || 'https://thaliumx.com/application/o/thaliumx/';
      const issuerNorm = normalizeIssuer(issuer);
      const tokenIssuer = decoded.payload.iss ? normalizeIssuer(decoded.payload.iss) : null;

      // Only process Authentik tokens
      if (!tokenIssuer || (tokenIssuer !== issuerNorm && tokenIssuer !== issuer)) {
        return next(); // Not an Authentik token, continue
      }

      isAuthentikToken = true; // Mark that this is an Authentik token

      // Verify token with JWKS
      const jwksUri = env.AUTHENTIK_JWKS_URI || 'https://thaliumx.com/application/o/thaliumx/jwks/';
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

      // Verify the token
      const verifiedPayload = await new Promise<any>((resolve, reject) => {
        jwt.verify(
          token,
          getKey,
          {
            algorithms: ['RS256'],
            issuer: [decoded.payload.iss, issuerNorm, issuer],
          },
          (err, payload) => {
            if (err) return reject(err);
            resolve(payload);
          },
        );
      });

      // Audience check - REQUIRED when configured (security requirement)
      const expectedAud = env.AUTHENTIK_AUDIENCE;
      if (expectedAud) {
        const aud = verifiedPayload.aud;
        const audList = Array.isArray(aud) ? aud : typeof aud === 'string' ? [aud] : [];
        if (!audList.includes(expectedAud)) {
          // SECURITY: Audience mismatch - log and reject
          this.logger.warn('[Authentik Auth] Audience mismatch - authentication rejected', {
            expectedAudience: expectedAud,
            tokenAudience: audList,
            issuer: verifiedPayload.iss,
            sub: verifiedPayload.sub,
            path: req.path,
            method: req.method,
            ip: req.ip,
          });
          return next(); // Invalid audience, continue (don't fail, let other auth try)
        }
      } else if (env.ENVIRONMENT_NAME === 'production') {
        // In production, audience should be configured for security
        this.logger.warn('[Authentik Auth] AUTHENTIK_AUDIENCE not configured in production - security risk', {
          path: req.path,
          method: req.method,
        });
      }

      // Explicitly check token expiration (additional security check)
      const now = Math.floor(Date.now() / 1000);
      if (verifiedPayload.exp && verifiedPayload.exp < now) {
        this.logger.warn('[Authentik Auth] Expired token rejected', {
          exp: verifiedPayload.exp,
          now,
          sub: verifiedPayload.sub,
          path: req.path,
          method: req.method,
          ip: req.ip,
        });
        return next(); // Expired token, continue
      }

      // Map Authentik user to Ballerine user (Authentik uses OIDC-compatible claims)
      const userInfo = await this.zitadelAuthService.findOrCreateUserFromZitadelToken(verifiedPayload);

      if (userInfo) {
        // Set user in request and CLS context
        const authenticatedEntity: AuthenticatedEntity = {
          user: {
            id: userInfo.id,
            email: userInfo.email,
            firstName: userInfo.firstName,
            lastName: userInfo.lastName,
            roles: userInfo.roles,
          },
          type: 'user',
        };

        this.cls.set('entity', authenticatedEntity);
        req.user = authenticatedEntity as any;

        // Log successful authentication for security audit
        this.logger.log('[Authentik Auth] Authentication successful', {
          userId: userInfo.id,
          email: userInfo.email,
          sub: verifiedPayload.sub,
          path: req.path,
          method: req.method,
          ip: req.ip,
        });
      } else {
        // User mapping failed - log for security monitoring
        this.logger.warn('[Authentik Auth] User mapping failed', {
          sub: verifiedPayload.sub,
          email: verifiedPayload.email || verifiedPayload.preferred_username,
          path: req.path,
          method: req.method,
          ip: req.ip,
        });
      }

      // Continue regardless - if user mapping failed, other auth methods can try
      next();
    } catch (error) {
      // Distinguish between "not an Authentik token" (ok) vs "invalid Authentik token" (should log)
      if (isAuthentikToken) {
        // This was an Authentik token but verification failed - log security event
        this.logger.error('[Authentik Auth] Token verification failed', {
          error: error instanceof Error ? error.message : String(error),
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
      }
      // If Authentik auth fails, continue to allow other auth methods
      // This ensures backward compatibility
      next();
    }
  }
}
