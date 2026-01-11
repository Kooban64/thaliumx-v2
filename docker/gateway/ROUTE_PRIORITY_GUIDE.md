# APISIX Route Priority Guide

## Overview

This document defines the route priority hierarchy for APISIX to ensure authentication endpoints are always protected and never interfered with by new routes.

## Critical Route Priorities

### Priority 100 (Highest - Matches First)
- **Route 6**: `/api/auth/login`, `/api/auth/register`, `/api/auth/reset-password`, `/api/auth/confirm-reset`
  - **MUST NEVER** have OIDC plugin
  - **MUST ALWAYS** be public (no authentication required)
  - **MUST ALWAYS** have priority 100 or higher
  - These are critical authentication endpoints that users need to access before they have tokens

- **Route 5**: `/health` (health check endpoint)

### Priority 95
- **Route 12**: Auth redirects (thaliumx.com/auth/*)

### Priority 25
- **Route 7**: `/api/financial/*` (financial endpoints with OPA)

### Priority 22
- **Route 41**: `/api/*` with OIDC protection (only when `APISIX_ENABLE_OIDC=true`)
  - **IMPORTANT**: This route has `unauth_action: "pass"` to allow unauthenticated requests
  - Route 6's higher priority (100) ensures auth endpoints match Route 6 first
  - This route should NOT interfere with `/api/auth/*` endpoints

### Priority 20
- **Route 4**: General `/api/*` endpoints (fallback for non-protected API calls)

### Priority 10
- **Route 2**: www.thaliumx.com redirect
- **Route 30**: thal.thaliumx.com general paths

## Rules for Adding New Routes

### ✅ DO:
1. **Always check existing priorities** before adding a new route
2. **Use priorities < 100** for routes that match `/api/*` patterns
3. **Test login/register** after adding any new route that matches `/api/*`
4. **Document route priorities** in comments when creating routes
5. **Use specific URI patterns** instead of broad wildcards when possible

### ❌ DON'T:
1. **NEVER create routes with priority >= 100** that match `/api/auth/login`, `/api/auth/register`, etc.
2. **NEVER add OIDC plugin** to routes matching `/api/auth/*` endpoints
3. **NEVER use priority 100** for routes that could interfere with auth endpoints
4. **NEVER modify Route 6's priority** to be lower than 100
5. **NEVER remove Route 6** or its auth endpoint URIs

## Route 6 Protection

Route 6 is the **critical authentication route** and must be protected:

```bash
# Route 6 Configuration
{
  "id": "6",
  "priority": 100,  # HIGHEST PRIORITY
  "uris": [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/reset-password",
    "/api/auth/confirm-reset"
  ],
  "plugins": {
    # NO openid-connect plugin
    # Only: CORS, rate limiting, security plugins
  }
}
```

## Route 41 (OIDC) Safeguards

When `APISIX_ENABLE_OIDC=true`, Route 41 is created with:

1. **Priority 22** (lower than Route 6's 100)
2. **`unauth_action: "pass"`** in OIDC plugin (allows unauthenticated requests)
3. **URI pattern `/api/*`** but Route 6 matches first due to higher priority

This ensures:
- Auth endpoints (Route 6, priority 100) match first
- Other API endpoints can be OIDC-protected
- Unauthenticated requests to auth endpoints pass through

## Testing After Route Changes

After adding or modifying routes, always test:

```bash
# Test login endpoint (should return 200, not 401)
curl -X POST https://thaliumx.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Test register endpoint (should return 200, not 401)
curl -X POST https://thaliumx.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

## Priority Hierarchy Summary

```
Priority 100: Route 6 (auth endpoints), Route 5 (health)
Priority 95:  Route 12 (auth redirects)
Priority 25:  Route 7 (financial)
Priority 22:  Route 41 (OIDC /api/*) - only if enabled
Priority 20:  Route 4 (general /api/*)
Priority 10:  Route 2, Route 30 (redirects, general paths)
```

## Maintenance

- Review this document when adding new routes
- Update priorities if needed, but **never lower Route 6's priority**
- Document any exceptions or special cases
- Test authentication flows after any route changes
