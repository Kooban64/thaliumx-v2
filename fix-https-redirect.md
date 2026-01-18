# Fix HTTPS Certificate Issue for Localhost

## Problem
Browser is redirecting HTTP to HTTPS for localhost, causing certificate errors.

## Solutions Applied

### 1. Next.js Configuration
- Added HSTS header with `max-age=0` to disable HSTS for localhost
- Updated `next.config.ts` to prevent forced HTTPS redirects

### 2. Middleware Update
- Added `/token-presale` to public routes
- Removed HTTPS redirect logic (browser handles this, not Next.js)

### 3. Browser-Level Fix (Required)

The redirect is happening at the browser level due to HSTS (HTTP Strict Transport Security). To fix this:

#### Option A: Clear HSTS for localhost (Chrome/Edge)
1. Navigate to `chrome://net-internals/#hsts`
2. Under "Delete domain security policies", enter `localhost`
3. Click "Delete"
4. Also try `127.0.0.1` if needed

#### Option B: Use Incognito/Private Mode
- Open an incognito/private window
- Navigate to `http://localhost:3001/token-presale`
- HSTS is not applied in incognito mode

#### Option C: Use a Different Browser
- Try Firefox or Safari which may not have HSTS cached for localhost

#### Option D: Use IP Address Instead
- Navigate to `http://127.0.0.1:3001/token-presale` instead of `localhost`

## Testing

After clearing HSTS, test:
1. Navigate to `http://localhost:3001/token-presale`
2. Verify page loads without HTTPS redirect
3. Test registration/login flow
4. Test all CTAs

## Production Note

For production, proper SSL certificates should be configured through APISIX (which is already set up on port 443). The localhost HTTP access is only for development.
