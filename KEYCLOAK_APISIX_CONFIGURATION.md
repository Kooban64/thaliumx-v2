# Keycloak and APISIX Configuration

## Current Configuration Status

### Keycloak Configuration

#### Current Realm Names (from core.env):
- **Platform Realm**: `thaliumx-platform` (configured but user wants `platform`)
- **Default Tenant Realm**: `thaliumx-default-tenant` (configured but user wants `platform-default-tenant`)

#### Realm Initialization:
- Both realms are automatically created by `KeycloakService.initializePlatformRealm()` and `KeycloakService.initializeDefaultTenantRealm()`
- Realms are created on backend startup if they don't exist
- Currently **NO users are seeded** - realms are created empty

#### Platform Realm Roles (from RBACService):
The following roles are defined for platform management:
1. **platform-admin** - Full platform access with tenant lifecycle management
2. **platform-compliance** - Global compliance rules and oversight
3. **platform-finance** - Platform financial operations and treasury management
4. **platform-support** - Platform-wide support operations
5. **platform-risk** - Platform-wide risk management
6. **platform-content** - Platform content and documentation

#### Current Issues:
- Realm names don't match production requirements (`platform` and `platform-default-tenant`)
- No users are seeded with IDs in the platform realm
- No roles are created in Keycloak realms (only defined in RBACService)

### APISIX Configuration

#### Current Setup:
- **Admin API**: `http://thaliumx-apisix:9180`
- **Admin Key**: `edd1c9f034335f136f87ad84b625c8f1` (from environment)
- **Public Ports**: 80 (HTTP), 443 (HTTPS)
- **Admin Port**: 9180

#### Routes:
- Routes are configured via scripts in `docker/gateway/scripts/`
- Main routes:
  - Frontend upstream (thaliumx-frontend:3000)
  - Backend upstream (thaliumx-backend:3002)
  - WebSocket upstream (for real-time trading)

#### Current Issues:
- Routes may not be configured for Keycloak authentication
- No OpenID Connect plugin configuration for realm-based authentication
- Routes need to be updated to use correct realm names

## Production Requirements

### Required Realms:
1. **`platform`** - Platform administration realm
   - Users: Platform administrators, compliance officers, finance managers, support staff, risk managers, content managers
   - Roles: All platform roles (platform-admin, platform-compliance, platform-finance, platform-support, platform-risk, platform-content)
   - **All user IDs must be seeded**

2. **`platform-default-tenant`** - Default tenant realm
   - Users: Tenant users, traders, investors
   - Roles: Tenant-specific roles (broker-admin, broker-user, trader, investor, etc.)

### Implementation Status:

#### ✅ Completed:
1. **Environment Variables Updated**: Changed realm names to `platform` and `platform-default-tenant` in `docker/core/core.env`
2. **Platform Roles Creation**: Added `createPlatformRoles()` method to create all platform roles in Keycloak
3. **Platform Users Seeding**: Added `seedPlatformUsers()` method to seed users with specific IDs:
   - `00000000-0000-0000-0000-000000000001` - platform-admin (Platform Administrator)
   - `00000000-0000-0000-0000-000000000002` - platform-compliance (Compliance Officer)
   - `00000000-0000-0000-0000-000000000003` - platform-finance (Finance Manager)
   - `00000000-0000-0000-0000-000000000004` - platform-support (Support Manager)
   - `00000000-0000-0000-0000-000000000005` - platform-risk (Risk Manager)
   - `00000000-0000-0000-0000-000000000006` - platform-content (Content Manager)

#### 🔄 Pending:
1. **APISIX Keycloak Integration**: Configure APISIX routes to use Keycloak OpenID Connect plugin
2. **Realm JSON Export**: Create realm JSON files for backup/import
3. **Password Configuration**: Set secure passwords via environment variables

### Platform Users Configuration:

All platform users are seeded with:
- **Predefined UUIDs** stored in user attributes (`platform.user.id`)
- **Default passwords** (configurable via environment variables):
  - `PLATFORM_ADMIN_PASSWORD` (default: `PlatformAdmin2025!`)
  - `PLATFORM_COMPLIANCE_PASSWORD` (default: `Compliance2025!`)
  - `PLATFORM_FINANCE_PASSWORD` (default: `Finance2025!`)
  - `PLATFORM_SUPPORT_PASSWORD` (default: `Support2025!`)
  - `PLATFORM_RISK_PASSWORD` (default: `Risk2025!`)
  - `PLATFORM_CONTENT_PASSWORD` (default: `Content2025!`)

### APISIX Configuration:

#### Current Routes:
- Frontend upstream: `thaliumx-frontend:3000`
- Backend upstream: `thaliumx-backend:3002`
- WebSocket upstream: `thaliumx-backend:3002`

#### Required APISIX Configuration:
1. **OpenID Connect Plugin**: Configure for both realms
2. **Route Protection**: Protect API routes with Keycloak authentication
3. **Realm-based Routing**: Route requests to appropriate realm based on path/domain

