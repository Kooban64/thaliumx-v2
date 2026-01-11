import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js API route to proxy /api/auth/profile requests to the backend
 * This maintains same-origin policy while forwarding to the backend service
 */
export async function GET(request: NextRequest) {
  try {
    // In Next.js API routes (server-side), always use Docker service name
    // Never use localhost or IP addresses - always use the Docker service name
    let backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://thaliumx-backend:3002';
    backendUrl = backendUrl.replace(/https?:\/\/(localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+)(:\d+)?/, 'http://thaliumx-backend:3002');
    if (!backendUrl.includes('thaliumx-backend')) {
      backendUrl = 'http://thaliumx-backend:3002';
    }
    const apiUrl = `${backendUrl}/api/auth/profile`;

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

    // Make request to backend
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    const data = await response.json();

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
    console.error('Error proxying /api/auth/profile:', error);
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

