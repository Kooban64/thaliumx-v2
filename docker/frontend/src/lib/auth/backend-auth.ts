'use client';

import { logError, ErrorCategory, ErrorSeverity } from '@/lib/services/errorLogger';

/**
 * Backend Authentication Utilities with Zitadel OIDC Support
 * 
 * Handles authentication through backend APIs while using Zitadel tokens.
 * Maintains clean UI abstraction - users don't see Zitadel implementation details.
 */

// Store Zitadel token in memory (not persisted to localStorage for security)
let zitadelToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Store Zitadel token securely in memory
 */
export function setZitadelToken(token: string, expiresIn: number): void {
  zitadelToken = token;
  tokenExpiresAt = Date.now() + (expiresIn * 1000);
}

/**
 * Get current Zitadel token if valid
 */
export function getZitadelToken(): string | null {
  if (zitadelToken && tokenExpiresAt > Date.now() + 60000) { // 1 minute buffer
    return zitadelToken;
  }
  return null;
}

/**
 * Clear stored Zitadel token
 */
export function clearZitadelToken(): void {
  zitadelToken = null;
  tokenExpiresAt = 0;
}

/**
 * Login user with email and password
 * Backend authenticates via Zitadel and returns Zitadel token
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
      } catch (error) {
        // If JSON parsing fails, use status text
        errorMessage = response.statusText || `HTTP ${response.status}`;
      }
      return {
        success: false,
        error: errorMessage
      };
    }

    // Parse successful response
    const data = await response.json();

    // Store Zitadel token from response (backend always returns token, not in cookies)
    // Token is stored in memory and used in Authorization header for all API calls
    if (data.data?.accessToken) {
      setZitadelToken(data.data.accessToken, data.data.expiresIn || 3600);
    } else {
      // Token should always be in response - if missing, it's an error
      return {
        success: false,
        error: 'Authentication token not received from server'
      };
    }

    return { success: true };
  } catch (error: any) {
    logError(
      error,
      ErrorCategory.AUTH,
      ErrorSeverity.MEDIUM,
      { component: 'backend-auth', action: 'login' }
    );
    return {
      success: false,
      error: error.message || 'Network error during login'
    };
  }
}

/**
 * Check if user is authenticated by calling backend profile endpoint
 * Uses Zitadel token in Authorization header (stored in memory)
 */
export async function checkAuth(): Promise<boolean> {
  try {
    const token = getZitadelToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add Zitadel token to Authorization header if available
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('/api/auth/profile', {
      credentials: 'include',
      method: 'GET',
      headers,
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Get current user profile from backend
 */
export async function getCurrentUser(): Promise<any | null> {
  try {
    const token = getZitadelToken();
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
    
    const data = await response.json();
    return data.data?.user || null;
  } catch (error) {
    return null;
  }
}

/**
 * Logout user by calling backend logout endpoint
 */
export async function logout(): Promise<void> {
  try {
    const token = getZitadelToken();
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
  } catch (error) {
    // Ignore errors, still redirect
  }
  
  // Clear stored token
  clearZitadelToken();
  
  // Clear any client-side storage
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.clear();
      localStorage.removeItem('thaliumx_oidc_access_token');
      localStorage.removeItem('thaliumx_oidc_access_token_exp');
    } catch (error) {
      // Ignore storage errors
    }
  }
  
  // Redirect to login
  window.location.href = '/login';
}
