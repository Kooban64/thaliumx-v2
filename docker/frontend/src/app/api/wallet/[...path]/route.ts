import { NextRequest, NextResponse } from 'next/server';
import { logApiProxyError } from '@/lib/services/serverErrorLogger';

/**
 * Wallet API Proxy Route
 * Proxies wallet-related API requests to the backend
 */
const getBackendUrl = () => {
  let backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://thaliumx-backend:3002';
  backendUrl = backendUrl.replace(/https?:\/\/(localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+)(:\d+)?/, 'http://thaliumx-backend:3002');
  if (!backendUrl.includes('thaliumx-backend')) {
    backendUrl = 'http://thaliumx-backend:3002';
  }
  return backendUrl;
};

/**
 * Wallet API Proxy Route
 * Proxies wallet-related API requests to the backend
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const backendUrl = getBackendUrl();
    const params = await context.params;
    const path = params.path.join('/');
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const url = `${backendUrl}/api/wallet/${path}${queryString ? `?${queryString}` : ''}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const cookies = request.headers.get('cookie');
    if (cookies) {
      headers['Cookie'] = cookies;
    }

    const tenantId = request.headers.get('x-tenant-id');
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    // Log error to backend (production-ready)
    await logApiProxyError(
      error,
      '/api/wallet',
      'GET',
      { path: request.nextUrl.pathname }
    );
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch wallet data';
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PROXY_ERROR',
          message: errorMessage,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const backendUrl = getBackendUrl();
    const params = await context.params;
    const path = params.path.join('/');
    const body = await request.json().catch(() => null);
    const url = `${backendUrl}/api/wallet/${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const cookies = request.headers.get('cookie');
    if (cookies) {
      headers['Cookie'] = cookies;
    }

    const tenantId = request.headers.get('x-tenant-id');
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    // Log error to backend (production-ready)
    await logApiProxyError(
      error,
      '/api/wallet',
      'POST',
      { path: request.nextUrl.pathname }
    );
    const errorMessage = error instanceof Error ? error.message : 'Failed to process wallet request';
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PROXY_ERROR',
          message: errorMessage,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const backendUrl = getBackendUrl();
    const params = await context.params;
    const path = params.path.join('/');
    const url = `${backendUrl}/api/wallet/${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const cookies = request.headers.get('cookie');
    if (cookies) {
      headers['Cookie'] = cookies;
    }

    const tenantId = request.headers.get('x-tenant-id');
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    const response = await fetch(url, {
      method: 'DELETE',
      headers,
      credentials: 'include',
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    // Log error to backend (production-ready)
    await logApiProxyError(
      error,
      '/api/wallet',
      'DELETE',
      { path: request.nextUrl.pathname }
    );
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete wallet resource';
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'PROXY_ERROR',
          message: errorMessage,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
