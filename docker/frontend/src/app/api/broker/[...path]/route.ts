import { NextRequest, NextResponse } from 'next/server';
import { logApiProxyError } from '@/lib/services/serverErrorLogger';

/**
 * Next.js API route to proxy /api/broker/* requests to the backend
 * Supports all HTTP methods: GET, POST, PUT, DELETE, PATCH
 */
async function proxyRequest(
  request: NextRequest,
  method: string
): Promise<NextResponse> {
  const path = request.nextUrl.pathname.replace('/api/broker', '');
  try {
    // In Next.js API routes (server-side), always use Docker service name
    let backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://thaliumx-backend:3002';
    backendUrl = backendUrl.replace(/https?:\/\/(localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+)(:\d+)?/, 'http://thaliumx-backend:3002');
    if (!backendUrl.includes('thaliumx-backend')) {
      backendUrl = 'http://thaliumx-backend:3002';
    }
    const query = request.nextUrl.search;
    const apiUrl = `${backendUrl}/api/broker${path}${query}`;

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

    // Get request body for POST, PUT, PATCH, DELETE
    let body: string | undefined;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      try {
        body = await request.text();
      } catch {
        // Body might be empty, that's okay
      }
    }

    const response = await fetch(apiUrl, {
      method,
      headers,
      body: body || undefined,
      credentials: 'include',
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch {
    // Log error to backend (production-ready)
    await logApiProxyError(
      error,
      `/api/broker${path}`,
      method,
      { query: request.nextUrl.search }
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

export async function GET(request: NextRequest) {
  return proxyRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, 'POST');
}

export async function PUT(request: NextRequest) {
  return proxyRequest(request, 'PUT');
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request, 'DELETE');
}

export async function PATCH(request: NextRequest) {
  return proxyRequest(request, 'PATCH');
}
