# ThaliumX Tenant Dashboard Architecture

## Overview

ThaliumX supports a multi-tenant architecture with three distinct dashboard types:

1. **Platform Admin Dashboard** - For platform-level administrators
2. **Broker Admin Dashboard** - For broker-specific administrators
3. **User Dashboard** - For end-users (traders)

## Dashboard Types

### 1. Platform Admin Dashboard (`/admin`)

**URL:** `https://thaliumx.com/admin`

**Purpose:** Platform-wide administration and oversight

**Roles Required:**
- `super_admin` - Full platform access
- `admin` - Administrative access

**Features:**
- System Health Monitoring
- User & Broker Management
- RBAC & Permissions Management (`/admin/rbac`)
- Policy Management (`/admin/policies`)
- Compliance & Audit Logs
- Platform-wide Analytics
- System Settings

**API Endpoints:**
- `GET /api/admin/dashboard` - Platform dashboard data
- `GET /api/admin/users` - User management
- `GET /api/admin/transactions` - Transaction management
- `GET /api/admin/kyc` - KYC management
- `GET /api/admin/audit-logs` - Audit logs
- `GET /api/admin/health` - System health
- `GET /api/admin/settings` - System settings
- `GET /api/admin/dashboard/platform` - Platform snapshot
- `GET /api/admin/dashboard/broker/:brokerId` - Broker snapshot

### 2. Broker Admin Dashboard (`/broker`)

**URL:** `https://thaliumx.com/broker`

**Purpose:** Broker-specific administration (white-label tenant management)

**Roles Required:**
- `BROKER_ADMIN` - Full broker access
- `BROKER_COMPLIANCE` - Compliance operations
- `BROKER_FINANCE` - Financial operations
- `BROKER_OPERATIONS` - Operational tasks
- `BROKER_TRADING` - Trading oversight
- `BROKER_SUPPORT` - Customer support

**Features:**
- Broker Dashboard Overview
- User Allocations
- Hot Wallet Management
- Compliance & Approvals
- Broker-scoped Analytics
- KYC Management (broker users only)
- Transaction Monitoring (broker users only)
- Audit Logs (broker-scoped)

**API Endpoints:**
- `GET /api/broker/dashboard` - Broker dashboard data
- `GET /api/broker/health` - Broker health status
- `GET /api/broker/metrics` - Broker metrics
- `GET /api/broker/users` - Broker user management
- `GET /api/broker/transactions` - Broker transactions
- `GET /api/broker/kyc` - Broker KYC records
- `GET /api/broker/audit-logs` - Broker audit logs

**Key Differences from Platform Admin:**
- Data is scoped to the broker's users only
- Cannot access other brokers' data
- Limited system configuration access
- Read-only view for most operations

### 3. User Dashboard (`/dashboard`)

**URL:** `https://thaliumx.com/dashboard`

**Purpose:** End-user trading and portfolio management

**Roles Required:**
- `user` - Standard user access

**Features:**
- Trading Interface
- Wallet Management
- Portfolio Overview
- Analytics & Charts
- Account Settings
- Transaction History

**Tabs:**
- **Trading** - Real-time charts, order placement
- **Wallet** - Balance overview, recent transactions
- **Portfolio** - Holdings, performance metrics
- **Analytics** - Trading performance analysis
- **Settings** - Account preferences

## Tenant Types

### Platform Tenant (ThaliumX)
- The main platform tenant
- Manages all brokers and users
- Has access to Platform Admin Dashboard

### Broker Tenant
- White-label broker instance
- Has its own branding and configuration
- Users belong to a specific broker
- Broker admins access Broker Admin Dashboard

### User Tenant Association
- Each user belongs to exactly one tenant
- Users can only see data from their tenant
- Tenant isolation is enforced at the API level

## Route Configuration

### APISIX Gateway Routes

| Route ID | Name | URI | Description |
|----------|------|-----|-------------|
| 1 | thaliumx-main | /* | Main landing page |
| 2 | thaliumx-www-redirect | /* | WWW to non-WWW redirect |
| 3 | thaliumx-presale | /* | Token presale page |
| 4 | thaliumx-api | /api/* | API endpoints |
| 5 | health-check | /health | Health check |
| 6 | platform-admin-dashboard | /admin/* | Platform Admin |
| 7 | broker-admin-dashboard | /broker/* | Broker Admin |
| 8 | user-dashboard | /dashboard/* | User Dashboard |
| 9 | auth-pages | /auth/* | Authentication |
| 10 | portfolio-page | /portfolio/* | Portfolio |
| 11 | vesting-page | /vesting/* | Vesting |
| 12 | landing-page | /landing/* | Landing |
| 13 | websocket-trading | /socket.io/* | WebSocket |
| 14 | broker-api | /api/broker/* | Broker API |
| 15 | admin-api | /api/admin/* | Admin API |
| 16 | metrics-endpoint | /metrics | Prometheus metrics |
| 17 | static-assets | /_next/* | Static assets |
| 18 | public-assets | /public/* | Public assets |
| 19 | favicon | /favicon.ico | Favicon |
| 20 | robots-txt | /robots.txt | Robots.txt |
| 21 | sitemap | /sitemap.xml | Sitemap |
| 22 | rbac-admin | /admin/rbac/* | RBAC Admin |
| 23 | policy-management | /admin/policies/* | Policy Management |
| 24 | broker-subdomain | /* | Broker subdomains |
| 25 | api-docs | /api/docs | API documentation |

## Authentication Flow

### Login Process
1. User navigates to `/auth`
2. Enters credentials (email/password)
3. Backend validates credentials
4. JWT tokens issued (access + refresh)
5. User redirected based on role:
   - `super_admin`/`admin` → `/admin`
   - `BROKER_*` roles → `/broker`
   - `user` → `/dashboard`

### Token Structure
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "role": "user",
  "roles": ["user"],
  "tenantId": "uuid",
  "brokerId": "uuid (optional)",
  "permissions": [],
  "iat": 1234567890,
  "exp": 1234567890
}
```

## Role-Based Access Control (RBAC)

### Platform Roles
| Role | Description | Dashboard Access |
|------|-------------|------------------|
| `super_admin` | Full platform access | Platform Admin |
| `admin` | Administrative access | Platform Admin |
| `compliance` | Compliance operations | Platform Admin (limited) |
| `finance` | Financial operations | Platform Admin (limited) |
| `support` | Customer support | Platform Admin (limited) |

### Broker Roles
| Role | Description | Dashboard Access |
|------|-------------|------------------|
| `BROKER_ADMIN` | Full broker access | Broker Admin |
| `BROKER_COMPLIANCE` | Compliance operations | Broker Admin |
| `BROKER_FINANCE` | Financial operations | Broker Admin |
| `BROKER_OPERATIONS` | Operational tasks | Broker Admin |
| `BROKER_TRADING` | Trading oversight | Broker Admin |
| `BROKER_SUPPORT` | Customer support | Broker Admin |

### User Roles
| Role | Description | Dashboard Access |
|------|-------------|------------------|
| `user` | Standard user | User Dashboard |
| `broker` | Broker user | User Dashboard |

## Broker Onboarding

When a new broker is onboarded:

1. **Tenant Creation**
   - New tenant record created with `tenantType: 'broker'`
   - Broker configuration stored in `tenant.settings`

2. **Keycloak Realm**
   - New realm created: `{broker-slug}-broker`
   - Broker-specific authentication flows

3. **API Credentials**
   - API key generated: `thal_xxxxx`
   - Webhook secret generated

4. **Route Configuration**
   - Broker subdomain configured (optional)
   - Custom domain support (if enabled)

## Security Considerations

### Tenant Isolation
- All API endpoints enforce tenant isolation
- Users can only access data from their tenant
- Broker admins can only see their broker's users

### Rate Limiting
- Admin API: 1000 requests/minute
- Broker API: 500 requests/minute
- User API: 100 requests/minute

### Audit Logging
- All admin actions are logged
- Broker actions are logged with broker context
- User actions are logged with user context

## Frontend Pages

### Platform Admin (`/admin`)
- `page.tsx` - Main admin dashboard
- `/rbac/page.tsx` - RBAC management
- `/policies/page.tsx` - Policy management

### Broker Admin (`/broker`)
- `page.tsx` - Broker dashboard
- Allocations management
- Wallet management
- Compliance management

### User Dashboard (`/dashboard`)
- `page.tsx` - Main user dashboard
- Trading interface
- Wallet management
- Portfolio overview
- Analytics
- Settings

## API Route Summary

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Token refresh
- `POST /api/auth/logout` - User logout

### Admin Routes
- `GET /api/admin/*` - Platform admin operations
- `GET /api/admin/dashboard` - Dashboard data
- `GET /api/admin/users` - User management
- `GET /api/admin/kyc` - KYC management

### Broker Routes
- `GET /api/broker/*` - Broker admin operations
- `GET /api/broker/dashboard` - Broker dashboard
- `GET /api/broker/users` - Broker user management
- `GET /api/broker/transactions` - Broker transactions

### User Routes
- `GET /api/users/profile` - User profile
- `GET /api/wallets/*` - Wallet operations
- `POST /api/exchange/orders` - Trading operations
- `GET /api/portfolio/*` - Portfolio data

## Configuration

### Environment Variables
```bash
# Frontend
NEXT_PUBLIC_API_URL=https://thaliumx.com/api
NEXT_PUBLIC_WS_URL=wss://thaliumx.com/socket.io

# Backend
PORT=3001
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
```

### APISIX Configuration
Routes are configured via the APISIX Admin API or the setup script:
```bash
./docker/gateway/scripts/setup-all-routes.sh
```

## Troubleshooting

### Common Issues

1. **403 Forbidden on Admin Routes**
   - Check user role is `admin` or `super_admin`
   - Verify JWT token is valid

2. **Broker Dashboard Shows No Data**
   - Verify `brokerId` is set in JWT token
   - Check broker exists in database

3. **User Cannot Access Dashboard**
   - Verify user is authenticated
   - Check `tenantId` is set correctly

### Logs
- Backend logs: `docker logs thaliumx-backend`
- Gateway logs: `docker logs thaliumx-apisix`
- Frontend logs: `docker logs thaliumx-frontend`