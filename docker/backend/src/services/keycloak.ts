import { LoggerService } from './logger';

export interface KeycloakTokenClaims {
  sub: string;
  email?: string;
  preferred_username?: string;
  realm_access?: {
    roles?: string[];
  };
  resource_access?: Record<string, { roles?: string[] }>;
  aud?: string | string[];
  iss?: string;
  exp?: number;
  iat?: number;
}

/**
 * Backward-compatible Keycloak service shim.
 *
 * The migration is provider-abstracted and keycloak-first in config, but
 * legacy test/runtime paths still import this module.
 */
export class KeycloakService {
  static async initialize(): Promise<void> {
    LoggerService.info('KeycloakService shim initialized');
  }

  static isHealthy(): boolean {
    return true;
  }

  static async validateToken(_token: string): Promise<KeycloakTokenClaims> {
    throw new Error('Direct KeycloakService token validation is deprecated. Use provider abstraction middleware.');
  }
}

