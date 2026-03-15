# Authentication & Authorization System Gap Analysis

**Document Version:** 1.0  
**Date:** March 14, 2026  
**Classification:** Internal - Confidential

---

## 1. Executive Summary

This document presents a comprehensive gap analysis of the ThaliumX authentication and authorization systems based on security audits conducted across multiple components: BLNK ledger, token sale (presale), application authentication, and KYC/AML compliance.

### Key Findings Overview

| Component | Critical Issues | High Issues | Medium Issues | Low Issues |
|-----------|----------------|-------------|---------------|------------|
| BLNK Ledger | 2 | 1 | 2 | 1 |
| Token Sale | 2 | 2 | 1 | 1 |
| App Auth | 2 | 3 | 2 | 1 |
| KYC/Trading Limits | 1 | 2 | 2 | 0 |
| **TOTAL** | **7** | **8** | **7** | **3** |

### Risk Summary

- **Critical (Severity 1):** 7 issues requiring immediate attention
- **High (Severity 2):** 8 issues requiring urgent remediation
- **Medium (Severity 3):** 7 issues to be addressed in next sprint
- **Low (Severity 4):** 3 issues for future improvement

### Primary Concerns

1. **Multi-layer Inconsistency**: BLNK ledger operates independently from backend RBAC, creating authorization gaps
2. **Currency Mismatch**: KYC limits configured in ZAR while trading limits enforced in USD
3. **Off-chain Trust Assumptions**: Token sale contract assumes off-chain validation without enforcement
4. **Weak API Key Security**: API key validation relies solely on environment variable comparison
5. **Tenant ID Trust**: Tenant ID extracted from headers without cryptographic verification

---

## 2. Critical Security Issues by Severity

### 2.1 CRITICAL (Severity 1) - Immediate Action Required

#### Issue #1: BLNK Ledger - No Owner Enforcement

**Location:** [`blnk/ledger.go`](blnk/ledger.go)

**Description:** The BLNK ledger operations do not enforce ownership verification. Any user can:
- Read any ledger by ID (`GetLedgerByID`)
- Update any ledger name (`UpdateLedger`)
- Access all ledgers without authentication (`GetAllLedgers`)

**Code Evidence:**
```go
// No owner check in GetLedgerByID
func (l *Blnk) GetLedgerByID(id string) (*model.Ledger, error) {
    return l.datasource.GetLedgerByID(id)  // No authorization
}

// No owner check in UpdateLedger
func (l *Blnk) UpdateLedger(id, name string) (*model.Ledger, error) {
    ledger, err := l.datasource.UpdateLedger(id, name)  // No ownership verification
}
```

**Impact:** Full data exposure of all financial ledgers to any internal or external attacker who knows a ledger ID.

**Remediation Priority:** CRITICAL  
**Effort Estimate:** 3-5 days

---

#### Issue #2: Token Sale - No Multi-Sig for Critical Operations

**Location:** [`blockchain-contracts/contracts/ThaliumPresale.sol`](blockchain-contracts/contracts/ThaliumPresale.sol:236-263)

**Description:** Critical financial operations use single-role access control instead of multi-signature requirements:
- `withdrawUsdt()` - Only requires `DEFAULT_ADMIN_ROLE`
- `withdrawUnsoldTokens()` - Only requires `DEFAULT_ADMIN_ROLE`
- `pause()` / `unpause()` - Only requires `DEFAULT_ADMIN_ROLE`

**Code Evidence:**
```solidity
// Single point of failure for fund withdrawal
function withdrawUsdt(uint256 amount, address recipient)
    external
    onlyRole(DEFAULT_ADMIN_ROLE)  // Single role, not multi-sig
{
    // Transfers all collected USDT to single recipient
    USDT_TOKEN.safeTransfer(recipient, amount);
}
```

**Impact:** Single admin compromise or key compromise leads to complete loss of collected funds.

**Remediation Priority:** CRITICAL  
**Effort Estimate:** 5-7 days (smart contract upgrade + testing)

---

#### Issue #3: Token Sale - Off-Chain Whitelist Assumption

**Location:** [`blockchain-contracts/contracts/ThaliumPresale.sol`](blockchain-contracts/contracts/ThaliumPresale.sol:168-169)

**Description:** The `purchaseTokens()` function explicitly documents that it assumes off-chain validation has occurred:

```solidity
/**
 * Note: This function assumes off-chain validation has occurred
 * for KYC, purchase limits, and eligibility
 */
function purchaseTokens(uint256 usdtAmount) external whenNotPaused nonReentrant {
    // No on-chain KYC verification
    // No on-chain whitelist check
    // No on-chain purchase limit enforcement beyond MAX_PURCHASE
}
```

**Impact:** 
- KYC bypass possible if off-chain system fails
- Whitelist can be manipulated off-chain
- Purchase limits enforced only on-chain (MAX_PURCHASE = 10,000 USDT) but not per-user beyond this

**Remediation Priority:** CRITICAL  
**Effort Estimate:** 4-6 days

---

#### Issue #4: App Auth - OIDC Disabled by Default

**Location:** [`docker/backend/src/middleware/error-handler.ts`](docker/backend/src/middleware/error-handler.ts:444)

**Description:** OIDC authentication is disabled by default. The system defaults to internal JWT verification:

```typescript
// Default: Authentik OIDC is DISABLED
const useAuthentik = (process.env.USE_AUTHENTIK_JWT || 'false').trim().toLowerCase() === 'true';

if (useAuthentik) {
    return {
        name: 'authentik' as const,
        issuer: authentikIssuer,
        jwksUri: authentikJwks,
    };
}

// Falls back to internal JWT (less secure)
```

**Impact:** 
- Production deployments may run with weaker internal JWT instead of proper OIDC
- No centralized identity management if OIDC not explicitly enabled
- Single point of failure for token generation

**Remediation Priority:** CRITICAL  
**Effort Estimate:** 2-3 days

---

#### Issue #5: App Auth - Weak API Key Validation

**Location:** [`docker/backend/src/middleware/error-handler.ts`](docker/backend/src/middleware/error-handler.ts:1095-1116)

**Description:** API key validation compares against environment variable list without proper security controls:

```typescript
export const validateApiKey = (req: Request, _res: Response, next: NextFunction): void => {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
        return next(createError('API key required', 401, 'MISSING_API_KEY'));
    }
    
    // Weak validation - just checks environment variable
    const validKeys = process.env.VALID_API_KEYS?.split(',') || [];
    if (!validKeys.includes(apiKey)) {
        // Only logs warning, no account lockout
        return next(createError('Invalid API key', 401, 'INVALID_API_KEY'));
    }
    
    next();
};
```

**Issues:**
- No rate limiting on API key validation attempts
- No account lockout after failed attempts
- Keys stored in environment variables (not secure vault)
- No key rotation mechanism

**Remediation Priority:** CRITICAL  
**Effort Estimate:** 3-4 days

---

#### Issue #6: App Auth - Tenant ID Header Trust

**Location:** [`docker/backend/src/middleware/error-handler.ts`](docker/backend/src/middleware/error-handler.ts:630-637)

**Description:** Tenant ID is extracted from multiple sources without proper verification:

```typescript
const headerTenantId = (req.headers['x-tenant-id'] as string | undefined) || undefined;
const tokenTenantId = (decoded?.tenant_id as string | undefined) || (decoded?.tenantId as string | undefined) || undefined;
const resolvedTenantId =
    tokenTenantId ||
    claimBrokerId ||
    headerTenantId ||  // User-controlled header!
    process.env.DEFAULT_TENANT_ID ||
    '10000000-0000-0000-0000-000000000000';
```

**Impact:** An attacker can impersonate any tenant by setting the `x-tenant-id` header.

**Remediation Priority:** CRITICAL  
**Effort Estimate:** 2-3 days

---

#### Issue #7: KYC/Trading Limits - Currency Mismatch

**Location:** 
- KYC Limits: [`docker/backend/src/config/kyc-limits.config.ts`](docker/backend/src/config/kyc-limits.config.ts:70-156)
- Trading Limits: [`docker/backend/src/middleware/trading-levels.ts`](docker/backend/src/middleware/trading-levels.ts:31-60)

**Description:** KYC limits are configured in ZAR (South African Rand) while trading limits are enforced in USD:

**KYC Limits (ZAR):**
```typescript
const DEFAULT_KYC_LIMITS: Record<string, KYCLevelConfig> = {
    L1: {
        limits: {
            maxInvestment: parseFloat(process.env.KYC_L1_MAX_INVESTMENT || String(50000 * USD_TO_ZAR)),  // R925,000
            maxTrading: parseFloat(process.env.KYC_L1_MAX_TRADING || String(25000 * USD_TO_ZAR)),        // R462,500
            maxWithdrawal: parseFloat(process.env.KYC_L1_MAX_WITHDRAWAL || String(5000 * USD_TO_ZAR)),   // R92,500
        }
    }
};
```

**Trading Limits (USD):**
```typescript
export const TRADING_LIMITS: Record<KYCLevel, TradingLimits> = {
    [KYCLevel.L1]: {
        canTrade: true,
        maxDeposit: 1000,      // USD!
        maxWithdraw: 1000,     // USD!
        maxTrade: 1000,        // USD!
    }
};
```

**Impact:** 
- L1 user has ZAR 462,500 trading limit but only USD 1,000 enforced
- ZAR 462,500 ≈ USD 25,000 (at 18.5:1 rate)
- **~96% of legitimate trading capacity is blocked**
- Or conversely, if trading is intended in USD, KYC limits are 18.5x higher than intended

**Remediation Priority:** CRITICAL  
**Effort Estimate:** 1-2 days

---

### 2.2 HIGH (Severity 2) - Urgent Remediation

#### Issue #8: BLNK - Master Key Bypass

**Location:** [`blnk/internal/request/request.go`](blnk/internal/request/request.go:76-88)

**Description:** The BLNK client uses Basic Auth for API calls without proper key management:

```go
func BasicAuth(username, password string) string {
    auth := username + ":" + password
    return base64.StdEncoding.EncodeToString([]byte(auth))
}
```

No evidence of:
- Key rotation
- Key scopes/permissions
- Audit logging of key usage
- Master key vs operational key separation

**Remediation Priority:** HIGH  
**Effort Estimate:** 3-4 days

---

#### Issue #9: BLNK vs Backend RBAC Misalignment

**Location:** Multiple files

**Description:** BLNK ledger has independent authentication that doesn't integrate with the backend's RBAC system:

| Layer | Auth Method | RBAC Integration |
|-------|-------------|-------------------|
| BLNK | Basic Auth (username:password) | None |
| Backend | JWT/OIDC | OPA-based policies |
| Frontend | OIDC + session | Role-based UI |

**Gap:** A user with no backend access can potentially access BLNK ledgers if they have credentials.

**Remediation Priority:** HIGH  
**Effort Estimate:** 5-7 days

---

#### Issue #10: Token Sale - Whitelist Management Not On-Chain

**Location:** [`docker/backend/src/services/presale.ts`](docker/backend/src/services/presale.ts:897-922)

**Description:** Whitelist is managed entirely in backend with no on-chain verification:

```typescript
// Off-chain whitelist check
if (presale.whitelistRequired) {
    const whitelistEntry = Array.from(this.whitelist.values())
        .find(entry => entry.presaleId === presaleId && entry.userId === userId);
    
    if (!whitelistEntry || whitelistEntry.status !== WhitelistStatus.APPROVED) {
        throw createError('User not whitelisted for this presale', 403, 'NOT_WHITELISTED');
    }
}
```

No Merkle proof or on-chain mapping exists.

**Remediation Priority:** HIGH  
**Effort Estimate:** 4-5 days

---

#### Issue #11: Missing MFA Enforcement

**Location:** [`docker/backend/src/middleware/authorization.middleware.ts`](docker/backend/src/middleware/authorization.middleware.ts:74-88)

**Description:** MFA requirement exists in authorization middleware but is optional and not enforced for sensitive operations:

```typescript
if (options.requireMfa) {
    const user = req.user as any;
    if (!user.mfa_enabled || !user.mfa_verified) {
        // Only checks if requireMfa is set to true
        next(createError('Multi-factor authentication required', 403, 'MFA_REQUIRED'));
    }
}
```

Not applied to:
- Financial transactions
- Admin operations
- User data exports

**Remediation Priority:** HIGH  
**Effort Estimate:** 2-3 days

---

#### Issue #12: Incomplete RBAC Policy Coverage

**Location:** [`docker/backend/policies/wasm/rbac.rego`](docker/backend/policies/wasm/rbac.rego:1-56)

**Description:** OPA RBAC policy has limited coverage:

```rego
# Only allows exact role matches
allow {
    input.user.role == input.resource.required_role
}

# Missing: permission-based access control
# Missing: time-based access restrictions
# Missing: IP-based access control
```

**Remediation Priority:** HIGH  
**Effort Estimate:** 3-4 days

---

#### Issue #13: Role Priority Confusion

**Location:** [`docker/backend/src/middleware/error-handler.ts`](docker/backend/src/middleware/error-handler.ts:611-612)

**Description:** Role priority is hardcoded and not easily configurable:

```typescript
const rolePriority = [
    'master_system_admin', 'platform_admin', 'broker_admin', 
    'platform_compliance', 'broker_compliance', 
    'platform_finance', 'broker_finance', 
    'platform_support', 'broker_support', 
    'user_trader', 'user_viewer'
];
const selectedRole = normalizedRoles.find((r: string) => rolePriority.includes(r)) 
    || normalizedRoles[0] || 'user_viewer';
```

Issue: First matching role is selected, which may not align with security intent.

**Remediation Priority:** HIGH  
**Effort Estimate:** 1-2 days

---

#### Issue #14: KYC Level vs Trading Level Mapping Gap

**Location:** [`docker/backend/src/config/kyc-limits.config.ts`](docker/backend/src/config/kyc-limits.config.ts:70-156) vs [`docker/backend/src/middleware/trading-levels.ts`](docker/backend/src/middleware/trading-levels.ts:16-21)

**Description:** KYC has 5 levels (L0, L1, L2, L3, INSTITUTIONAL) but trading middleware only handles 4:

```typescript
// KYC Config
const DEFAULT_KYC_LIMITS: Record<string, KYCLevelConfig> = {
    L0: {}, L1: {}, L2: {}, L3: {}, INSTITUTIONAL: {}
};

// Trading Middleware
export enum KYCLevel {
    L0 = 'L0', L1 = 'L1', L2 = 'L2', L3 = 'L3'  // Missing INSTITUTIONAL!
}
```

Users with INSTITUTIONAL KYC level fall back to L3 behavior.

**Remediation Priority:** HIGH  
**Effort Estimate:** 1-2 days

---

### 2.3 MEDIUM (Severity 3) - Next Sprint

#### Issue #15: Audit Logging Gaps

**Location:** Multiple files

**Description:** Inconsistent audit logging across components:
- BLNK: No audit logging visible
- Backend: Comprehensive audit logging
- Smart contracts: Events exist but not all critical actions logged

**Remediation Priority:** MEDIUM  
**Effort Estimate:** 3-4 days

---

#### Issue #16: Rate Limiting Bypass on Auth Endpoints

**Location:** [`docker/backend/src/middleware/error-handler.ts`](docker/backend/src/middleware/error-handler.ts:235-241)

**Description:** Auth endpoints explicitly skip rate limiting:

```typescript
// IMPORTANT: Skip rate limiting for auth endpoints
if (req.path.startsWith('/api/auth/')) {
    return true;  // No rate limiting!
}
```

Reason documented: "Public auth endpoints are already rate-limited at the gateway (APISIX)" - but this creates defense-in-depth gap.

**Remediation Priority:** MEDIUM  
**Effort Estimate:** 1-2 days

---

#### Issue #17: Token Expiry Not Enforced Consistently

**Location:** [`docker/backend/src/middleware/error-handler.ts`](docker/backend/src/middleware/error-handler.ts:659-660)

**Description:** Default expiry set even when not in token:

```typescript
exp: typeof decoded?.exp === 'number' ? decoded.exp : Math.floor(Date.now() / 1000) + 300,
```

If token lacks expiry, defaults to 5 minutes - may be too long for sensitive operations.

**Remediation Priority:** MEDIUM  
**Effort Estimate:** 1 day

---

#### Issue #18: Session Channel Validation Gap

**Location:** [`docker/backend/src/middleware/error-handler.ts`](docker/backend/src/middleware/error-handler.ts:484-486)

**Description:** Direct broker context can be enabled via environment variable:

```typescript
const allowDirectBrokerContext = (process.env.AUTH_ALLOW_DIRECT_BROKER_CONTEXT || 'false')
    .trim()
    .toLowerCase() === 'true';

if (opts.channel === 'direct' && !allowDirectBrokerContext && (opts.brokerId || opts.brokerSlug)) {
    throw createError('Direct channel token contains broker context', 403, 'AUTH_CONTEXT_MISMATCH');
}
```

If enabled, broker context can be spoofed.

**Remediation Priority:** MEDIUM  
**Effort Estimate:** 1-2 days

---

#### Issue #19: Broker Context Mismatch Detection

**Location:** [`docker/backend/src/middleware/error-handler.ts`](docker/backend/src/middleware/error-handler.ts:500-519)

**Description:** Header vs token broker context can mismatch but recovery path unclear:

```typescript
if (headerChannel && headerChannel !== opts.channel) {
    throw createError('Channel mismatch between gateway and token context', 403, 'AUTH_CONTEXT_MISMATCH');
}
```

User gets 403 with no clear remediation path.

**Remediation Priority:** MEDIUM  
**Effort Estimate:** 2-3 days

---

#### Issue #20: Password in Basic Auth Logged

**Location:** [`blnk/internal/request/request.go`](blnk/internal/request/request.go:86-87)

**Description:** Basic auth generation could log password if request is logged:

```go
func BasicAuth(username, password string) string {
    auth := username + ":" + password
    return base64.StdEncoding.EncodeToString([]byte(auth))
}
```

If HTTP logging includes headers, credentials exposed.

**Remediation Priority:** MEDIUM  
**Effort Estimate:** 1 day

---

### 2.4 LOW (Severity 4) - Future Improvement

#### Issue #21: JWKS Client Cache Not Invalidated

**Location:** [`docker/backend/src/middleware/error-handler.ts`](docker/backend/src/middleware/error-handler.ts:328-346)

**Description:** JWKS client cache has 10-minute TTL but no manual invalidation mechanism.

**Remediation Priority:** LOW  
**Effort Estimate:** 1 day

---

#### Issue #22: Duplicate AppError Classes

**Location:** 
- [`docker/backend/src/utils/index.ts:313`](docker/backend/src/utils/index.ts:313)
- [`docker/backend/src/utils/error-handler.ts:88`](docker/backend/src/utils/error-handler.ts:88)

**Description:** Two different `AppError` classes exist, causing instanceof checks to fail.

**Remediation Priority:** LOW  
**Effort Estimate:** 2 days

---

#### Issue #23: Missing Health Check Auth

**Location:** Multiple services

**Description:** Health endpoints (`/health`, `/metrics`) have no authentication - potential information disclosure.

**Remediation Priority:** LOW  
**Effort Estimate:** 1 day

---

## 3. Cross-Layer Misalignments

### 3.1 BLNK vs Backend RBAC

| Aspect | BLNK Layer | Backend Layer | Gap |
|--------|-------------|---------------|-----|
| Auth Method | Basic Auth (username:password) | JWT/OIDC | Different trust models |
| Authorization | None (no owner check) | OPA policies | No resource ownership |
| Audit Logging | None visible | Comprehensive | No BLNK audit trail |
| Key Management | Static credentials | Dynamic JWT | No key rotation |
| Tenant Isolation | None | Header + token based | Cross-tenant risk |

**Risk:** BLNK data accessible without proper authorization checks. No correlation between BLNK operations and user identity in backend.

---

### 3.2 KYC Limits vs Trading Limits

| KYC Level | KYC Config (ZAR) | Trading Middleware (USD) | Effective Limit Mismatch |
|-----------|------------------|---------------------------|--------------------------|
| L0 | maxTrading: R0 | canTrade: false | Consistent (both block) |
| L1 | maxTrading: R462,500 | maxTrade: $1,000 | **25x difference** |
| L2 | maxTrading: R1,850,000 | maxTrade: $10,000 | **18.5x difference** |
| L3 | maxTrading: R9,250,000 | maxTrade: unlimited | Different semantics |

**Root Cause:**
1. [`kyc-limits.config.ts`](docker/backend/src/config/kyc-limits.config.ts:68): Uses `USD_TO_ZAR = 18.5` conversion
2. [`trading-levels.ts`](docker/backend/src/middleware/trading-levels.ts:31-60): Hardcoded USD values

**Business Impact:**
- Users with L1 KYC can trade up to R462,500 but are blocked at $1,000
- This effectively blocks 96%+ of intended trading capacity
- Or: Trading limits are 18.5x more permissive than KYC intends

---

### 3.3 Token Sale Whitelist vs KYC

| Aspect | Token Sale | KYC System | Gap |
|--------|------------|------------|-----|
| Whitelist Storage | Backend database | Separate KYC service | No synchronization |
| Verification | Off-chain assumed | On verification | No on-chain proof |
| Limits | MAX_PURCHASE (10k USDT) | KYC investment limits | Not correlated |
| Status Changes | Manual approval | Automated workflow | Different states |

---

### 3.4 App Auth - Tenant Isolation

```
Request Flow:
┌─────────────┐    x-tenant-id header    ┌─────────────────┐
│   Client    │ ─────────────────────────►│   Backend API   │
└─────────────┘                           └────────┬────────┘
                                                  │
                                         ┌────────▼────────┐
                                         │ Tenant Resolution│
                                         │ 1. Token tenant │
                                         │ 2. Broker ID    │
                                         │ 3. Header ⚠️    │
                                         │ 4. Default      │
                                         └─────────────────┘
```

**Vulnerability:** Step 3 allows tenant spoofing via `x-tenant-id` header.

---

## 4. Authentication Matrix Cross-Reference

### 4.1 What Exists in Code vs What's Enforced

| Component | Feature | Code Exists | Actually Enforced | Notes |
|-----------|---------|-------------|-------------------|-------|
| **Backend API** | JWT Authentication | ✅ Yes | ✅ Yes | Via authenticateToken |
| | Role-based Access | ✅ Yes | ⚠️ Partial | OPA policy exists but limited |
| | Permission-based | ✅ Yes | ❌ No | requirePermission defined but unused |
| | MFA Enforcement | ⚠️ Optional | ❌ No | Not applied to sensitive ops |
| | Tenant Isolation | ⚠️ Weak | ⚠️ Partial | Header can override token |
| | Rate Limiting | ✅ Yes | ⚠️ Partial | Auth endpoints excluded |
| **BLNK Ledger** | Owner Check | ❌ No | ❌ No | Anyone can access any ledger |
| | Basic Auth | ✅ Yes | ✅ Yes | But credentials static |
| | Audit Logging | ❌ No | ❌ No | No visible audit trail |
| **Smart Contracts** | Role-based Access | ✅ Yes | ✅ Yes | OpenZeppelin AccessControl |
| | Multi-sig | ❌ No | ❌ No | Single admin role only |
| | On-chain Whitelist | ❌ No | ❌ No | Off-chain assumed |
| **Frontend** | OIDC Login | ✅ Yes | ⚠️ Conditional | Only if USE_AUTHENTIK_JWT=true |
| | Session Management | ✅ Yes | ✅ Yes | In-memory token storage |
| | Role-based UI | ✅ Yes | ✅ Yes | Via RBAC hooks |

---

### 4.2 Authentication Method by Component

| Component | Primary Auth | Backup Auth | Integration |
|-----------|-------------|-------------|-------------|
| Web UI | Authentik OIDC | None | PKCE flow |
| Mobile App | Authentik OIDC | None | PKCE flow |
| API Client | JWT Bearer | API Key | Token in header |
| BLNK Client | Basic Auth | None | HTTP Basic |
| Smart Contract | EOA Signature | None | msg.sender |
| Webhook Receiver | API Key | None | x-api-key header |

---

### 4.3 Authorization Coverage Matrix

| Resource Type | Create | Read | Update | Delete |
|--------------|--------|------|--------|--------|
| User | ✅ Authenticated | ✅ Owner/Admin | ✅ Owner/Admin | ✅ Admin only |
| Ledger (Backend) | ✅ Authenticated | ⚠️ No owner check | ⚠️ No owner check | ❌ No check |
| Ledger (BLNK) | ⚠️ Basic Auth only | ❌ No auth | ❌ No auth | ❌ No auth |
| Transaction | ✅ Authenticated | ✅ Owner | N/A | N/A |
| KYC | ✅ Authenticated | ✅ Owner/Admin | ✅ Admin | ✅ Admin |
| Presale | ✅ Role-based | ✅ Role-based | ✅ Role-based | ✅ Admin |
| Withdrawal | ✅ Auth + MFA | N/A | N/A | N/A |

---

## 5. Prioritized Remediation Recommendations

### Phase 1: Critical Fixes (Week 1-2)

| # | Issue | Effort | Priority | Owner |
|---|-------|--------|----------|-------|
| 1 | Fix KYC/Trading currency mismatch | 2 days | P0 | Backend Team |
| 2 | Add BLNK owner enforcement | 5 days | P0 | BLNK Team |
| 3 | Enable OIDC by default | 3 days | P0 | DevOps |
| 4 | Implement proper API key validation | 4 days | P0 | Security Team |
| 5 | Fix tenant ID header trust | 3 days | P0 | Backend Team |
| 6 | Add multi-sig to presale withdrawals | 7 days | P0 | Blockchain Team |
| 7 | Implement on-chain whitelist verification | 6 days | P0 | Blockchain Team |

**Phase 1 Total Effort:** 30 developer days

---

### Phase 2: High Priority (Week 3-4)

| # | Issue | Effort | Priority | Owner |
|---|-------|--------|----------|-------|
| 8 | Integrate BLNK with backend RBAC | 7 days | P1 | Integration Team |
| 9 | Add MFA enforcement for financial ops | 3 days | P1 | Backend Team |
| 10 | Enhance OPA RBAC policy coverage | 4 days | P1 | Security Team |
| 11 | Add INSTITUTIONAL to trading levels | 2 days | P1 | Backend Team |
| 12 | Implement audit logging in BLNK | 4 days | P1 | BLNK Team |

**Phase 2 Total Effort:** 20 developer days

---

### Phase 3: Medium Priority (Week 5-6)

| # | Issue | Effort | Priority | Owner |
|---|-------|--------|----------|-------|
| 13 | Add rate limiting to auth endpoints | 2 days | P2 | DevOps |
| 14 | Fix token expiry defaults | 1 day | P2 | Backend Team |
| 15 | Improve session channel validation | 3 days | P2 | Backend Team |
| 16 | Consolidate AppError classes | 2 days | P2 | Backend Team |
| 17 | Add comprehensive audit logging | 4 days | P2 | Security Team |

**Phase 3 Total Effort:** 12 developer days

---

### Phase 4: Future Improvements (Backlog)

| # | Issue | Effort | Priority |
|---|-------|--------|----------|
| 18 | JWKS cache invalidation mechanism | 1 day | P3 |
| 19 | Health check authentication | 1 day | P3 |
| 20 | Password-free Basic Auth replacement | 5 days | P3 |
| 21 | Permission-based access control rollout | 10 days | P3 |

**Phase 4 Total Effort:** 17 developer days

---

## 6. Appendix

### A. Files Analyzed

| File | Purpose |
|------|---------|
| [`blnk/ledger.go`](blnk/ledger.go) | BLNK ledger operations |
| [`blnk/internal/request/request.go`](blnk/internal/request/request.go) | BLNK HTTP client |
| [`blockchain-contracts/contracts/ThaliumPresale.sol`](blockchain-contracts/contracts/ThaliumPresale.sol) | Token sale smart contract |
| [`docker/backend/src/middleware/error-handler.ts`](docker/backend/src/middleware/error-handler.ts) | Main auth middleware |
| [`docker/backend/src/middleware/authorization.middleware.ts`](docker/backend/src/middleware/authorization.middleware.ts) | OPA authorization |
| [`docker/backend/src/middleware/trading-levels.ts`](docker/backend/src/middleware/trading-levels.ts) | Trading limit enforcement |
| [`docker/backend/src/config/kyc-limits.config.ts`](docker/backend/src/config/kyc-limits.config.ts) | KYC limit configuration |
| [`docker/backend/policies/wasm/rbac.rego`](docker/backend/policies/wasm/rbac.rego) | OPA RBAC policy |
| [`docker/backend/src/services/presale.ts`](docker/backend/src/services/presale.ts) | Presale backend service |

### B. Severity Definitions

| Severity | Definition | Response Time |
|----------|------------|---------------|
| Critical | Active exploitation possible, data breach risk | Immediate (24h) |
| High | Significant security weakness, likely exploitation | 1 week |
| Medium | Security weakness, mitigation available | 2 weeks |
| Low | Minor issue, best practice violation | Next quarter |

### C. Remediation Effort Estimates

| Effort | Definition |
|--------|------------|
| 1 day | Can be fixed in a single sprint day |
| 2-3 days | Small feature work |
| 4-7 days | Medium feature work |
| 1+ weeks | Larger feature/epic work |

---

**Document Prepared By:** Security Audit Team  
**Next Review Date:** April 14, 2026  
**Distribution:** Internal - Engineering, Security, DevOps
