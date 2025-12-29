# RBAC and KYC Permissions Documentation

## Overview

ThaliumX implements a comprehensive Role-Based Access Control (RBAC) system combined with KYC-level restrictions to ensure proper access control and regulatory compliance. This document details how permissions are enforced across the platform.

---

## 1. Role-Based Access Control (RBAC)

### 1.1 Role Hierarchy

The platform uses a three-tier role hierarchy:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLATFORM LEVEL                                │
│  (Master System Admin, Platform Admin, Platform Compliance, etc.)│
├─────────────────────────────────────────────────────────────────┤
│                     BROKER LEVEL                                 │
│  (Broker Admin, Broker Compliance, Broker Finance, etc.)         │
├─────────────────────────────────────────────────────────────────┤
│                      USER LEVEL                                  │
│  (Trader, Institutional Trader, VIP Trader)                      │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Platform Roles

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| `platform-admin` | Full platform access | All platform permissions, tenant lifecycle management |
| `platform-compliance` | Global compliance oversight | Compliance reports, audit logs, KYC management |
| `platform-finance` | Platform financial operations | Treasury, billing, financial reports |
| `platform-support` | Platform-wide support | Customer support, user management |
| `platform-risk` | Platform risk management | Risk assessment, compliance monitoring |
| `platform-content` | Content management | Templates, settings, documentation |

### 1.3 Broker Roles

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| `broker-admin` | Full broker access | All broker permissions, customer management |
| `broker-compliance` | Broker compliance | KYC management, compliance processes |
| `broker-finance` | Broker financial ops | Financial operations, wallet management |
| `broker-support` | Customer support | Support tickets, customer queries |
| `broker-ops` | Broker operations | Order management, trading operations |
| `broker-risk` | Broker risk management | Risk assessment, compliance |
| `broker-p2p-moderator` | P2P moderation | P2P trading, dispute resolution |
| `broker-content` | Broker content | Broker-specific content, tutorials |

### 1.4 End-User Roles

| Role | Description | Transaction Limits (ZAR) |
|------|-------------|--------------------------|
| `user-trader` | Standard trading | Daily: R185K, Monthly: R1.85M, Single: R18.5K |
| `user-institutional` | Institutional trading | Daily: R1.85M, Monthly: R18.5M, Single: R185K |
| `user-vip` | VIP trading | Daily: R925K, Monthly: R9.25M, Single: R92.5K |

---

## 2. Dashboard Access Control

### 2.1 Platform Admin Dashboard (`/admin`)

**Accessible by:** `admin`, `super_admin`, `platform-admin`

**Routes and Permissions:**

| Route | Required Role | Description |
|-------|--------------|-------------|
| `GET /admin/dashboard` | `admin`, `super_admin` | System dashboard data |
| `GET /admin/users` | `admin`, `super_admin` | User management |
| `PUT /admin/users/:id` | `admin`, `super_admin` | Update user |
| `DELETE /admin/users/:id` | `super_admin` | Delete user |
| `GET /admin/transactions` | `admin`, `super_admin`, `finance` | Transaction management |
| `GET /admin/kyc` | `admin`, `super_admin`, `compliance` | KYC management |
| `GET /admin/settings` | `super_admin` | System settings |
| `GET /admin/audit-logs` | `admin`, `super_admin` | Audit logs |

### 2.2 Broker Admin Dashboard (`/broker`)

**Accessible by:** `BROKER_ADMIN`, `BROKER_COMPLIANCE`, `BROKER_FINANCE`, `BROKER_OPERATIONS`, `BROKER_TRADING`, `BROKER_SUPPORT`

**Routes and Permissions:**

| Route | Required Roles | Description |
|-------|---------------|-------------|
| `GET /broker/dashboard` | All broker roles | Broker dashboard data |
| `GET /broker/health` | `BROKER_ADMIN`, `BROKER_OPERATIONS` | Broker health status |
| `GET /broker/metrics` | `BROKER_ADMIN`, `BROKER_OPERATIONS` | Broker metrics |
| `GET /broker/users` | `BROKER_ADMIN`, `BROKER_SUPPORT` | Broker user management |
| `GET /broker/transactions` | `BROKER_ADMIN`, `BROKER_FINANCE`, `BROKER_TRADING` | Transaction overview |
| `GET /broker/kyc` | `BROKER_ADMIN`, `BROKER_COMPLIANCE` | KYC overview |
| `GET /broker/audit-logs` | `broker-admin`, `broker-compliance` | Audit logs |

**Permission-Based Data Filtering:**

The broker dashboard returns permission flags based on user roles:

```typescript
permissions: {
  canViewFinancials: BROKER_FINANCE || BROKER_ADMIN,
  canViewCompliance: BROKER_COMPLIANCE || BROKER_ADMIN,
  canViewOperations: BROKER_OPERATIONS || BROKER_ADMIN,
  canViewTrading: BROKER_TRADING || BROKER_ADMIN
}
```

### 2.3 User Dashboard (`/dashboard`)

**Accessible by:** `user` role (all authenticated users)

**Features:**
- Portfolio overview
- Trading interface
- Wallet management
- Transaction history
- KYC status

---

## 3. KYC Level Restrictions

### 3.1 Currency Configuration

The platform uses **South African Rand (ZAR)** as the default currency with symbol **R**. This is configurable via environment variables:

```bash
CURRENCY_CODE=ZAR
CURRENCY_SYMBOL=R
CURRENCY_NAME=South African Rand
CURRENCY_DECIMALS=2
CURRENCY_LOCALE=en-ZA
USD_TO_ZAR_RATE=18.5
```

### 3.2 KYC Levels

| Level | Name | Requirements | Max Investment | Max Trading | Max Withdrawal |
|-------|------|--------------|----------------|-------------|----------------|
| `L0` | Web3 Basic | Wallet connection only | R185,000 | R0 | R18,500 |
| `L1` | Basic Verification | Email + Phone verified | R925,000 | R462,500 | R92,500 |
| `L2` | Identity Verified | ID + Address + Biometric | R4,625,000 | R1,850,000 | R462,500 |
| `L3` | Enhanced Verification | Full due diligence + Source of funds | R18,500,000 | R9,250,000 | R1,850,000 |
| `INSTITUTIONAL` | Institutional/KYB | Business verification | R185,000,000 | R92,500,000 | R18,500,000 |

> **USD Equivalent:** The default limits are based on USD values converted at approximately R18.50 per USD.

### 3.2 KYC Level Requirements

#### L0 - Web3 Basic
- Web3 wallet connection only
- No document verification
- No sanctions check
- No ongoing monitoring

#### L1 - Basic Verification
- Email verified
- Phone verified
- Sanctions check required
- No face verification

#### L2 - Identity Verified
- Email + Phone verified
- Government ID (National ID)
- Proof of address
- Biometric verification
- Sanctions + PEP check
- Face verification
- Ongoing monitoring enabled

#### L3 - Enhanced Verification
- All L2 requirements
- Passport verification
- Proof of income
- Source of funds documentation
- Enhanced screening

#### INSTITUTIONAL - KYB Verification
- Business registration
- Incorporation documents
- Ownership structure
- Authorized signatories
- Source of funds
- Regulatory licenses

### 3.3 KYC-Based Route Restrictions

The `requireKycLevel` middleware enforces KYC requirements:

```typescript
const requireKycLevel = (level: string) => {
  return (req, res, next) => {
    const userKycLevel = req.user?.kycLevel || 'basic';
    const levels = ['basic', 'intermediate', 'advanced', 'enterprise'];
    const userLevel = levels.indexOf(userKycLevel);
    const requiredLevel = levels.indexOf(level);
    
    if (userLevel < requiredLevel) {
      return res.status(403).json({
        message: `KYC level ${level} required`,
        code: 'INSUFFICIENT_KYC_LEVEL'
      });
    }
    next();
  };
};
```

### 3.4 Financial Operations KYC Requirements

| Operation | Minimum KYC Level | Notes |
|-----------|------------------|-------|
| Journal Entries | `basic` | Basic financial operations |
| Create Holds | `basic` | Fund holds |
| Process Transactions | `basic` | Transaction processing |
| Fund Transfers | `basic` | Internal transfers |
| FIAT Deposits | `basic` | Deposit funds |
| FIAT Withdrawals | `basic` | Withdraw funds |
| Wallet Transactions | `basic` | Wallet operations |
| External Wallet Connection | `basic` | Connect external wallets |
| Encryption/Decryption | `basic` | Data security operations |

---

## 4. Permission Matrix

### 4.1 Platform Permissions

| Permission ID | Description | Roles |
|--------------|-------------|-------|
| `platform:tenants:read` | View tenant information | Platform Admin |
| `platform:tenants:create` | Create new tenants | Platform Admin |
| `platform:tenants:update` | Update tenant information | Platform Admin |
| `platform:tenants:delete` | Delete tenants | Platform Admin |
| `platform:compliance:read` | View compliance reports | Platform Admin, Compliance |
| `platform:compliance:manage` | Manage compliance rules | Platform Admin, Compliance |
| `platform:billing:read` | View billing information | Platform Admin, Finance |
| `platform:billing:manage` | Manage billing and payments | Platform Admin, Finance |
| `platform:treasury:read` | View treasury information | Platform Admin, Finance |
| `platform:treasury:manage` | Manage treasury operations | Platform Admin, Finance |

### 4.2 Broker Permissions

| Permission ID | Description | Roles |
|--------------|-------------|-------|
| `broker:customers:read` | View customer information | All Broker Roles |
| `broker:customers:manage` | Manage customer accounts | Broker Admin, Support |
| `broker:orders:read` | View trading orders | Broker Admin, Ops, Trading |
| `broker:orders:manage` | Manage trading orders | Broker Admin, Ops |
| `broker:wallet:read` | View wallet information | All Broker Roles |
| `broker:wallet:manage` | Manage wallet operations | Broker Admin, Finance |
| `broker:kyc:read` | View KYC information | Broker Admin, Compliance |
| `broker:kyc:manage` | Manage KYC processes | Broker Admin, Compliance |
| `broker:compliance:read` | View compliance information | Broker Admin, Compliance |
| `broker:compliance:manage` | Manage compliance processes | Broker Admin, Compliance |
| `broker:finance:read` | View financial information | Broker Admin, Finance |
| `broker:finance:manage` | Manage financial operations | Broker Admin, Finance |

### 4.3 User Permissions

| Permission ID | Description | Roles |
|--------------|-------------|-------|
| `user:trading:read` | View trading information | All User Roles |
| `user:trading:execute` | Execute trading operations | All User Roles |
| `user:wallet:read` | View wallet information | All User Roles |
| `user:wallet:deposit` | Deposit funds to wallet | All User Roles |
| `user:wallet:withdraw` | Withdraw funds from wallet | All User Roles |
| `user:wallet:transfer` | Transfer funds between wallets | All User Roles |
| `user:profile:read` | View user profile | All User Roles |
| `user:profile:update` | Update user profile | All User Roles |
| `user:kyc:read` | View KYC status | All User Roles |
| `user:kyc:submit` | Submit KYC documents | All User Roles |
| `user:api:read` | View API information | All User Roles |
| `user:api:manage` | Manage API keys | All User Roles |

---

## 5. Transaction Limits by Role

> **Note:** All limits shown in South African Rand (R). Limits are configurable via environment variables.

### 5.1 Broker Role Limits

| Role | Daily Volume | Monthly Volume | Single Transaction | Daily Withdrawal | Monthly Withdrawal |
|------|-------------|----------------|-------------------|------------------|-------------------|
| `broker-admin` | R18,500,000 | R185,000,000 | R1,850,000 | R9,250,000 | R92,500,000 |
| `broker-finance` | R9,250,000 | R92,500,000 | R925,000 | R4,625,000 | R46,250,000 |
| `broker-ops` | R1,850,000 | R18,500,000 | R185,000 | R925,000 | R9,250,000 |
| `broker-compliance` | R0 | R0 | R0 | R0 | R0 |
| `broker-support` | R0 | R0 | R0 | R0 | R0 |

### 5.2 User Role Limits

| Role | Daily Volume | Monthly Volume | Single Transaction | Daily Withdrawal | Monthly Withdrawal |
|------|-------------|----------------|-------------------|------------------|-------------------|
| `user-trader` | R185,000 | R1,850,000 | R18,500 | R92,500 | R925,000 |
| `user-institutional` | R1,850,000 | R18,500,000 | R185,000 | R925,000 | R9,250,000 |
| `user-vip` | R925,000 | R9,250,000 | R92,500 | R462,500 | R4,625,000 |

---

## 6. Role Alias Mapping

The system supports legacy role names through alias mapping:

```typescript
const roleAliases: Record<string, string[]> = {
  admin: ['platform-admin', 'broker-admin'],
  super_admin: ['master_system_admin', 'platform-admin'],
  finance: ['platform-finance', 'broker-finance'],
  compliance: ['platform-compliance', 'broker-compliance'],
  operations: ['platform-operations', 'broker-ops', 'broker-operations'],
  support: ['platform-support', 'broker-support'],
  risk: ['platform-risk', 'broker-risk'],
  content: ['platform-content', 'broker-content'],
  trading: ['broker-trading'],
  security_officer: ['platform-security']
};
```

---

## 7. Implementation Examples

### 7.1 Route Protection with Role Check

```typescript
// Admin-only route
router.get('/admin/dashboard', 
  authenticateToken, 
  requireRole(['admin', 'super_admin']), 
  async (req, res) => {
    // Handler code
  }
);

// Broker-scoped route
router.get('/broker/dashboard', 
  authenticateToken,
  requireRole([
    UserRole.BROKER_ADMIN, 
    UserRole.BROKER_COMPLIANCE, 
    UserRole.BROKER_FINANCE
  ]), 
  async (req, res) => {
    // Handler code
  }
);
```

### 7.2 KYC Level Enforcement

```typescript
// Require basic KYC for financial operations
router.post('/financial/transactions',
  authenticateToken,
  requireKycLevel('basic'),
  async (req, res) => {
    // Handler code
  }
);

// Require advanced KYC for high-value operations
router.post('/financial/large-transfers',
  authenticateToken,
  requireKycLevel('advanced'),
  async (req, res) => {
    // Handler code
  }
);
```

### 7.3 Permission-Based Access

```typescript
// Check specific permission
router.post('/tenants/:tenantId/segregation-rules',
  authenticateToken,
  requireRole(['platform-admin']),
  requirePermission('platform', 'tenants:create'),
  async (req, res) => {
    // Handler code
  }
);
```

---

## 8. Security Considerations

### 8.1 Rate Limiting by Role

The system applies different rate limits based on user roles:

| Endpoint Type | Admin Limit | Standard Limit |
|--------------|-------------|----------------|
| General API | 500/15min | 100/15min |
| Financial Operations | 1000/15min | 50/15min |
| Authentication | 10/15min | 10/15min |

### 8.2 Audit Logging

All permission checks and access attempts are logged:

- User ID
- Role
- Requested resource
- Permission result
- Timestamp
- IP address

### 8.3 Role Assignment Approval

Certain roles require approval before assignment:

| Role | Requires Approval | Max Users |
|------|------------------|-----------|
| `platform-admin` | Yes | 5 |
| `broker-admin` | Yes | 3 |
| `user-institutional` | Yes | Unlimited |
| `user-vip` | Yes | Unlimited |

---

## 9. Frontend Integration

### 9.1 Dashboard Routing

```typescript
// Frontend route protection
const dashboardRoutes = {
  '/admin': ['admin', 'super_admin', 'platform-admin'],
  '/broker': ['BROKER_ADMIN', 'BROKER_COMPLIANCE', 'BROKER_FINANCE', 
              'BROKER_OPERATIONS', 'BROKER_TRADING', 'BROKER_SUPPORT'],
  '/dashboard': ['user']
};
```

### 9.2 UI Component Visibility

Components should check user permissions before rendering:

```typescript
// Example: Show financial data only to authorized roles
{permissions.canViewFinancials && <FinancialDashboard />}
{permissions.canViewCompliance && <CompliancePanel />}
{permissions.canViewTrading && <TradingMetrics />}
```

---

## 10. Compliance Notes

### 10.1 Regulatory Requirements

- KYC levels align with FATF recommendations
- Transaction limits comply with AML regulations
- Ongoing monitoring for L2+ users
- Sanctions screening for all verified users
- PEP checks for enhanced verification

### 10.2 Data Retention

- KYC documents: 7 years after account closure
- Transaction records: 7 years
- Audit logs: 5 years
- Access logs: 2 years

---

## Appendix A: API Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTHENTICATION_REQUIRED` | 401 | No valid authentication token |
| `INSUFFICIENT_PERMISSIONS` | 403 | User lacks required role/permission |
| `INSUFFICIENT_KYC_LEVEL` | 403 | User's KYC level too low |
| `ROLE_NOT_FOUND` | 404 | Requested role doesn't exist |
| `ROLE_ALREADY_ASSIGNED` | 400 | User already has this role |
| `ROLE_LIMIT_EXCEEDED` | 400 | Maximum users for role reached |
| `TENANT_REQUIRED` | 400 | Tenant context missing |

---

## Appendix B: Quick Reference

### Dashboard Access Summary

| Dashboard | URL | Primary Roles |
|-----------|-----|---------------|
| Platform Admin | `/admin` | `admin`, `super_admin` |
| Broker Admin | `/broker` | `BROKER_*` roles |
| User Dashboard | `/dashboard` | `user` |

### KYC Level Summary

| Level | Max Investment | Max Trading | Max Withdrawal |
|-------|---------------|-------------|----------------|
| L0 | R185K | R0 | R18.5K |
| L1 | R925K | R462.5K | R92.5K |
| L2 | R4.625M | R1.85M | R462.5K |
| L3 | R18.5M | R9.25M | R1.85M |
| INSTITUTIONAL | R185M | R92.5M | R18.5M |

---

## Appendix C: Configuration

### Environment Variables for KYC Limits

```bash
# Currency Configuration
CURRENCY_CODE=ZAR
CURRENCY_SYMBOL=R
CURRENCY_NAME=South African Rand
CURRENCY_DECIMALS=2
CURRENCY_LOCALE=en-ZA
USD_TO_ZAR_RATE=18.5

# KYC Level Limits (in ZAR)
KYC_L0_MAX_INVESTMENT=185000
KYC_L0_MAX_TRADING=0
KYC_L0_MAX_WITHDRAWAL=18500

KYC_L1_MAX_INVESTMENT=925000
KYC_L1_MAX_TRADING=462500
KYC_L1_MAX_WITHDRAWAL=92500

KYC_L2_MAX_INVESTMENT=4625000
KYC_L2_MAX_TRADING=1850000
KYC_L2_MAX_WITHDRAWAL=462500

KYC_L3_MAX_INVESTMENT=18500000
KYC_L3_MAX_TRADING=9250000
KYC_L3_MAX_WITHDRAWAL=1850000

KYC_INSTITUTIONAL_MAX_INVESTMENT=185000000
KYC_INSTITUTIONAL_MAX_TRADING=92500000
KYC_INSTITUTIONAL_MAX_WITHDRAWAL=18500000
```

### Environment Variables for Role Limits

```bash
# Broker Admin Limits
ROLE_BROKER_ADMIN_DAILY_VOLUME=18500000
ROLE_BROKER_ADMIN_MONTHLY_VOLUME=185000000
ROLE_BROKER_ADMIN_SINGLE_TX=1850000

# User Trader Limits
ROLE_USER_TRADER_DAILY_VOLUME=185000
ROLE_USER_TRADER_MONTHLY_VOLUME=1850000
ROLE_USER_TRADER_SINGLE_TX=18500
```

### API Endpoints for Configuration

| Endpoint | Description |
|----------|-------------|
| `GET /api/config/currency` | Get currency configuration |
| `GET /api/config/kyc-limits` | Get all KYC level limits |
| `GET /api/config/kyc-limits/:level` | Get limits for specific KYC level |
| `GET /api/config/role-limits` | Get all role transaction limits |
| `GET /api/config/role-limits/:role` | Get limits for specific role |
| `GET /api/config/format-amount?amount=1000` | Format amount with currency |