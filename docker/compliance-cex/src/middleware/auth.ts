/**
 * JWT Authentication Middleware
 * Authentik JWT token validation for ThaliumX Compliance Service
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksRsa, { JwksClient } from 'jwks-rsa';
import { config } from '../config';
import { logger } from '../utils/logger';

// Cache JWKS clients per JWKS URI
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

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        roles: string[];
        tenantId?: string;
      };
    }
  }
}

/**
 * JWT Authentication Middleware
 * Validates Authentik JWT tokens from Authorization header
 */
export const authenticateJWT = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      logger.warn('Missing authorization header', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      res.status(401).json({
        error: 'Authentication required',
        message: 'Authorization header is required',
      });
      return;
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    if (!token) {
      logger.warn('Invalid authorization header format', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      res.status(401).json({
        error: 'Authentication required',
        message: 'Invalid authorization header format',
      });
      return;
    }

    // Decode token to check issuer
    const decodedToken: any = jwt.decode(token) || {};
    const issuerRaw: string | undefined = typeof decodedToken.iss === 'string' ? decodedToken.iss : undefined;
    const issuerNorm = issuerRaw ? issuerRaw.replace(/\/+$/, '') : undefined;

    if (!issuerRaw || !issuerNorm) {
      logger.warn('Invalid token issuer', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid token issuer',
      });
      return;
    }

    // Only allow Authentik tokens
    const allowedIssuers = [
      process.env.AUTHENTIK_ISSUER || 'https://thaliumx.com/application/o/thaliumx/',
    ].map(iss => iss.replace(/\/+$/, ''));
    if (!allowedIssuers.includes(issuerNorm)) {
      logger.warn('Invalid token issuer', {
        issuer: issuerNorm,
        allowedIssuers,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid token issuer',
      });
      return;
    }

    // Get JWKS URI and verify token
    const jwksUri = process.env.AUTHENTIK_JWKS_URI || 'https://thaliumx.com/application/o/thaliumx/jwks/';
    const client = getJwksClient(jwksUri);
    const getKey: jwt.GetPublicKeyOrSecret = (header, callback) => {
      const kid = header.kid;
      if (!kid) return callback(new Error('Missing kid'), undefined);
      client.getSigningKey(kid, (err: any, key: any) => {
        if (err) return callback(err, undefined);
        if (!key) return callback(new Error('No signing key returned'), undefined);
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
      });
    };

    // Verify the token
    const decoded = await new Promise<jwt.JwtPayload>((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          algorithms: ['RS256'],
          issuer: [issuerRaw, issuerNorm],
        },
        (err, payload) => {
          if (err) return reject(err);
          resolve(payload as jwt.JwtPayload);
        },
      );
    });

    // Extract user information
    req.user = {
      id: decoded.sub || decoded.userId || '',
      email: decoded.email || '',
      roles: Array.isArray(decoded.roles) ? decoded.roles : [],
      tenantId: decoded.tenantId,
    };

    logger.debug('JWT authentication successful', {
      userId: req.user.id,
      path: req.path,
      method: req.method,
    });

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid JWT token', {
        error: error.message,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid or expired token',
      });
      return;
    }

    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Expired JWT token', {
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      res.status(401).json({
        error: 'Authentication failed',
        message: 'Token has expired',
      });
      return;
    }

    logger.error('JWT authentication error', {
      error: error instanceof Error ? error.message : String(error),
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error during authentication',
    });
  }
};

/**
 * Role-based authorization middleware
 * Checks if user has required roles
 */
export const requireRoles = (...requiredRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated',
      });
      return;
    }

    const userRoles = req.user.roles || [];
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      logger.warn('Insufficient permissions', {
        userId: req.user!.id,
        userRoles,
        requiredRoles,
        path: req.path,
        method: req.method,
      });
      res.status(403).json({
        error: 'Insufficient permissions',
        message: 'User does not have required roles',
      });
      return;
    }

    next();
  };
};

/**
 * Optional authentication middleware
 * Sets user info if Authentik token is present, but doesn't fail if missing
 */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      // No token provided, continue without user info
      next();
      return;
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    if (!token) {
      // Invalid format, continue without user info
      next();
      return;
    }

    // Decode and verify Authentik JWT token
    const decodedToken: any = jwt.decode(token) || {};
    const issuerRaw: string | undefined = typeof decodedToken.iss === 'string' ? decodedToken.iss : undefined;
    const issuerNorm = issuerRaw ? issuerRaw.replace(/\/+$/, '') : undefined;

    if (!issuerRaw || !issuerNorm) {
      // Invalid issuer, continue without user info
      next();
      return;
    }

    // Only allow Authentik tokens
    const allowedIssuers = [
      process.env.AUTHENTIK_ISSUER || 'https://thaliumx.com/application/o/thaliumx/',
    ].map(iss => iss.replace(/\/+$/, ''));
    if (!allowedIssuers.includes(issuerNorm)) {
      // Invalid issuer, continue without user info
      next();
      return;
    }

    // Get JWKS URI and verify token
    const jwksUri = process.env.AUTHENTIK_JWKS_URI || 'https://thaliumx.com/application/o/thaliumx/jwks/';
    const client = getJwksClient(jwksUri);
    const getKey: jwt.GetPublicKeyOrSecret = (header, callback) => {
      const kid = header.kid;
      if (!kid) return callback(new Error('Missing kid'), undefined);
      client.getSigningKey(kid, (err: any, key: any) => {
        if (err) return callback(err, undefined);
        if (!key) return callback(new Error('No signing key returned'), undefined);
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
      });
    };

    // Verify the token
    const decoded = await new Promise<jwt.JwtPayload>((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          algorithms: ['RS256'],
          issuer: [issuerRaw, issuerNorm],
        },
        (err, payload) => {
          if (err) return reject(err);
          resolve(payload as jwt.JwtPayload);
        },
      );
    });

    // Extract user information
    req.user = {
      id: decoded.sub || decoded.userId || '',
      email: decoded.email || '',
      roles: Array.isArray(decoded.roles) ? decoded.roles : [],
      tenantId: decoded.tenantId,
    };

    logger.debug('Optional JWT authentication successful', {
      userId: req.user.id,
      path: req.path,
      method: req.method,
    });
  } catch (error) {
    // Ignore authentication errors for optional auth
    logger.debug('Optional JWT authentication failed, continuing without auth', {
      error: error instanceof Error ? error.message : String(error),
      path: req.path,
      method: req.method,
    });
  }

  next();
};
