/**
 * Authentik Service Stub
 * 
 * This is a placeholder service for testing purposes.
 * The actual Authentik integration uses OIDC via /auth endpoints.
 * 
 * This stub allows tests to run without requiring the full Authentik infrastructure.
 */

export class AuthentikService {
  /**
   * Initialize the Authentik service
   */
  static async initialize(): Promise<void> {
    // No-op for testing
  }

  /**
   * Check if Authentik is healthy
   */
  static isHealthy(): boolean {
    return true;
  }

  /**
   * Validate a token
   */
  static async validateToken(token: string): Promise<{ sub: string; email?: string; roles?: string[] }> {
    return {
      sub: 'test-user',
      email: 'test@example.com',
      roles: ['user']
    };
  }

  /**
   * Get user info from Authentik
   */
  static async getUserInfo(token: string): Promise<any> {
    return {
      sub: 'test-user',
      email: 'test@example.com'
    };
  }

  /**
   * Introspect a token
   */
  static async introspectToken(token: string): Promise<any> {
    return {
      active: true,
      sub: 'test-user'
    };
  }
}

export const authentikService = {
  initialize: AuthentikService.initialize,
  isHealthy: AuthentikService.isHealthy,
  validateToken: AuthentikService.validateToken,
  getUserInfo: AuthentikService.getUserInfo,
  introspectToken: AuthentikService.introspectToken
};