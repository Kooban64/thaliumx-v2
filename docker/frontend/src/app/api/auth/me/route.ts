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

const proxyMeRequest = async (apiUrls: string[], headers: Record<string, string>): Promise<Response> => {
  let lastError: unknown = null;

  for (const apiUrl of apiUrls) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers,
          credentials: 'include',
          signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
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

  throw lastError instanceof Error ? lastError : new Error('Auth me proxy request failed');
};

/**
 * Next.js API route to proxy /api/auth/me requests to /api/auth/profile on the backend
 * This maintains same-origin policy while forwarding to the backend service
 */
export async function GET(request: NextRequest) {
  try {
    // In Next.js API routes (server-side), always use Docker service name
    const apiUrls = resolveBackendBaseUrls().map((backendUrl) => `${backendUrl}/api/auth/profile`);
    // Forward all headers from the original request
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Forward authorization header if present
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    // Forward cookies
    const cookies = request.headers.get('cookie');
    if (cookies) {
      headers['Cookie'] = cookies;
    }

    // Forward tenant ID header
    const tenantId = request.headers.get('x-tenant-id');
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    const response = await proxyMeRequest(apiUrls, headers);
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
    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        // Forward any relevant headers from backend response
        ...(response.headers.get('set-cookie') && {
          'Set-Cookie': response.headers.get('set-cookie')!,
        }),
      },
    });
  } catch (error) {
    // Log error to backend (production-ready)
    await logApiProxyError(
      error,
      '/api/auth/me',
      'GET'
    );
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PROXY_ERROR',
          message: 'Failed to connect to backend service',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 502 }
    );
  }
}
