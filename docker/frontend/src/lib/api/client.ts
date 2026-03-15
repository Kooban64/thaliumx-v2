// API Configuration
// In browser: Use relative URLs (Next.js will proxy via API routes)
// In SSR: Use NEXT_PUBLIC_API_URL or default to backend service name
import { getOidcToken } from '@/lib/auth/backend-auth';

const getApiBaseUrl = (): string => {
  // Always check NEXT_PUBLIC_API_URL first (set at build time)
  const envUrl = process.env.NEXT_PUBLIC_API_URL;

  // Normalize common misconfiguration: setting NEXT_PUBLIC_API_URL to ".../api".
  // The frontend code already prefixes requests with `/api/...`, so we must not double it.
  const normalize = (url: string): string => url.replace(/\/+$/, '').replace(/\/api$/, '');

  if (typeof window !== 'undefined') {
    // Browser: Use relative URLs - Next.js API routes will proxy to backend
    // This maintains same-origin policy and avoids CORS issues
    return '';
  }

  // SSR: Use environment variable or default to backend service name
  return normalize(envUrl || 'http://thaliumx-backend:3002');
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

// CSRF token management - not needed for OIDC Bearer token auth
export async function getCSRFToken(): Promise<string> {
  // OIDC Bearer tokens should not depend on backend CSRF cookies.
  return '';
}

function hasAuthorizationHeader(headers?: HeadersInit): boolean {
  if (!headers) return false;

  if (headers instanceof Headers) {
    return headers.has('Authorization');
  }

  if (Array.isArray(headers)) {
    return headers.some(([key]) => key.toLowerCase() === 'authorization');
  }

  return Object.keys(headers).some((key) => key.toLowerCase() === 'authorization');
}

// API Response Types
export type ApiRecord = Record<string, unknown>;

export interface ApiResponse<T = ApiRecord> {
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

// Token refresh state management (unused - OIDC handles refresh automatically)
// let isRefreshing = false;
// let refreshPromise: Promise<boolean> | null = null;

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
    // OIDC provider handles token refresh automatically via OIDC flow
    // No need for manual pre-refresh checks
  }

  /**
   * Refresh token if needed (OIDC provider handles this automatically)
   * @deprecated OIDC provider manages token refresh automatically via OIDC flow
   * Method kept for potential future use - prefixed with _ to indicate intentionally unused
   */
   
  // @ts-expect-error - Method kept for future use
  private async _refreshTokenIfNeeded(): Promise<boolean> {
    // OIDC provider manages token refresh automatically via OIDC flow
    return false;
  }

  private determineEndpointType(url: string): string {
    if (url.includes('/auth')) return 'auth';
    if (url.includes('/financial') || url.includes('/fiat') || url.includes('/wallet') || url.includes('/transaction')) return 'financial';
    if (url.includes('/trading') || url.includes('/exchange') || url.includes('/order')) return 'trading';
    if (url.includes('/support')) return 'support';
    return 'api';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
    // _retryOn401: boolean = true // Reserved for future retry logic (prefixed with _ to indicate intentionally unused)
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Tenant-ID': getTenantId(), // Always include tenant ID
    };

    // Attach OIDC Bearer token when available.
    const oidcToken = typeof window !== 'undefined' ? getOidcToken() : null;
    if (oidcToken && !hasAuthorizationHeader(options.headers)) {
      defaultHeaders['Authorization'] = `Bearer ${oidcToken}`;
    }

    // CSRF tokens not needed for Bearer token authentication

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

      // Handle token expiration (401) - OIDC flow handles refresh automatically
      // No manual refresh needed as provider manages token lifecycle

      // Extract rate limit headers and dispatch event
      const rateLimitLimit = response.headers.get('X-RateLimit-Limit');
      const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
      const rateLimitReset = response.headers.get('X-RateLimit-Reset');
      
      if (rateLimitLimit && rateLimitRemaining !== null && typeof window !== 'undefined') {
        const endpointType = this.determineEndpointType(url);
        const rateLimitInfo = {
          maxRequests: parseInt(rateLimitLimit),
          windowSeconds: 60, // Could be extracted from header if available
          currentRequests: parseInt(rateLimitLimit) - parseInt(rateLimitRemaining),
          remainingRequests: parseInt(rateLimitRemaining),
          resetTime: rateLimitReset ? new Date(rateLimitReset) : new Date(Date.now() + 60000),
          endpointType,
          role: 'user', // Would come from user context
          kycLevel: 'basic' // Would come from user context
        };
        
        // Dispatch custom event for rate limit display components
        window.dispatchEvent(new CustomEvent('rateLimitUpdate', {
          detail: rateLimitInfo
        }));
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
  async get<T = ApiRecord>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'GET',
      headers,
    });
  }

  async post<T = ApiRecord>(
    endpoint: string,
    data?: unknown,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers,
    });
  }

  async put<T = ApiRecord>(
    endpoint: string,
    data?: unknown,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      headers,
    });
  }

  async delete<T = ApiRecord>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
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
  async getApiDocs(): Promise<ApiResponse<unknown>> {
    return this.get('/api/docs');
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Export types and client
export default apiClient;
