# OPA Policy Management System

## Overview

ThaliumX uses Open Policy Agent (OPA) as the centralized policy engine for:
- **AML/KYC Compliance**: Anti-money laundering and know-your-customer rules
- **Security Policies**: Authentication, session management, and access control
- **Trading Policies**: Order validation, limits, and risk management
- **RBAC**: Role-based access control

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ThaliumX Platform                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Backend    │    │   Frontend   │    │   Services   │       │
│  │   API        │    │   Admin UI   │    │              │       │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘       │
│         │                   │                   │                │
│         └───────────────────┼───────────────────┘                │
│                             │                                    │
│                    ┌────────▼────────┐                          │
│                    │  Policy Manager │                          │
│                    │  (Routing)      │                          │
│                    └────────┬────────┘                          │
│                             │                                    │
│         ┌───────────────────┼───────────────────┐               │
│         │                   │                   │                │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐         │
│  │  OPA WASM   │    │  OPA HTTP   │    │  Data Store │         │
│  │  (Fast)     │    │  (Auditable)│    │  (Params)   │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Policy Categories

### 1. AML/KYC Policies (`thaliumx/aml`)

| Rule ID | Description | Severity | Default Threshold |
|---------|-------------|----------|-------------------|
| AML-001 | Large Transaction | High | $10,000 |
| AML-002 | Structuring Detection | High | 3 transactions near threshold |
| AML-003 | Rapid Movement (Layering) | High | $5,000 in/out within 1 hour |
| AML-004 | High-Risk Country | Medium | Configurable list |
| AML-005 | Sanctioned Country Block | Critical | OFAC list |
| AML-006 | PEP Transaction | High | $5,000 |
| AML-007 | New Account High Value | Medium | 30 days, $5,000 |
| AML-008 | Unusual Trading Pattern | Medium | 5x average volume |
| KYC-001 | KYC Level Insufficient | High | Tiered limits |
| KYC-002 | KYC Expired | High | Expiry date check |

### 2. Security Policies (`thaliumx/security`)

| Rule ID | Description | Severity | Default Setting |
|---------|-------------|----------|-----------------|
| SEC-001 | Failed Login Lockout | High | 5 attempts, 30 min lockout |
| SEC-002 | Blocked IP | Critical | Configurable list |
| SEC-003 | VPN/Proxy Detection | Medium | Optional block |
| SEC-004 | New Device Detection | Medium | Email confirmation |
| SEC-005 | Impossible Travel | High | 1 hour threshold |
| SEC-006 | Session Timeout | Low | 1 hour |
| SEC-007 | Concurrent Sessions | Low | 5 max |
| SEC-008 | Rate Limit Exceeded | Medium | Tiered limits |
| SEC-009 | Invalid API Key | High | Status check |
| SEC-010 | IP Whitelist Violation | High | Per API key |
| SEC-011 | Withdrawal Address Whitelist | High | Required |
| SEC-012 | Withdrawal Cooling Period | Medium | 24 hours after password change |
| SEC-013 | 2FA Required | High | $1,000 threshold |

### 3. Trading Policies (`thaliumx/trading`)

| Rule ID | Description | Severity | Default Setting |
|---------|-------------|----------|-----------------|
| TRD-001 | Minimum Order Size | Low | Per market |
| TRD-002 | Maximum Order Size | Medium | Per market |
| TRD-003 | Price Deviation | Medium | 10% from market |
| TRD-004 | Notional Value Limit | High | $1,000,000 |
| TRD-005 | Position Limit | High | Per market |
| TRD-006 | Daily Volume Limit | Medium | Tiered |
| TRD-007 | Leverage Limit | High | Tiered |
| TRD-008 | Insufficient Margin | High | Real-time check |
| TRD-009 | Open Orders Limit | Low | Tiered |
| TRD-010 | Wash Trading | Critical | Self-matching block |
| TRD-011 | Spoofing Detection | High | Order/cancel ratio |
| TRD-012 | Layering Detection | High | Multi-level orders |
| TRD-013 | Trading Hours | Low | Configurable |

## API Endpoints

### Policy Parameters

```bash
# Get all parameters
GET /api/admin/policies/parameters

# Get category parameters
GET /api/admin/policies/parameters/{category}
# Categories: aml, security, trading, rbac

# Update category parameters (full replace)
PUT /api/admin/policies/parameters/{category}
Content-Type: application/json
{
  "large_transaction_threshold": 15000,
  "structuring_count_threshold": 4
}

# Patch category parameters (partial update)
PATCH /api/admin/policies/parameters/{category}
Content-Type: application/json
{
  "large_transaction_threshold": 15000
}
```

### Policy Evaluation

```bash
# Evaluate a policy
POST /api/admin/policies/evaluate
Content-Type: application/json
{
  "policy": "thaliumx/aml/allow",
  "input": {
    "action": "transaction_review",
    "transaction": {
      "amount": 15000,
      "country": "US"
    },
    "user": {
      "id": "user123",
      "kyc_level": "level_1"
    }
  }
}

# Test multiple scenarios
POST /api/admin/policies/test
Content-Type: application/json
{
  "policy": "thaliumx/aml/allow",
  "scenarios": [
    {
      "name": "Normal transaction",
      "input": { "action": "transaction_review", "transaction": { "amount": 500 } },
      "expected": { "allowed": true }
    },
    {
      "name": "Large transaction",
      "input": { "action": "transaction_review", "transaction": { "amount": 15000 } },
      "expected": { "flagged": true }
    }
  ]
}
```

### Policy Status

```bash
# Get OPA status
GET /api/admin/policies/status

# Health check
GET /api/admin/policies/health

# Get audit log
GET /api/admin/policies/audit?limit=100&category=aml
```

### Policy Presets

```bash
# Get available presets
GET /api/admin/policies/presets

# Apply a preset
POST /api/admin/policies/presets/{presetName}/apply
# Presets: strict, standard, relaxed
```

## Configuration Parameters

### AML Parameters

```json
{
  "aml": {
    "large_transaction_threshold": 10000,
    "structuring_lower_bound": 8000,
    "structuring_count_threshold": 3,
    "rapid_movement_threshold": 5000,
    "rapid_movement_window_seconds": 3600,
    "high_risk_countries": ["AF", "BY", "CF", ...],
    "sanctioned_countries": ["KP", "IR", "SY", "CU", "RU"],
    "pep_threshold": 5000,
    "new_account_days": 30,
    "new_account_threshold": 5000,
    "unusual_volume_multiplier": 5,
    "kyc_level_thresholds": {
      "level_0": 100,
      "level_1": 1000,
      "level_2": 10000,
      "level_3": 100000,
      "level_4": 1000000
    }
  }
}
```

### Security Parameters

```json
{
  "security": {
    "max_failed_login_attempts": 5,
    "lockout_duration_seconds": 1800,
    "blocked_ips": [],
    "block_vpn": false,
    "impossible_travel_seconds": 3600,
    "session_timeout_seconds": 3600,
    "max_concurrent_sessions": 5,
    "rate_limits": {
      "free": 60,
      "basic": 120,
      "pro": 300,
      "enterprise": 1000
    },
    "require_address_whitelist": true,
    "withdrawal_cooling_period_seconds": 86400,
    "withdrawal_2fa_threshold": 1000
  }
}
```

### Trading Parameters

```json
{
  "trading": {
    "min_order_sizes": {
      "THAL/USDT": 1,
      "BTC/USDT": 0.0001
    },
    "max_order_sizes": {
      "THAL/USDT": 1000000,
      "BTC/USDT": 100
    },
    "max_price_deviation_percent": 10,
    "max_notional_value": 1000000,
    "max_position_sizes": { ... },
    "daily_volume_limits": {
      "free": 10000,
      "basic": 100000,
      "pro": 1000000
    },
    "max_leverage": {
      "free": 1,
      "basic": 5,
      "pro": 20
    },
    "spoofing_order_threshold": 20,
    "spoofing_cancel_threshold": 15,
    "spoofing_cancel_ratio": 0.75
  }
}
```

## Admin UI

Access the Policy Management UI at: `/admin/policies`

Features:
- **Category Selection**: Switch between AML, Security, Trading, and RBAC policies
- **Parameter Editor**: Edit individual parameters with type-aware inputs
- **Quick Presets**: Apply predefined configurations (Strict, Standard, Relaxed)
- **Policy Tester**: Test policies with custom JSON input
- **Audit Log**: View history of policy changes

## Presets

### Strict Mode
- Lower thresholds for AML detection
- Shorter session timeouts
- More aggressive rate limiting
- Recommended for: High-risk jurisdictions, new platforms

### Standard Mode
- Balanced thresholds
- Standard session management
- Normal rate limits
- Recommended for: Most production environments

### Relaxed Mode
- Higher thresholds
- Longer sessions
- Higher rate limits
- Recommended for: Institutional/trusted users

## Integration

### Backend Service Integration

```typescript
import { PolicyManager } from './services/policy-manager';

const policyManager = new PolicyManager();

// Check AML policy
const amlResult = await policyManager.evaluate({
  action: 'transaction_review',
  transaction: { amount: 15000, country: 'US' },
  user: { id: 'user123', kyc_level: 'level_1' }
}, 'aml');

if (!amlResult.allowed) {
  // Handle policy violation
  console.log('Transaction blocked:', amlResult.reason);
}

// Quick RBAC check
const hasAccess = await policyManager.checkRBAC('trader', 'admin');
```

### OPA Direct Integration

```bash
# Query OPA directly
curl -X POST http://thaliumx-opa:8181/v1/data/thaliumx/aml/allow \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "action": "transaction_review",
      "transaction": { "amount": 15000 }
    }
  }'
```

## Monitoring

### Prometheus Metrics

OPA exposes metrics at `/metrics`:
- `opa_decision_count` - Total policy decisions
- `opa_decision_latency` - Decision latency histogram
- `opa_bundle_loaded` - Bundle load status

### Alerting

Configure alerts for:
- High policy violation rates
- OPA service unavailability
- Unusual decision patterns

## Troubleshooting

### OPA Not Responding

```bash
# Check OPA container
docker logs thaliumx-opa

# Test OPA health
curl http://localhost:8181/health

# Reload policies
docker restart thaliumx-opa
```

### Policy Not Evaluating Correctly

1. Check policy syntax with `opa check`
2. Test policy locally with `opa eval`
3. Verify data.json parameters are loaded
4. Check OPA decision logs

### Parameter Changes Not Taking Effect

1. Verify PUT/PATCH request succeeded
2. Check OPA data endpoint: `GET /v1/data/parameters`
3. Restart OPA if using bundle mode

## Security Considerations

1. **Access Control**: Policy management endpoints require admin role
2. **Audit Trail**: All parameter changes are logged
3. **Fail-Secure**: OPA unavailability defaults to deny
4. **Version Control**: Track parameter versions for rollback
5. **Testing**: Always test policy changes in staging first