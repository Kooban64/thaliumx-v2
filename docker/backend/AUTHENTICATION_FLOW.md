# Authentication Flow - Seamless User Experience

## Overview

The authentication system provides a **seamless, backend-driven experience** where users never see Zitadel or any backend implementation details. All authentication happens through our backend APIs.

## User Journey: Landing → Login → Dashboard

```
┌─────────────┐
│ Landing Page│
│  (/)        │
└──────┬──────┘
       │
       │ User clicks "Launch App" or "Sign In"
       ▼
┌─────────────┐
│ Login Page  │
│ (/login)    │
└──────┬──────┘
       │
       │ User enters email/password
       │ (Clean UI - no Zitadel branding)
       ▼
┌─────────────────────────────────┐
│ Backend API: /api/auth/login    │
│                                  │
│ 1. Authenticates via Zitadel     │
│    Management API (password)     │
│                                  │
│ 2. Gets Zitadel OIDC token      │
│    (password grant flow)         │
│                                  │
│ 3. Returns Zitadel token to     │
│    frontend (or sets in cookie)  │
└──────┬───────────────────────────┘
       │
       │ Zitadel token returned
       ▼
┌─────────────┐
│  Dashboard │
│ (/dashboard)│
│             │
│ All API     │
│ calls use   │
│ Zitadel     │
│ token       │
└─────────────┘
```

## Key Principles

### ✅ No Zitadel Handoffs
- **No redirects to Zitadel UI**
- **No OIDC authorization endpoints exposed to users**
- **No Zitadel branding or implementation details visible**

### ✅ Backend API-Driven
- Frontend calls backend `/api/auth/login` with email/password
- Backend uses Zitadel Management API to authenticate
- Backend gets Zitadel OIDC token via password grant
- Backend returns token to frontend (or sets in httpOnly cookie)

### ✅ Seamless Experience
- User sees clean, professional login/register UI
- No knowledge of Zitadel, OIDC, or backend implementation
- Smooth flow from landing page → login → dashboard

## Technical Flow

### 1. Landing Page (`/`)
```typescript
// Checks authentication via backend API
const isAuthenticated = await checkBackendAuth();
// Redirects to /login if not authenticated
// Redirects to /dashboard if authenticated
```

### 2. Login Page (`/login`)
```typescript
// User enters credentials in clean UI
// Frontend calls: POST /api/auth/login
// Backend:
//   - Authenticates via Zitadel Management API
//   - Gets Zitadel OIDC token
//   - Returns token (or sets in cookie)
// Frontend redirects to dashboard
```

### 3. Dashboard (`/dashboard`)
```typescript
// Checks authentication via backend API
const isAuthenticated = await checkBackendAuth();
// All API calls include Zitadel token in Authorization header
// Backend validates Zitadel JWT via middleware
```

## Backend Authentication Flow

```
User Credentials
      │
      ▼
┌─────────────────────────────────────┐
│ AuthService.login(email, password)  │
└──────┬──────────────────────────────┘
       │
       │ 1. Verify user exists in database
       ▼
┌─────────────────────────────────────┐
│ ZitadelApiService.authenticateUser()│
│ (Management API - password verify)  │
└──────┬──────────────────────────────┘
       │
       │ 2. Get Zitadel OIDC token
       ▼
┌─────────────────────────────────────┐
│ ZitadelApiService.getUserToken()    │
│ (Password grant - OIDC token)      │
└──────┬──────────────────────────────┘
       │
       │ 3. Return Zitadel token
       ▼
┌─────────────────────────────────────┐
│ Frontend receives Zitadel token     │
│ (Stored in memory or cookie)        │
└─────────────────────────────────────┘
```

## API Request Flow

```
Frontend Request
      │
      │ Authorization: Bearer <Zitadel-JWT>
      │ (or httpOnly cookie with Zitadel-JWT)
      ▼
┌─────────────────────────────────────┐
│ authenticateToken Middleware         │
│                                      │
│ 1. Extract token from:               │
│    - Authorization header (Bearer)   │
│    - Cookie (accessToken)            │
│                                      │
│ 2. Validate Zitadel JWT:              │
│    - Decode token                    │
│    - Verify issuer (Zitadel)         │
│    - Verify signature (JWKS)          │
│    - Check expiration                │
│                                      │
│ 3. Extract user info from claims      │
│    - userId, email, roles, tenantId  │
│                                      │
│ 4. Attach to req.user                │
└──────┬───────────────────────────────┘
       │
       │ req.user populated
       ▼
┌─────────────────────────────────────┐
│ Route Handler                        │
│ (Has access to authenticated user)   │
└─────────────────────────────────────┘
```

## Security Features

### ✅ Service Account Credentials
- **Stored in HashiCorp Vault** (secure)
- Falls back to environment variables if Vault unavailable
- Never logged or exposed

### ✅ Token Security
- Zitadel tokens validated via JWKS (public key)
- Tokens stored in httpOnly cookies (XSS protection)
- Or in-memory storage (not localStorage)

### ✅ No Implementation Exposure
- Users never see Zitadel UI
- No OIDC discovery endpoints called from frontend
- No Zitadel branding or references

## MFA/TOTP Support

MFA is handled seamlessly:
1. User enters email/password
2. Backend checks if MFA enabled
3. If MFA required, backend returns MFA challenge
4. Frontend shows MFA input (clean UI)
5. User enters TOTP code
6. Backend verifies with Zitadel
7. Complete authentication

## Future SSO Support

The architecture is SSO-ready:
- OIDC flow already implemented
- Can add SSO providers without changing user experience
- Backend handles all OIDC complexity

## Verification Checklist

- ✅ Landing page uses backend auth (no Zitadel handoff)
- ✅ Login page uses backend API (no Zitadel handoff)
- ✅ Dashboard uses backend auth (no Zitadel handoff)
- ✅ All API calls use Zitadel tokens
- ✅ Backend validates Zitadel JWTs
- ✅ Service account credentials in Vault
- ✅ Clean UI (no Zitadel branding)
- ✅ Seamless user experience

## Files Modified

### Backend
- `services/zitadel-api.service.ts` - Vault credential loading
- `services/auth.ts` - Zitadel token generation
- `middleware/error-handler.ts` - Cookie support for Zitadel tokens
- `routes/auth-router.ts` - Enabled login/register endpoints

### Frontend
- `lib/auth/backend-auth.ts` - Zitadel token management
- `components/auth/LoginForm.tsx` - Backend API login
- `lib/api/client.ts` - Zitadel token in Authorization header
- `app/auth/AuthClient.tsx` - Redirects to login (no handoff)
- All pages updated to use backend auth

## Documentation

- `ZITADEL_VAULT_SETUP.md` - Guide for storing credentials in Vault
- `AUTHENTICATION_FLOW.md` - This document
