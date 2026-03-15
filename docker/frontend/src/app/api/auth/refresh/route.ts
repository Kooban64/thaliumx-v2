import { NextRequest, NextResponse } from 'next/server';
import { logApiProxyError } from '@/lib/services/serverErrorLogger';

const PROXY_TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 200;
const RETRYABLE_STATUS = new Set([502, 503, 504]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveBackendBaseUrls = (): string[] => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const candidates = [
    envUrl,
    'http://thaliumx-backend:3002',
    'http://localhost:3002',
    'http://127.0.0.1:3002',
  ]
    .map((v) => v.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  return [...new Set(candidates)];
};

/**
 * Refresh token endpoint - proxies to backend to refresh access token.
 * 
 * Backend handles:
 * - Refresh token validation against Redis
 * - Token rotation
 * - New JWT token issuance
 */
const proxyRefreshRequest = async (
  apiUrls: string[], 
  body: string,
  headers: Record<string, string>
): Promise<Response> => {
  let lastError: unknown = null;

  for (const apiUrl of apiUrls) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetch(`${apiUrl}/api/auth/refresh`, {
          method: 'POST',
          headers,
          credentials: 'include',
          signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
          body,
        });

        if (RETRYABLE_STATUS.has(response.status) && attempt < 2) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }

        if (response.status >= 500 && response.status < 600 && apiUrl !== apiUrls[apiUrls.length - 1]) {
          await sleep(RETRY_DELAY_MS);
          break;
        }

        return response;
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Refresh proxy request failed');
};

export async function POST(request: NextRequest) {
  try {
    // Parse the incoming request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_JSON',
            message: 'Request body must be valid JSON',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.refreshToken) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_REFRESH_TOKEN',
            message: 'Refresh token is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Resolve backend URLs
    const apiUrls = resolveBackendBaseUrls();

    // Forward headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Forward tenant ID header
    const tenantId = request.headers.get('x-tenant-id');
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    // Forward request ID for tracing
    const requestId = request.headers.get('x-request-id');
    if (requestId) {
      headers['x-request-id'] = requestId;
    }

    // Make request to backend
    const response = await proxyRefreshRequest(apiUrls, JSON.stringify(body), headers);
    
    const responseText = await response.text();
    const contentType = response.headers.get('content-type') || 'application/json';

    let data: unknown = responseText;
    if (contentType.includes('application/json')) {
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = {
          success: false,
          error: {
            code: 'UPSTREAM_INVALID_JSON',
            message: 'Backend returned invalid JSON payload',
          },
          timestamp: new Date().toISOString(),
        };
      }
    }

    // Forward the response with the same status code
    const nextResponse = NextResponse.json(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Forward Set-Cookie headers from backend to client (for new refresh tokens)
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      nextResponse.headers.set('Set-Cookie', setCookieHeader);
    }

    return nextResponse;
  } catch (error) {
    // Log error for debugging
    console.error('Refresh token proxy error:', error);
    
    // Log error to backend if possible
    await logApiProxyError(
      error,
      '/api/auth/refresh',
      'POST'
    );

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'REFRESH_PROXY_ERROR',
          message: 'Unable to connect to authentication service. Please try again later.',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 502 }
    );
  }
}
