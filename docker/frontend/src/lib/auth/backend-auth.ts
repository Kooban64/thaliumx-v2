'use client';

import { logError, ErrorCategory, ErrorSeverity } from '@/lib/services/errorLogger';
import { getAccessToken } from './token-store';
import { clearEntryDomain } from '@/lib/utils/domain-detection';
import type { UserProfile } from '@/stores/userStore';

/**
 * Backend Authentication Utilities with OIDC Support
 *
 * Handles authentication through backend APIs while using OIDC tokens.
 * Maintains clean UI abstraction - users don't see identity-provider implementation details.
 */

export type AuthProvider = 'oidc';

const resolveAuthProvider = (): AuthProvider => 'oidc';

// Store auth token in memory (not persisted to localStorage for security)
let authToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Store OIDC token securely in memory
 */
export function setAuthToken(token: string, expiresIn: number): void {
  authToken = token;
  tokenExpiresAt = Date.now() + (expiresIn * 1000);
}

/**
 * Get current OIDC token if valid
 */
export function getAuthToken(): string | null {
  if (authToken && tokenExpiresAt > Date.now() + 60000) { // 1 minute buffer
    return authToken;
  }

  // OIDC callback stores token via token-store. Mirror as fallback.
  const oidcToken = getAccessToken();
  if (oidcToken) return oidcToken;

  return null;
}

/**
 * Clear stored OIDC token
 */
export function clearAuthToken(): void {
  authToken = null;
  tokenExpiresAt = 0;
}

export const setOidcToken = setAuthToken;
export const getOidcToken = getAuthToken;
export const clearOidcToken = clearAuthToken;
export const getAuthProvider = resolveAuthProvider;

/**
 * Login user with email and password
 * Backend authenticates via OIDC and returns OIDC token
 */
export async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    // Check if response is ok before parsing JSON
    if (!response.ok) {
      // Try to parse error response, but handle cases where it might not be JSON
      let errorMessage = 'Login failed';
      try {
        const errorData = await response.json();
        if (typeof errorData.error === 'string') {
          errorMessage = errorData.error;
        } else if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        } else if (errorData.error?.code) {
          errorMessage = errorData.error.code;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // If JSON parsing fails, use status text
        errorMessage = response.statusText || `HTTP ${response.status}`;
      }
      return {
        success: false,
        error: errorMessage
      };
    }

    // Parse successful response
    const data = (await response.json()) as {
      data?: {
        accessToken?: string;
        expiresIn?: number;
      };
    };

    // Store OIDC token from response (backend always returns token, not in cookies)
    // Token is stored in memory and used in Authorization header for all API calls
    if (data.data?.accessToken) {
      setAuthToken(data.data.accessToken, data.data.expiresIn || 3600);
    } else {
      // Token should always be in response - if missing, it's an error
      return {
        success: false,
        error: 'Authentication token not received from server'
      };
    }

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network error during login';
    logError(
      error,
      ErrorCategory.AUTH,
      ErrorSeverity.MEDIUM,
      { component: 'backend-auth', action: 'login' }
    );
    return {
      success: false,
      error: message
    };
  }
}

/**
 * Check if user is authenticated by calling backend profile endpoint
 * Uses OIDC token in Authorization header (stored in memory)
 */
export async function checkAuth(): Promise<boolean> {
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add OIDC token to Authorization header if available
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // If no token, user is not authenticated (don't make API call)
    if (!token) {
      return false;
    }

    const response = await fetch('/api/auth/profile', {
      credentials: 'include',
      method: 'GET',
      headers,
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get current user profile from backend
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('/api/auth/profile', {
      credentials: 'include',
      method: 'GET',
      headers,
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = (await response.json()) as {
      data?: {
        user?: UserProfile;
      };
    };
    return data.data?.user || null;
  } catch {
    return null;
  }
}

/**
 * Logout user by calling backend logout endpoint
 */
export async function logout(): Promise<void> {
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    await fetch('/api/auth/logout', {
      credentials: 'include',
      method: 'POST',
      headers,
    });
  } catch {
    // Ignore errors, still redirect
  }
  
  // Clear stored token
  clearAuthToken();
  
  // Clear any client-side storage
  if (typeof window !== 'undefined') {
    try {
      clearEntryDomain();
      sessionStorage.clear();
      localStorage.removeItem('thaliumx_oidc_access_token');
      localStorage.removeItem('thaliumx_oidc_access_token_exp');
    } catch {
      // Ignore storage errors
    }
  }
  
  // Redirect to login
  window.location.href = '/login';
}
