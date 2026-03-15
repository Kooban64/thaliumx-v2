# Authentik Migration Checklist

## Overview
This document outlines the phased migration from Authentik + Zitadel to Authentik for the ThaliumX platform.

## Current Configuration
- **Primary OIDC Provider**: Authentik (auth.thaliumx.com)
- **Secondary OIDC Provider**: Zitadel (workflows-service)
- **Target OIDC Provider**: Authentik (thaliumx.com/application/o/thaliumx/)

## Migration Phases

### Phase 1: Infrastructure Setup (Completed in code)
- [x] Added Authentik service definitions to `docker/compose/prod-v1/identity.yml`
- [x] Added Authentik volume definitions
- [x] Updated `docker/compose/prod-v1/production.yml` to include Authentik services
- [x] Updated gateway OIDC configuration in `docker/compose/prod-v1/gateway.yml`
- [x] Updated APISIX route initialization script

### Phase 2: Service Updates (Completed in code)
- [x] Updated compliance-cex middleware (`docker/compliance-cex/src/middleware/auth.ts`)
- [x] Updated workflows-service middleware (`ballerine/services/workflows-service/src/common/middlewares/zitadel-auth.middleware.ts`)
- [x] Updated workflows-service env schema (`ballerine/services/workflows-service/src/env.ts`)
- [x] Updated backend JWT middleware (`docker/backend/src/middleware/error-handler.ts`)
- [x] Updated backend config service (`docker/backend/src/services/config.ts`)

### Phase 3: Manual Setup Required

#### 3.1 Authentik Tenant Configuration
1. Access Authentik admin UI at `https://thaliumx.com/if/flow/initial/`
2. Complete initial setup wizard
3. CreateOutpost the following:
   - [ ] Create Outpost "ThaliumX" (embedded outpost)
   - [ ] Configure SSL certificates

#### 3.2 Create Applications in Authentik
Create the following Applications in Authentik admin UI:

| Application Name | Slug | Client ID | Redirect URIs |
|-----------------|------|-----------|---------------|
| ThaliumX Backend | thaliumx-backend | thaliumx-backend | https://api.thaliumx.com/* |
| ThaliumX Frontend | thaliumx-frontend | thaliumx-frontend | https://thaliumx.com/oidc/callback |
| ThaliumX Workflows | thaliumx-workflows | thaliumx-workflows | https://workflows.thaliumx.com/* |
| ThaliumX Backoffice | thaliumx-backoffice | thaliumx-backoffice | https://backoffice.thaliumx.com/* |
| ThaliumX APISIX | thaliumx-apisix | thaliumx-apisix | (service account) |

#### 3.3 Create Property Mappings
Create Outpostmappings to ensure consistent claims:

```
# Email to user_id mapping
{
  "name": "ThaliumX User ID",
  "expression": "return user.attributes.get('user_id', user.username)"
}

# Roles mapping (combine group roles)
{
  "name": "ThaliumX Roles",
  "expression": "groups = [g.name for g in user.groups.all()]\nreturn groups"
}

# Tenant ID mapping
{
  "name": "ThaliumX Tenant",
  "expression": "return user.attributes.get('tenant_id', '')"
}
```

#### 3.4 Generate Client Secrets
1. For each application, generate a new client secret
2. Store securely in `.secrets/generated/` directory
3. Update environment variables in docker compose files

### Phase 4: Environment Configuration

#### 4.1 Set Environment Variables
Add the following to your environment (`.env` or secrets):

```bash
# Authentik Configuration
AUTHENTIK_ENABLED=true
AUTHENTIK_ISSUER=https://thaliumx.com/application/o/thaliumx/
AUTHENTIK_JWKS_URI=https://thaliumx.com/application/o/thaliumx/jwks/
AUTHENTIK_CLIENT_ID=thaliumx-backend
AUTHENTIK_CLIENT_SECRET=<generated-secret>

# Frontend Configuration
NEXT_PUBLIC_OIDC_ISSUER=https://thaliumx.com/application/o/thaliumx/
NEXT_PUBLIC_OIDC_CLIENT_ID=thaliumx-frontend

# Gateway Configuration (APISIX)
APISIX_OIDC_ISSUER=https://thaliumx.com/application/o/thaliumx/
APISIX_OIDC_CLIENT_ID=thaliumx-apisix
APISIX_OIDC_CLIENT_SECRET=<generated-secret>
```

#### 4.2 Secrets Setup
Create the following secrets in `docker/secrets/`:
- `authentik-postgres-password`
- `authentik-secret-key`

### Phase 5: Testing

#### 5.1 Infrastructure Test
```bash
# Start Authentik services only
docker compose -f compose/prod-v1/identity.yml up -d authentik authentik-worker authentik-postgres

# Check health
curl https://thaliumx.com/health/ready/
```

#### 5.2 OIDC Discovery Test
```bash
# Verify OIDC metadata
curl https://thaliumx.com/application/o/thaliumx/.well-known/openid-configuration

# Verify JWKS
curl https://thaliumx.com/application/o/thaliumx/jwks/
```

#### 5.3 Client Application Test
1. Test frontend login flow
2. Test backend API authentication
3. Test workflows-service authentication
4. Test APISIX gateway authentication

### Phase 6: Production Rollout

#### 6.1 Pre-deployment Checklist
- [ ] All secrets configured in Vault
- [ ] Authentik applications and property mappings created
- [ ] SSL certificates verified for auth.thaliumx.com
- [ ] Database migrations prepared (if needed)
- [ ] Rollback plan documented

#### 6.2 Deployment Steps
1. Deploy Authentik services first
2. Update gateway to use Authentik OIDC
3. Update backend JWT middleware (USE_AUTHENTIK_JWT=true)
4. Update workflows-service (AUTHENTIK_ENABLED=true)
5. Update frontend environment variables
6. Monitor logs for authentication errors

#### 6.3 Post-deployment Verification
- [ ] Frontend login works
- [ ] Backend API calls authenticated
- [ ] Workflows dashboard accessible
- [ ] Compliance services authenticated
- [ ] APISIX routes protected

### Phase 7: Decommissioning (Post-migration)

#### 7.1 Authentik Decommission
After confirmed Authentik operation:

1. Disable Authentik services:
```bash
docker compose -f compose/prod-v1/production.yml stop Authentik Authentik-postgres
```

2. Export Authentik data if needed for reference

3. Remove Authentik services after 30-day observation period

#### 7.2 Zitadel Decommission
1. Disable Zitadel in workflows-service:
```bash
AUTHENTIK_ENABLED=true
# (Zitadel remains available but unused)
```

2. Remove Zitadel references after confirmation

## Verification Commands

### Test Token Validation
```bash
# Get test token
TOKEN=$(curl -s -X POST https://thaliumx.com/application/o/thaliumx/token/ \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=thaliumx-backend" \
  -d "client_secret=<secret>" | jq -r .access_token)

# Verify token
curl -s https://thaliumx.com/application/o/thaliumx/userinfo/ \
  -H "Authorization: Bearer $TOKEN"
```

### Check Service Authentication
```bash
# Backend
curl -H "Authorization: Bearer $TOKEN" https://api.thaliumx.com/v1/user/me

# Workflows
curl -H "Authorization: Bearer $TOKEN" https://workflows.thaliumx.com/api/v1/workflows

# Compliance
curl -H "Authorization: Bearer $TOKEN" https://compliance.thaliumx.com/api/v1/kyc/status
```

## Rollback Procedure

If issues occur:

1. **Revert Gateway**: Set `USE_AUTHENTIK_JWT=false` in gateway.yml
2. **Revert Backend**: Set `USE_AUTHENTIK_JWT=false` in environment
3. **Revert Frontend**: Update `NEXT_PUBLIC_OIDC_ISSUER` to Authentik URL
4. **Revert Workflows**: Set `AUTHENTIK_ENABLED=false`

## Environment Variable Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `AUTHENTIK_ENABLED` | Enable Authentik auth | `true` |
| `AUTHENTIK_ISSUER` | OIDC issuer URL | `https://thaliumx.com/application/o/thaliumx/` |
| `AUTHENTIK_JWKS_URI` | JWKS endpoint | `https://thaliumx.com/application/o/thaliumx/jwks/` |
| `AUTHENTIK_AUDIENCE` | Expected token audience | `thaliumx-backend` |
| `AUTHENTIK_CLIENT_ID` | Client ID | `thaliumx-backend` |
| `USE_AUTHENTIK_JWT` | Backend uses Authentik | `true` |
| `NEXT_PUBLIC_OIDC_ISSUER` | Frontend OIDC issuer | `https://thaliumx.com/application/o/thaliumx/` |
| `NEXT_PUBLIC_OIDC_CLIENT_ID` | Frontend client ID | `thaliumx-frontend` |
| `APISIX_OIDC_*` | APISIX gateway config | (see gateway.yml) |

## Support

For issues during migration:
1. Check Authentik logs: `docker logs thaliumx-authentik`
2. Check service logs for authentication errors
3. Verify JWKS endpoint is accessible
4. Confirm client credentials are correct
5. Check token claims match expected audience/issuer
