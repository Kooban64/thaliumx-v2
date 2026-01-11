import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js API route to proxy /api/auth/login requests to the backend
 * This maintains same-origin policy while forwarding to the backend service
 */
export async function POST(request: NextRequest) {
  try {
    // In Next.js API routes (server-side), always use Docker service name
    // Never use localhost or IP addresses - always use the Docker service name
    // This ensures proper Docker network resolution
    let backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://thaliumx-backend:3002';
    
    // Replace any localhost or IP address with Docker service name
    backendUrl = backendUrl.replace(/https?:\/\/(localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+)(:\d+)?/, 'http://thaliumx-backend:3002');
    
    // If still doesn't contain the service name, force it
    if (!backendUrl.includes('thaliumx-backend')) {
      backendUrl = 'http://thaliumx-backend:3002';
    }
    
    const apiUrl = `${backendUrl}/api/auth/login`;

    // Get request body
    const body = await request.json();

    // Forward all headers from the original request
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

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
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Forward the response with the same status code
    const nextResponse = NextResponse.json(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Forward Set-Cookie headers from backend to client
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      nextResponse.headers.set('Set-Cookie', setCookieHeader);
    }

    return nextResponse;
  } catch (error) {
    console.error('Error proxying /api/auth/login:', error);
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

