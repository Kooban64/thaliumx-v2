// API Configuration
// In browser: Use relative URLs (Next.js will proxy via API routes)
// In SSR: Use NEXT_PUBLIC_API_URL or default to backend service name
const getApiBaseUrl = (): string => {
  // Always check NEXT_PUBLIC_API_URL first (set at build time)
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  
  if (typeof window !== 'undefined') {
    // Browser: Use relative URLs - Next.js API routes will proxy to backend
    // This maintains same-origin policy and avoids CORS issues
    return '';
  }
  
  // SSR: Use environment variable or default to backend service name
  return envUrl || 'http://thaliumx-backend:3002';
};

const API_BASE_URL = getApiBaseUrl();
const API_TIMEOUT = 10000; // 10 seconds

// Default tenant ID (ThaliumX Platform tenant)
const DEFAULT_TENANT_ID = '10000000-0000-0000-0000-000000000000';

// Get tenant ID from URL params, localStorage, or use default
function getTenantId(): string {
  if (typeof window === 'undefined') return DEFAULT_TENANT_ID;
  
  // Check URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const tenantIdFromUrl = urlParams.get('tenantId');
  if (tenantIdFromUrl) return tenantIdFromUrl;
  
  // Check localStorage
  const tenantIdFromStorage = localStorage.getItem('tenantId');
  if (tenantIdFromStorage) return tenantIdFromStorage;
  
  // Use default
  return DEFAULT_TENANT_ID;
}

// CSRF token management
let csrfToken: string | null = null;

export async function getCSRFToken(): Promise<string> {
  if (csrfToken) return csrfToken;

  try {
    const response = await fetch(`${API_BASE_URL}/api/csrf-token`, {
      credentials: 'include'
    });
    const data = await response.json();
    csrfToken = data.csrfToken;
    return csrfToken!;
  } catch (error) {
    throw error;
  }
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  timestamp: string;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

// Token refresh state management
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

// API Client Class
class ApiClient {
  private baseURL: string;
  private timeout: number;

  constructor(baseURL: string = API_BASE_URL, timeout: number = API_TIMEOUT) {
    this.baseURL = baseURL;
    this.timeout = timeout;
    
    // Set up automatic token pre-refresh
    if (typeof window !== 'undefined') {
      this.setupTokenPreRefresh();
    }
  }

  /**
   * Set up automatic token pre-refresh
   * Checks token expiration and refreshes before it expires
   */
  private setupTokenPreRefresh(): void {
    // Check token status every minute
    setInterval(async () => {
      try {
        // Check if token needs refresh by making a lightweight request
        // If we get 401, token is expired and we should refresh
        const response = await fetch(`${this.baseURL}/api/auth/profile`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'X-Tenant-ID': getTenantId(),
          },
        });

        if (response.status === 401) {
          // Token expired, try to refresh
          await this.refreshTokenIfNeeded();
        }
      } catch (error) {
        // Silently fail - token refresh will happen on next API call
        console.debug('Token pre-refresh check failed:', error);
      }
    }, 60000); // Check every minute
  }

  /**
   * Refresh token if needed (prevents multiple simultaneous refresh calls)
   */
  private async refreshTokenIfNeeded(): Promise<boolean> {
    // Prevent multiple simultaneous refresh calls
    if (isRefreshing && refreshPromise) {
      return refreshPromise;
    }

    isRefreshing = true;
    refreshPromise = (async () => {
      try {
        // Call refresh endpoint (uses httpOnly cookies)
        const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': getTenantId(),
          },
        });

        if (response.ok) {
          return true;
        }
        return false;
      } catch (error) {
        console.error('Token refresh failed:', error);
        return false;
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryOn401: boolean = true
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Tenant-ID': getTenantId(), // Always include tenant ID
    };

    // Add CSRF token for non-GET requests
    if (options.method && options.method !== 'GET') {
      try {
        const csrfToken = await getCSRFToken();
        defaultHeaders['X-CSRF-Token'] = csrfToken;
      } catch (error) {
        console.warn('Failed to get CSRF token:', error);
      }
    }

    const config: RequestInit = {
      ...options,
      credentials: 'include', // Always include cookies
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle token expiration (401) - automatically refresh and retry
      if (response.status === 401 && retryOn401 && endpoint !== '/api/auth/refresh' && endpoint !== '/api/auth/login') {
        const refreshed = await this.refreshTokenIfNeeded();
        if (refreshed) {
          // Retry the original request once
          return this.request<T>(endpoint, options, false);
        }
      }

      // Handle both success and error responses
      const data = await response.json();
      
      if (!response.ok) {
        // Backend returns structured error format
        return {
          success: false,
          error: data.error?.message || data.message || `HTTP ${response.status}: ${response.statusText}`,
          message: data.error?.message || data.message || `HTTP ${response.status}: ${response.statusText}`,
          code: data.error?.code || 'HTTP_ERROR',
          timestamp: data.timestamp || new Date().toISOString(),
        };
      }

      // Backend returns { success: true, data: ... } format
      if (data.success === false) {
        return {
          success: false,
          error: data.error?.message || data.message || 'Request failed',
          message: data.error?.message || data.message || 'Request failed',
          code: data.error?.code || 'REQUEST_FAILED',
          timestamp: data.timestamp || new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: data.data || data, // Handle both { data: ... } and direct response
        timestamp: data.timestamp || new Date().toISOString(),
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }

      throw new Error('Unknown error occurred');
    }
  }

  // HTTP Methods
  async get<T>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'GET',
      headers,
    });
  }

  async post<T>(
    endpoint: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers,
    });
  }

  async put<T>(
    endpoint: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      headers,
    });
  }

  async delete<T>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      headers,
    });
  }

  // Health Check
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.get('/health');
  }

  // API Documentation
  async getApiDocs(): Promise<ApiResponse<any>> {
    return this.get('/api/docs');
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Export types and client
export default apiClient;
