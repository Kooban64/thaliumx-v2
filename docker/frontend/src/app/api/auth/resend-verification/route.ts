import { NextRequest, NextResponse } from 'next/server';
import { logApiProxyError } from '@/lib/services/serverErrorLogger';

const PROXY_TIMEOUT_MS = 8000;

const resolveBackendBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || '';
  if (envUrl.includes('localhost') || envUrl.includes('127.0.0.1')) {
    return 'http://thaliumx-backend:3002';
  }
  return envUrl || 'http://thaliumx-backend:3002';
};

/**
 * Resend verification email endpoint - proxies to backend to resend verification email.
 */
export async function POST(request: NextRequest) {
  try {
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

    const { email } = body;

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_EMAIL',
            message: 'Email is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const backendUrl = resolveBackendBaseUrl();
    const response = await fetch(`${backendUrl}/api/auth/resend-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Resend verification proxy error:', error);
    await logApiProxyError(error, '/api/auth/resend-verification', 'POST');
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RESEND_VERIFICATION_ERROR',
          message: 'Unable to resend verification email. Please try again later.',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 502 }
    );
  }
}
