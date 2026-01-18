# HTTPS Certificate Fix Instructions

## Problem
Browser is redirecting HTTP to HTTPS for localhost, causing `ERR_CERT_AUTHORITY_INVALID` errors.

## Root Cause
The browser has HSTS (HTTP Strict Transport Security) enabled for localhost, forcing HTTPS redirects. The Next.js app is correctly configured to serve HTTP only.

## Solutions Applied

### 1. Next.js Configuration Updates
- ✅ Added HSTS header with `max-age=0` in `next.config.ts` to disable HSTS
- ✅ Added `/token-presale` to public routes in middleware
- ✅ Frontend container restarted

### 2. Browser-Level Fix (REQUIRED)

The redirect is happening at the browser level. You need to clear HSTS for localhost:

#### Chrome/Edge:
1. Open a new tab
2. Navigate to: `chrome://net-internals/#hsts`
3. Scroll down to "Delete domain security policies"
4. Enter `localhost` and click "Delete"
5. Enter `127.0.0.1` and click "Delete" (if needed)
6. Close and reopen the browser
7. Navigate to `http://localhost:3001/token-presale`

#### Firefox:
1. Navigate to: `about:config`
2. Search for: `security.tls.insecure_fallback_hosts`
3. Add `localhost` and `127.0.0.1` to the list
4. Or search for: `dom.security.https_only_mode`
5. Set to `false` for development

#### Alternative: Use Incognito/Private Mode
- Open an incognito/private window
- Navigate to `http://localhost:3001/token-presale`
- HSTS is not applied in incognito mode

#### Alternative: Use IP Address
- Navigate to `http://127.0.0.1:3001/token-presale` instead of `localhost`

## Verification

After clearing HSTS:
1. Navigate to `http://localhost:3001/token-presale`
2. Page should load without HTTPS redirect
3. No certificate errors should appear
4. All CTAs should be clickable

## Production Note

For production, SSL certificates are properly configured through APISIX on port 443. This HTTP-only configuration is only for localhost development.

## Files Modified

1. `docker/frontend/next.config.ts` - Added HSTS header configuration
2. `docker/frontend/src/middleware.ts` - Added `/token-presale` to public routes

## Next Steps

1. Clear HSTS in your browser (see instructions above)
2. Test the token presale page
3. Test registration/login flow
4. Test all CTAs
