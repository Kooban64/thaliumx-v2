import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js API route to proxy /api/admin/* requests to the backend
 */
export async function GET(request: NextRequest) {
  try {
    // In Next.js API routes (server-side), always use Docker service name
    let backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://thaliumx-backend:3002';
    backendUrl = backendUrl.replace(/https?:\/\/(localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+)(:\d+)?/, 'http://thaliumx-backend:3002');
    if (!backendUrl.includes('thaliumx-backend')) {
      backendUrl = 'http://thaliumx-backend:3002';
    }
    const path = request.nextUrl.pathname.replace('/api/admin', '');
    const query = request.nextUrl.search;
    const apiUrl = `${backendUrl}/api/admin${path}${query}`;

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

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error proxying /api/admin:', error);
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
