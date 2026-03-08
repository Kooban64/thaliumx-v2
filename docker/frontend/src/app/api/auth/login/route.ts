import { NextRequest, NextResponse } from 'next/server';
import { logApiProxyError } from '@/lib/services/serverErrorLogger';

/**
 * Legacy login endpoint is intentionally disabled.
 * Canonical auth entry is /auth (Keycloak redirect flow).
 */
export async function POST(request: NextRequest) {
  try {
    // Drain/validate JSON payload only to keep API behavior deterministic for callers.
    try {
      await request.json();
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

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'LEGACY_AUTH_DISABLED',
          message: 'Legacy auth is disabled. Use Keycloak via /auth.',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 410 }
    );
  } catch (error) {
    // Log error to backend (production-ready)
    await logApiProxyError(
      error,
      '/api/auth/login',
      'POST'
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
