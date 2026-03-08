import type { NextFunction, Request, Response } from 'express';
import { createError } from '../utils';
import type { SessionChannel } from '../types';

const BROKER_CHANNEL = 'broker' as const;
const DIRECT_CHANNEL = 'direct' as const;

const normalizeChannel = (value: unknown): SessionChannel | null => {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (v === BROKER_CHANNEL || v === DIRECT_CHANNEL) return v;
  return null;
};

const parseScopes = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(/[\s,]+/)
      .map(scope => scope.trim())
      .filter(Boolean);
  }

  return [];
};

const getHeaderValue = (req: Request, key: string): string | undefined => {
  const raw = req.headers[key];
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim();
  return v.length ? v : undefined;
};

const strictDirectIsolation = (): boolean => {
  return (process.env.AUTH_ALLOW_DIRECT_BROKER_CONTEXT || 'false').trim().toLowerCase() !== 'true';
};

const getAllowedHosts = (): string[] => {
  const raw = (process.env.AUTH_ALLOWED_HOSTS || '').trim();
  if (raw) {
    return raw
      .split(',')
      .map(v => v.trim().toLowerCase())
      .filter(Boolean);
  }

  return ['thaliumx.com', 'www.thaliumx.com', 'thal.thaliumx.com', 'api.thaliumx.com', 'auth.thaliumx.com'];
};

const hostMatchesPattern = (host: string, pattern: string): boolean => {
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1).toLowerCase();
    return host.endsWith(suffix) && host !== suffix.slice(1);
  }
  return host === pattern;
};

const parseBrokerFromHost = (resolvedHost: string | undefined): { brokerSlug?: string; channel: SessionChannel } => {
  if (!resolvedHost) {
    return { channel: DIRECT_CHANNEL };
  }

  const host = resolvedHost.toLowerCase();
  if (!host.endsWith('.thaliumx.com')) {
    return { channel: DIRECT_CHANNEL };
  }

  const root = host.replace(/:\d+$/, '');
  const knownNonBroker = new Set(['thaliumx.com', 'www.thaliumx.com', 'api.thaliumx.com', 'auth.thaliumx.com', 'thal.thaliumx.com']);
  if (knownNonBroker.has(root)) {
    return { channel: DIRECT_CHANNEL };
  }

  const parts = root.split('.');
  if (parts.length < 3) {
    return { channel: DIRECT_CHANNEL };
  }

  const brokerSlug = parts[0];
  if (!brokerSlug || brokerSlug === 'www' || brokerSlug === 'api' || brokerSlug === 'auth') {
    return { channel: DIRECT_CHANNEL };
  }

  return { brokerSlug, channel: BROKER_CHANNEL };
};

export const resolveBrokerChannelContext = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const tokenChannel = normalizeChannel(req.user?.channel);
    const headerChannel = normalizeChannel(req.headers['x-channel']);
    const resolvedHost = getHeaderValue(req, 'x-resolved-host') || getHeaderValue(req, 'host');
    const hostDerived = parseBrokerFromHost(resolvedHost);

    const allowedHosts = getAllowedHosts();
    const normalizedHost = resolvedHost?.toLowerCase().replace(/:\d+$/, '');
    if (normalizedHost && !allowedHosts.some(pattern => hostMatchesPattern(normalizedHost, pattern))) {
      throw createError('Resolved host is not in allowed host list', 403, 'UNTRUSTED_HOST');
    }

    const resolvedChannel: SessionChannel = tokenChannel || headerChannel || hostDerived.channel || DIRECT_CHANNEL;

    const tokenBrokerId = req.user?.brokerId;
    const headerBrokerId = getHeaderValue(req, 'x-broker-id');
    const tokenBrokerSlug = req.user?.brokerSlug;
    const headerBrokerSlug = getHeaderValue(req, 'x-broker-slug');

    const brokerId = tokenBrokerId || headerBrokerId;
    const brokerSlug = tokenBrokerSlug || headerBrokerSlug || hostDerived.brokerSlug;

    if (headerChannel && tokenChannel && headerChannel !== tokenChannel) {
      throw createError('Broker channel mismatch between gateway and token', 403, 'AUTH_CONTEXT_MISMATCH');
    }

    if (resolvedChannel === BROKER_CHANNEL) {
      if (!brokerId || !brokerSlug) {
        throw createError('Broker context required for broker channel', 403, 'BROKER_CONTEXT_REQUIRED');
      }

      if (tokenBrokerId && headerBrokerId && tokenBrokerId !== headerBrokerId) {
        throw createError('Broker ID mismatch between gateway and token', 403, 'AUTH_CONTEXT_MISMATCH');
      }
      if (tokenBrokerSlug && headerBrokerSlug && tokenBrokerSlug !== headerBrokerSlug) {
        throw createError('Broker slug mismatch between gateway and token', 403, 'AUTH_CONTEXT_MISMATCH');
      }
    }

    if (resolvedChannel === DIRECT_CHANNEL && strictDirectIsolation() && (brokerId || brokerSlug)) {
      throw createError('Direct channel cannot include broker context', 403, 'AUTH_CONTEXT_MISMATCH');
    }

    req.channel = resolvedChannel;
    req.brokerId = brokerId;
    req.brokerSlug = brokerSlug;

    if (req.user) {
      req.user.channel = resolvedChannel;
      req.user.brokerId = brokerId;
      req.user.brokerSlug = brokerSlug;
      req.user.mandateScopes = parseScopes(req.user.mandateScopes);
    }

    if (req.authContext) {
      req.authContext.channel = resolvedChannel;
      req.authContext.brokerId = brokerId;
      req.authContext.brokerSlug = brokerSlug;
      req.authContext.mandateScopes = parseScopes(req.authContext.mandateScopes);
      req.authContext.resolvedHost = req.authContext.resolvedHost || resolvedHost;
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const requireBrokerContext = (req: Request, _res: Response, next: NextFunction): void => {
  const channel = req.channel || req.user?.channel;
  const brokerId = req.brokerId || req.user?.brokerId;
  const brokerSlug = req.brokerSlug || req.user?.brokerSlug;

  if (channel !== BROKER_CHANNEL) {
    next(createError('Broker channel is required for this operation', 403, 'BROKER_CHANNEL_REQUIRED'));
    return;
  }

  if (!brokerId || !brokerSlug) {
    next(createError('Broker context is required for this operation', 403, 'BROKER_CONTEXT_REQUIRED'));
    return;
  }

  next();
};

export const requireMandateScopes = (requiredScopes: string[]) => {
  const normalizedRequired = requiredScopes
    .map(scope => scope.trim())
    .filter(Boolean);

  return (req: Request, _res: Response, next: NextFunction): void => {
    const channel = req.channel || req.user?.channel;
    const hasBrokerRole = (req.user?.roles || []).some(role => role.startsWith('broker_'));

    if (channel !== BROKER_CHANNEL || !hasBrokerRole) {
      next();
      return;
    }

    const scopes = parseScopes(req.authContext?.mandateScopes || req.user?.mandateScopes);
    const missing = normalizedRequired.filter(scope => !scopes.includes(scope));

    if (missing.length > 0) {
      next(
        createError(
          `Missing required mandate scopes: ${missing.join(', ')}`,
          403,
          'MANDATE_SCOPE_REQUIRED',
        ),
      );
      return;
    }

    next();
  };
};

export const requireBrokerCustomerMatch = (
  resolveRequestBrokerId: (req: Request) => string | undefined,
) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const contextBrokerId = req.brokerId || req.user?.brokerId;
    const requestBrokerId = resolveRequestBrokerId(req);

    if (!requestBrokerId || !contextBrokerId) {
      next();
      return;
    }

    if (requestBrokerId !== contextBrokerId) {
      next(
        createError(
          'Request broker does not match authenticated broker context',
          403,
          'AUTH_CONTEXT_MISMATCH',
        ),
      );
      return;
    }

    next();
  };
};
