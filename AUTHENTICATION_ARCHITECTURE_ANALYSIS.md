# Authentication Architecture Analysis

## Current State

### ✅ **NO NextAuth** - Confirmed
- NextAuth is **NOT** being used in this codebase
- No `next-auth` package in `package.json`
- No NextAuth configuration files

### ⚠️ **TWO Authentication Systems Running in Parallel**

#### 1. **Backend JWT Authentication** (Currently Active)
- **Location**: `docker/backend/src/services/auth.ts`
- **Flow**: 
  - `LoginForm.tsx` → `apiClient.post('/api/auth/login')` → Backend `AuthService.login()`
  - Backend validates credentials against PostgreSQL database
  - Backend generates JWT tokens (access + refresh)
  - Tokens stored in httpOnly cookies or returned in response
- **Status**: ✅ **This is what's actually being used**

#### 2. **Keycloak SSO** (Initialized but NOT Used)
- **Location**: `docker/frontend/src/lib/auth/AuthContext.tsx`
- **Flow**:
  - `AuthContext` initializes Keycloak JS client on mount
  - `KeycloakAuth.tsx` component exists but is separate
  - **NOT used by `LoginForm.tsx`** - LoginForm bypasses Keycloak entirely
- **Status**: ⚠️ **Dead code - initialized but never actually used for login**

## The Problem

1. **Redundancy**: Two auth systems doing the same thing
2. **Confusion**: Keycloak is configured and initialized but not used
3. **Maintenance burden**: Two systems to maintain
4. **User confusion**: `KeycloakAuth` component exists but doesn't integrate with main login flow

## Why Tests Didn't Catch the Connection Issue

### Root Cause
- **Playwright tests run in Node.js environment** (not real browser)
- Node.js `fetch` can access `localhost:3002` directly
- **Real browser** is subject to:
  - Same-origin policy
  - CORS restrictions
  - Network security restrictions

### Test Environment vs. Browser Environment

```typescript
// In tests (Node.js) - WORKS
const response = await fetch('http://localhost:3002/api/auth/login');

// In browser - FAILS with ERR_CONNECTION_REFUSED
// Browser can't directly access localhost:3002 from localhost:3001
```

### What Tests Should Have Done
1. ✅ Verify API endpoints are reachable from **browser context**
2. ✅ Test actual network requests from Playwright's browser
3. ✅ Check for CORS errors in browser console
4. ✅ Verify Next.js proxy routes work correctly

### Why It Was Missed
- Tests used `fetch` in Node.js context (global-setup.ts)
- Tests didn't verify browser can actually reach endpoints
- Debug test captured the error but we focused on other issues

## Recommendations

### Option 1: **Simplify - Use Only Backend JWT** (Recommended)
**Pros:**
- ✅ Already working
- ✅ Simpler architecture
- ✅ No Keycloak dependency in frontend
- ✅ Full control over auth flow

**Cons:**
- ❌ Lose Keycloak SSO features
- ❌ Need to implement user management ourselves

**Action:**
1. Remove Keycloak JS client from frontend
2. Remove `AuthContext.tsx` Keycloak initialization
3. Keep backend JWT auth (already working)
4. Use Keycloak only for backend user/role management (already done)

### Option 2: **Use Keycloak for Frontend Auth**
**Pros:**
- ✅ SSO capabilities
- ✅ Centralized user management
- ✅ Industry standard

**Cons:**
- ❌ More complex
- ❌ Need to refactor LoginForm to use Keycloak
- ❌ Need to sync Keycloak users with backend database

**Action:**
1. Refactor `LoginForm.tsx` to use Keycloak JS client
2. Remove backend JWT login endpoint (or keep for API-only access)
3. Use Keycloak tokens for all frontend auth

### Option 3: **Hybrid Approach** (Current - Not Recommended)
- Keep both systems
- Use JWT for API access
- Use Keycloak for SSO (if needed later)

**Status:** ⚠️ **Current state - confusing and redundant**

## Recommended Solution

**Go with Option 1: Simplify to Backend JWT Only**

1. **Backend already uses Keycloak** for:
   - User/role management (`KeycloakService`)
   - Realm provisioning
   - User seeding

2. **Frontend should use**:
   - Backend JWT tokens (already working)
   - No Keycloak JS client needed

3. **Clean up**:
   - Remove `keycloak-js` from frontend dependencies
   - Remove Keycloak initialization from `AuthContext.tsx`
   - Remove `KeycloakAuth.tsx` component (or make it optional)
   - Keep backend Keycloak integration for user management

## Test Improvements Needed

1. **Add browser network verification**:
```typescript
test('should verify API endpoints are reachable from browser', async ({ page }) => {
  const response = await page.request.get('/api/auth/profile');
  expect(response.ok()).toBe(true);
});
```

2. **Test actual browser fetch**:
```typescript
test('should handle API errors correctly', async ({ page }) => {
  await page.goto('/auth');
  const result = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/auth/login', { method: 'POST' });
      return { status: res.status, ok: res.ok };
    } catch (error) {
      return { error: error.message };
    }
  });
  // Verify no connection errors
});
```

3. **Monitor network requests in tests**:
```typescript
page.on('requestfailed', (request) => {
  console.error('Request failed:', request.url(), request.failure());
});
```

