# Legacy Authentication System Documentation

> **IMPORTANT**: This file contains historical documentation about deprecated authentication systems that were used in earlier versions of ThaliumX. These systems have been replaced by the internal JWT authentication system.

## Deprecated Identity Providers

The following identity providers were previously supported but have been **deprecated and removed** as part of the security hardening initiative:

### 1. Authentik
- **Status**: Deprecated (March 2026)
- **Reason**: Security review identified vulnerabilities
- **Replacement**: Internal JWT authentication

### 2. Keycloak
- **Status**: Never fully implemented
- **Reason**: Architecture decision to use internal JWT
- **Replacement**: Internal JWT authentication

### 3. Zitadel
- **Status**: Deprecated (March 2026)
- **Reason**: Migration to internal JWT authentication
- **Replacement**: Internal JWT authentication

## Migration History

### Authentik → Internal JWT
- Authentik was used as the primary OIDC provider
- Users were linked via `authentik_id` in the users table
- Migration `012-zitadel-migration.ts` was used to rename columns
- All authentication now uses internal JWT tokens

### Zitadel → Internal JWT
- Zitadel was briefly evaluated but never fully deployed
- Database column `zitadel_id` was created but never populated
- Removed in favor of internal JWT

## Files Removed

- `docker/backend/src/services/authentik.ts`
- `docker/backend/src/services/authentik-attributes.service.ts`
- `docker/scripts/init-authentik.sh`
- `docker/compose/prod-v1/authentik/`

## Configuration Changes

The following environment variables are no longer used:
- `AUTHENTIK_ISSUER`
- `AUTHENTIK_JWKS_URI`
- `AUTHENTIK_AUDIENCE`
- `AUTHENTIK_CLIENT_ID`
- `AUTHENTIK_URL`
- `AUTHENTIK_REALM`
- `AUTH_PROVIDER` (set to 'internal-jwt' only)

## Current Authentication System

Please refer to `JWT_AUTH_SETUP.md` for the current JWT authentication system documentation.
