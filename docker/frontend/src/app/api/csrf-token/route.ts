import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy CSRF token requests to backend.
 *
 * Browser clients call `/api/csrf-token` (same-origin), and this route forwards
 * to the backend `/api/csrf-token` endpoint, including cookies.
 */
export async function GET(request: NextRequest) {
  try {
    const backendUrl =
      process.env.NEXT_PUBLIC_API_URL?.replace('localhost', 'thaliumx-backend') ||
      'http://thaliumx-backend:3002';

    const apiUrl = `${backendUrl}/api/csrf-token`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const cookies = request.headers.get('cookie');
    if (cookies) {
      headers['Cookie'] = cookies;
    }

    const tenantId = request.headers.get('x-tenant-id');
    if (tenantId) {
      headers['X-Tenant-ID'] = tenantId;
    }

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    const data = await response.json();

    const nextResponse = NextResponse.json(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      nextResponse.headers.set('Set-Cookie', setCookieHeader);
    }

    return nextResponse;
  } catch (error) {
    console.error('Error proxying /api/csrf-token:', error);
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

