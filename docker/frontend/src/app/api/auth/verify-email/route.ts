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
 * Verify email endpoint - proxies to backend to verify email with token.
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

    const { token } = body;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'Verification token is required',
          },
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const backendUrl = resolveBackendBaseUrl();
    const response = await fetch(`${backendUrl}/api/auth/verify-email`, {
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
    console.error('Verify email proxy error:', error);
    await logApiProxyError(error, '/api/auth/verify-email', 'POST');
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VERIFY_EMAIL_ERROR',
          message: 'Unable to verify email. Please try again later.',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 502 }
    );
  }
}
