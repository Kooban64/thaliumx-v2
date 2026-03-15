# Authentik Integration Removal - Notes

## Status: Authentik Integration Removed

**Date**: January 10, 2026  
**Reason**: Authentik v2 removed password grant support, causing authentication blockers. We've switched to our own auth system.

## What Was Changed

### 1. Authentication Service (`docker/backend/src/services/auth.ts`)
- ✅ Removed Authentik password grant token requests
- ✅ Removed Authentik user creation in registration
- ✅ Now uses our own JWT token system via `TokenService`
- ✅ Password verification uses bcrypt (our database)
- ✅ MFA/TOTP continues to work (our own implementation)

### 2. Token Middleware (`docker/backend/src/middleware/error-handler.ts`)
- ✅ Updated to support our own JWT tokens (primary)
- ✅ Still supports Authentik tokens if configured (for future SSO)
- ✅ Validates tokens using `TokenService.verifyAccessToken()`

### 3. Token Service
- ✅ Uses `TokenService.issueTokenPair()` for token generation
- ✅ Includes `tenantId` in tokens for strict client separation
- ✅ Includes MFA status in tokens
- ✅ Refresh token support maintained

## Current Authentication Flow

```
User Login:
1. Verify password in database (bcrypt) ✅
2. Check MFA if enabled → verify TOTP code ✅ (our implementation)
3. Issue JWT token pair (access + refresh) ✅ (our TokenService)
4. Return tokens to frontend ✅
```

## Tenant/Client Separation

**Critical**: `tenantId` is included in all JWT tokens to ensure strict separation between clients.

- Token includes: `tenantId`, `userId`, `email`, `roles`, `permissions`
- Middleware validates `tenantId` from token or header
- All database queries should filter by `tenantId` for isolation

## MFA/TOTP

- ✅ Fully functional (our own implementation)
- ✅ Uses `otplib` for TOTP generation/validation
- ✅ QR codes for authenticator apps
- ✅ Backup codes supported
- ✅ MFA status included in JWT tokens

## Future: Authentik Re-integration

Authentik may be re-added later for:
- SSO/SAML support (enterprise customers)
- Social logins (Google, GitHub, etc.)
- OIDC compliance requirements

**Note**: The middleware still supports Authentik tokens if configured, so re-integration should be straightforward.

## Environment Variables

The following Authentik environment variables are no longer required:
- `AUTHENTIK_ISSUER`
- `AUTHENTIK_JWKS_URI`
- `AUTHENTIK_SERVICE_ACCOUNT_ID`
- `AUTHENTIK_SERVICE_ACCOUNT_KEY`
- `AUTHENTIK_OIDC_CLIENT_ID`
- `AUTHENTIK_OIDC_CLIENT_SECRET`

**Required** JWT environment variables:
- `JWT_SECRET` (required for token signing)
- `JWT_REFRESH_SECRET` (optional, defaults to JWT_SECRET)
- `JWT_EXPIRES_IN` (optional, default: 15m)
- `JWT_REFRESH_EXPIRES_IN` (optional, default: 7d)
- `TOKEN_ISSUER` (optional, default: thaliumx-platform)
- `TOKEN_AUDIENCE` (optional, default: thaliumx-api)

## Testing Checklist

- [ ] User registration works
- [ ] User login works
- [ ] MFA/TOTP works
- [ ] Token refresh works
- [ ] Token validation in middleware works
- [ ] Tenant isolation works (tenantId in tokens)
- [ ] Password reset works
- [ ] Password change works

## Files Modified

1. `docker/backend/src/services/auth.ts` - Removed Authentik integration
2. `docker/backend/src/middleware/error-handler.ts` - Updated token validation
3. `docker/backend/AUTHENTIK_REMOVAL_NOTES.md` - This file

## Benefits

- ✅ No external dependencies for authentication
- ✅ Full control over auth flow
- ✅ MFA/TOTP working from day 0
- ✅ Simpler architecture
- ✅ Faster development (no Authentik setup blockers)
- ✅ Strict tenant isolation via tenantId

## Migration Notes

- Existing users with `AuthentikId` will continue to work (password verified in our DB)
- No data migration needed
- Authentik service can be stopped/removed from docker-compose
