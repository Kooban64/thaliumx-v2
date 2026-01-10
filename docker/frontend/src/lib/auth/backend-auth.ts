'use client';

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

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || data.message || 'Login failed'
      };
    }

    // Store Zitadel token if returned (backend may set it in cookie instead)
    // If token is in cookie, middleware will use it; if in response, store for Authorization header
    if (data.data?.accessToken) {
      setZitadelToken(data.data.accessToken, data.data.expiresIn || 3600);
    } else {
      // Token is in cookie - try to get it from cookie or wait for next API call
      // For now, we'll rely on cookie-based auth, but store a placeholder
      // The actual token will be available via cookie in subsequent requests
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error during login'
    };
  }
}

/**
 * Check if user is authenticated by calling backend profile endpoint
 * Uses Zitadel token in Authorization header or httpOnly cookies
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
  } catch {
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
  } catch {
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
  } catch {
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
    } catch {
      // Ignore storage errors
    }
  }
  
  // Redirect to login
  window.location.href = '/login';
}
