# Keycloak Auth Contract

## Purpose
Defines the canonical authentication and authorization contract for the platform-first plus broker-channel model.

## Identity Topology
- Single Keycloak realm
- Single public OIDC client for web login with PKCE
- Single confidential backend API client for token validation and service flows
- Optional separate broker-ops client only if broker console is isolated

## Session Channels
- `channel=direct`
- `channel=broker`

Channel must be explicitly resolved and enforced in gateway and backend middleware.

## Mandatory Token Claims

### Always required
- `sub`
- `iss`
- `aud`
- `exp`
- `iat`
- `channel`
- `roles`

### Required for broker channel
- `broker_id`
- `broker_slug`

### Contextual claims
- `customer_id` for customer context
- `mandate_scopes` for delegated broker actions on customer accounts
- `session_type` such as `broker_user` or `customer`

## Role Families

### Platform roles
- `platform_super_admin`
- `platform_support`

### Broker roles
- `broker_owner`
- `broker_admin`
- `broker_trader`
- `broker_compliance`
- `broker_support`

### Customer roles
- `customer_primary`
- `customer_view_only`

## Authorization Rules
1. Broker user may act only within their own `broker_id` scope.
2. Broker user may access only customers mapped to same `broker_id`.
3. Delegated trading requires active mandate and matching `mandate_scopes`.
4. Direct channel sessions cannot inherit broker role privileges.
5. If host broker context and token `broker_id` mismatch, request must be rejected.

## Mandate Enforcement Contract
A broker-initiated customer trade requires all of:
- `channel=broker`
- broker role allowing delegated execution
- active mandate for `broker_id` plus `customer_id`
- mandate scope covering requested action

Minimum scope set examples:
- `trade:place`
- `trade:amend`
- `trade:cancel`
- `funds:withdraw` only when explicitly granted

## Gateway Validation Contract
Gateway must enforce:
1. OIDC issuer allowlist
2. Audience check for API client
3. Host-to-broker context resolution before forwarding
4. Hard deny on context mismatch

Forwarded headers contract:
- `X-Channel`
- `X-Broker-ID` when broker channel
- `X-Broker-Slug` when broker channel
- `X-Auth-Subject`

## Backend Validation Contract
Backend must enforce in middleware:
1. signature and expiration checks
2. issuer and audience checks
3. channel validation
4. broker context consistency check
5. mandate check on delegated operations

Any failure returns deny-by-default.

## Claim Mapper Matrix

| Claim | Source | Required | Notes |
|---|---|---|---|
| `channel` | protocol mapper | yes | direct or broker |
| `broker_id` | group attr or user attr | broker only | UUID or canonical string |
| `broker_slug` | group attr | broker only | routing-safe slug |
| `roles` | realm and client roles | yes | normalized in backend |
| `customer_id` | user attr or session context | contextual | required for customer scoped actions |
| `mandate_scopes` | token custom claim | delegated only | used by mandate guard |

## Token TTL Baseline
- Access token short-lived
- Refresh token bounded with rotation
- Offline tokens disabled unless explicitly justified

Final values are environment-specific and locked in operations runbook.

## Audit Contract
Every security-relevant event must capture:
- `channel`
- `broker_id` if present
- `customer_id` if present
- `mandate_id` if present
- `actor_id`
- action, resource, outcome, timestamp

## Compatibility Policy
During migration period:
- legacy tenant naming may remain in code paths
- canonical authorization decision must still use broker plus channel semantics
- no new endpoint may introduce tenant semantics in business logic

## Acceptance Criteria
Contract is accepted when:
1. Gateway and backend validate all mandatory claims.
2. Broker mismatch checks are active and tested.
3. Delegated trading denied without valid mandate.
4. Direct channel cannot access broker-only operations.
5. Audit events include required identity and mandate fields.
