'use client';

/**
 * ThaliumX Authentication Context
 * 
 * Provides comprehensive authentication state management with Keycloak integration.
 * 
 * Features:
 * - Keycloak SSO integration
 * - Token management with automatic refresh
 * - Role-based access control
 * - Session persistence
 * - Multi-tenant support
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import Keycloak from 'keycloak-js';

// Types
interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatar?: string;
  roles: string[];
  permissions: string[];
  tenantId?: string;
  tenantSlug?: string;
  kycStatus: 'none' | 'pending' | 'approved' | 'rejected';
  kycLevel: number;
  mfaEnabled: boolean;
  emailVerified: boolean;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (redirectUri?: string) => Promise<void>;
  logout: (redirectUri?: string) => Promise<void>;
  register: (redirectUri?: string) => Promise<void>;
  refreshSession: () => Promise<boolean>;
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  hasAllRoles: (roles: string[]) => boolean;
  updateToken: (minValidity?: number) => Promise<boolean>;
  getToken: () => string | null;
  isTokenExpired: () => boolean;
}

// Keycloak configuration
const keycloakConfig = {
  url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8080',
  realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'thaliumx',
  clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'thaliumx-frontend',
};

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Keycloak instance (singleton)
let keycloakInstance: Keycloak | null = null;

const getKeycloakInstance = (): Keycloak => {
  if (typeof window === 'undefined') {
    throw new Error('Keycloak can only be initialized in browser');
  }
  
  if (!keycloakInstance) {
    keycloakInstance = new Keycloak(keycloakConfig);
  }
  
  return keycloakInstance;
};

// Parse JWT token
const parseToken = (token: string): any => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

// Extract user from Keycloak token
const extractUserFromToken = (keycloak: Keycloak): User | null => {
  if (!keycloak.token || !keycloak.tokenParsed) {
    return null;
  }

  const tokenParsed = keycloak.tokenParsed as any;
  const realmRoles = tokenParsed.realm_access?.roles || [];
  const clientRoles = tokenParsed.resource_access?.[keycloakConfig.clientId]?.roles || [];
  const allRoles = [...new Set([...realmRoles, ...clientRoles])];

  return {
    id: tokenParsed.sub,
    email: tokenParsed.email,
    firstName: tokenParsed.given_name,
    lastName: tokenParsed.family_name,
    displayName: tokenParsed.name || tokenParsed.preferred_username,
    avatar: tokenParsed.picture,
    roles: allRoles,
    permissions: tokenParsed.permissions || [],
    tenantId: tokenParsed.tenant_id,
    tenantSlug: tokenParsed.tenant_slug,
    kycStatus: tokenParsed.kyc_status || 'none',
    kycLevel: tokenParsed.kyc_level || 0,
    mfaEnabled: tokenParsed.mfa_enabled || false,
    emailVerified: tokenParsed.email_verified || false,
  };
};

// Auth Provider Component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    token: null,
    refreshToken: null,
    error: null,
  });

  // Initialize Keycloak
  useEffect(() => {
    const initKeycloak = async () => {
      if (typeof window === 'undefined') return;

      try {
        const keycloak = getKeycloakInstance();

        // Check for stored tokens
        const storedToken = localStorage.getItem('kc_token');
        const storedRefreshToken = localStorage.getItem('kc_refresh_token');

        const authenticated = await keycloak.init({
          onLoad: 'check-sso',
          silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
          pkceMethod: 'S256',
          checkLoginIframe: false,
          token: storedToken || undefined,
          refreshToken: storedRefreshToken || undefined,
        });

        if (authenticated) {
          const user = extractUserFromToken(keycloak);
          
          // Store tokens
          if (keycloak.token) {
            localStorage.setItem('kc_token', keycloak.token);
          }
          if (keycloak.refreshToken) {
            localStorage.setItem('kc_refresh_token', keycloak.refreshToken);
          }

          setState({
            isAuthenticated: true,
            isLoading: false,
            user,
            token: keycloak.token || null,
            refreshToken: keycloak.refreshToken || null,
            error: null,
          });

          // Setup token refresh
          keycloak.onTokenExpired = () => {
            keycloak.updateToken(30).then((refreshed) => {
              if (refreshed && keycloak.token) {
                localStorage.setItem('kc_token', keycloak.token);
                if (keycloak.refreshToken) {
                  localStorage.setItem('kc_refresh_token', keycloak.refreshToken);
                }
                setState((prev) => ({
                  ...prev,
                  token: keycloak.token || null,
                  refreshToken: keycloak.refreshToken || null,
                }));
              }
            }).catch(() => {
              // Token refresh failed, logout
              logout();
            });
          };

          // Setup auth state change handlers
          keycloak.onAuthSuccess = () => {
            const user = extractUserFromToken(keycloak);
            setState((prev) => ({
              ...prev,
              isAuthenticated: true,
              user,
              token: keycloak.token || null,
              refreshToken: keycloak.refreshToken || null,
            }));
          };

          keycloak.onAuthLogout = () => {
            localStorage.removeItem('kc_token');
            localStorage.removeItem('kc_refresh_token');
            setState({
              isAuthenticated: false,
              isLoading: false,
              user: null,
              token: null,
              refreshToken: null,
              error: null,
            });
          };
        } else {
          setState({
            isAuthenticated: false,
            isLoading: false,
            user: null,
            token: null,
            refreshToken: null,
            error: null,
          });
        }
      } catch (error) {
        console.error('Keycloak initialization failed:', error);
        setState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          token: null,
          refreshToken: null,
          error: 'Authentication service unavailable',
        });
      }
    };

    initKeycloak();
  }, []);

  // Login function
  const login = useCallback(async (redirectUri?: string) => {
    try {
      const keycloak = getKeycloakInstance();
      await keycloak.login({
        redirectUri: redirectUri || window.location.origin + '/dashboard',
      });
    } catch (error) {
      console.error('Login failed:', error);
      setState((prev) => ({
        ...prev,
        error: 'Login failed. Please try again.',
      }));
    }
  }, []);

  // Logout function
  const logout = useCallback(async (redirectUri?: string) => {
    try {
      localStorage.removeItem('kc_token');
      localStorage.removeItem('kc_refresh_token');
      
      const keycloak = getKeycloakInstance();
      await keycloak.logout({
        redirectUri: redirectUri || window.location.origin,
      });
    } catch (error) {
      console.error('Logout failed:', error);
      // Force local logout even if Keycloak fails
      setState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        token: null,
        refreshToken: null,
        error: null,
      });
    }
  }, []);

  // Register function
  const register = useCallback(async (redirectUri?: string) => {
    try {
      const keycloak = getKeycloakInstance();
      await keycloak.register({
        redirectUri: redirectUri || window.location.origin + '/dashboard',
      });
    } catch (error) {
      console.error('Registration failed:', error);
      setState((prev) => ({
        ...prev,
        error: 'Registration failed. Please try again.',
      }));
    }
  }, []);

  // Refresh session
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const keycloak = getKeycloakInstance();
      const refreshed = await keycloak.updateToken(30);
      
      if (refreshed && keycloak.token) {
        localStorage.setItem('kc_token', keycloak.token);
        if (keycloak.refreshToken) {
          localStorage.setItem('kc_refresh_token', keycloak.refreshToken);
        }
        
        const user = extractUserFromToken(keycloak);
        setState((prev) => ({
          ...prev,
          user,
          token: keycloak.token || null,
          refreshToken: keycloak.refreshToken || null,
        }));
      }
      
      return true;
    } catch (error) {
      console.error('Session refresh failed:', error);
      return false;
    }
  }, []);

  // Update token
  const updateToken = useCallback(async (minValidity: number = 30): Promise<boolean> => {
    try {
      const keycloak = getKeycloakInstance();
      return await keycloak.updateToken(minValidity);
    } catch {
      return false;
    }
  }, []);

  // Get current token
  const getToken = useCallback((): string | null => {
    return state.token;
  }, [state.token]);

  // Check if token is expired
  const isTokenExpired = useCallback((): boolean => {
    try {
      const keycloak = getKeycloakInstance();
      return keycloak.isTokenExpired();
    } catch {
      return true;
    }
  }, []);

  // Role checking functions
  const hasRole = useCallback((role: string): boolean => {
    return state.user?.roles.includes(role) || false;
  }, [state.user]);

  const hasPermission = useCallback((permission: string): boolean => {
    return state.user?.permissions.includes(permission) || false;
  }, [state.user]);

  const hasAnyRole = useCallback((roles: string[]): boolean => {
    return roles.some((role) => state.user?.roles.includes(role));
  }, [state.user]);

  const hasAllRoles = useCallback((roles: string[]): boolean => {
    return roles.every((role) => state.user?.roles.includes(role));
  }, [state.user]);

  // Memoized context value
  const contextValue = useMemo<AuthContextType>(() => ({
    ...state,
    login,
    logout,
    register,
    refreshSession,
    hasRole,
    hasPermission,
    hasAnyRole,
    hasAllRoles,
    updateToken,
    getToken,
    isTokenExpired,
  }), [
    state,
    login,
    logout,
    register,
    refreshSession,
    hasRole,
    hasPermission,
    hasAnyRole,
    hasAllRoles,
    updateToken,
    getToken,
    isTokenExpired,
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// HOC for protected routes
export const withAuth = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: {
    requiredRoles?: string[];
    requiredPermissions?: string[];
    redirectTo?: string;
  }
) => {
  const WithAuthComponent: React.FC<P> = (props) => {
    const { isAuthenticated, isLoading, hasRole, hasPermission, login } = useAuth();

    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        login(options?.redirectTo);
      }
    }, [isLoading, isAuthenticated, login]);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (!isAuthenticated) {
      return null;
    }

    // Check required roles
    if (options?.requiredRoles?.length) {
      const hasRequiredRoles = options.requiredRoles.some((role) => hasRole(role));
      if (!hasRequiredRoles) {
        return (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
              <p className="text-gray-600 mt-2">You don&apos;t have permission to access this page.</p>
            </div>
          </div>
        );
      }
    }

    // Check required permissions
    if (options?.requiredPermissions?.length) {
      const hasRequiredPermissions = options.requiredPermissions.every((perm) => hasPermission(perm));
      if (!hasRequiredPermissions) {
        return (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
              <p className="text-gray-600 mt-2">You don&apos;t have the required permissions.</p>
            </div>
          </div>
        );
      }
    }

    return <WrappedComponent {...props} />;
  };

  WithAuthComponent.displayName = `WithAuth(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return WithAuthComponent;
};

// Protected Route Component
export const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  requiredRoles?: string[];
  requiredPermissions?: string[];
  fallback?: React.ReactNode;
}> = ({ children, requiredRoles, requiredPermissions, fallback }) => {
  const { isAuthenticated, isLoading, hasRole, hasPermission, login } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      login();
    }
  }, [isLoading, isAuthenticated, login]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return fallback ? <>{fallback}</> : null;
  }

  // Check required roles
  if (requiredRoles?.length) {
    const hasRequiredRoles = requiredRoles.some((role) => hasRole(role));
    if (!hasRequiredRoles) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
            <p className="text-gray-600 mt-2">You don&apos;t have permission to access this page.</p>
          </div>
        </div>
      );
    }
  }

  // Check required permissions
  if (requiredPermissions?.length) {
    const hasRequiredPermissions = requiredPermissions.every((perm) => hasPermission(perm));
    if (!hasRequiredPermissions) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
            <p className="text-gray-600 mt-2">You don&apos;t have the required permissions.</p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};

export default AuthContext;