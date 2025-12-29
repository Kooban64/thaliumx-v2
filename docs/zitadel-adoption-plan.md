# Zitadel Adoption Plan (Prod-v1) — OIDC-first, single issuer, multi-tenant via app DB

This document describes a **careful, low-risk** plan to move ThaliumX from Keycloak to **Zitadel** with:

- **OIDC-only** integration (avoid IdP admin API coupling)
- **Single issuer** (one identity provider instance)
- **Multi-tenant + broker tenants** implemented primarily in **application DB + authorization**
- Strong security defaults suitable for a financial platform

Scope note: this is an adoption/migration **plan**. It does not delete Keycloak or remove functionality. Keycloak can be kept as a fallback until cutover is proven.

## Goals

1) Seamless UX: consistent look/feel and minimal “handoff” friction.
2) Operational simplicity: fewer brittle init steps and less ongoing admin overhead.
3) Security: MFA/TOTP, step-up, sensible token/session configuration, auditable events.
4) Compatibility: Backend + APISIX + Ballerine integration remains coherent.

## Non-goals (initially)

- Migrating existing user accounts (currently **0 users**).
- Building tenant isolation purely via IdP realms (we prefer app-layer tenant boundaries).

## Current state in this repo (Keycloak coupling)

Keycloak is currently used for:

- HTTPS Keycloak runtime with import: [`keycloak`](docker/compose/prod-v1/applications.yml:14)
- One-shot post-import seeding: [`keycloak-post-import-seed`](docker/compose/prod-v1/applications.yml:141)
- Backend Keycloak-specific integration: [`docker/backend/src/services/keycloak.ts`](docker/backend/src/services/keycloak.ts:1)

This plan reduces coupling by moving toward **provider-agnostic OIDC**.

## Target architecture (high level)

### Identity

- Zitadel provides **OIDC** for:
  - ThaliumX Frontend (public client, PKCE)
  - ThaliumX Backend (confidential client, if needed for server-to-server flows)

### Tenancy model

- “Tenant” and “Broker tenant” are **application concepts** stored in Postgres.
- Each user has memberships/roles in one or more tenants.
- Authorization is enforced at the API using:
  - DB tenant membership checks, and/or
  - OPA policies (already part of prod-v1)

### Token strategy

- Backend validates JWTs via issuer JWKS.
- Token claims are used for **identity + coarse role**.
- Tenant selection is resolved via request context (domain/subdomain/path) + DB lookup.

This avoids per-tenant realm sprawl and keeps identity provider operations simple.

## Persistence & crash recovery (critical)

Zitadel must be treated as a stateful system:

1) **Database**
   - Use a dedicated Postgres database for Zitadel (recommended).
   - Persist data on a named Docker volume.
   - Backups: scheduled logical backups + periodic restore drill.

2) **Configuration-as-code (where possible)**
   - Maintain a repo-local “IdP config inventory” of:
     - issuer URL
     - client IDs
     - redirect URIs
     - scopes
     - token lifetimes
     - MFA requirements
   - Store secrets in Vault / Docker secrets, not in compose.

3) **Disaster recovery playbook**
   - Restore DB volume backup
   - Verify issuer keys / JWKS availability
   - Validate login flow end-to-end
   - Confirm tokens validate in backend

4) **Rollback plan**
   - Keep Keycloak running during pilot.
   - Ability to switch the frontend auth issuer back (env/config) without code deployment.

## Security baseline (financial app)

Recommended defaults:

- MFA/TOTP available for all users; require MFA for privileged roles.
- Step-up auth for sensitive actions (e.g. withdrawals, admin operations, broker approvals).
- Short access token lifetime (e.g. 5–15 min) + refresh tokens with rotation.
- Strict redirect URI allowlist.
- Disable insecure flows (no implicit flow).
- Device/session limits and anomaly logging.
- Audit events shipped to your monitoring/logging layer.

## Integration points to keep seamless

### APISIX

- Prefer validating JWTs at the gateway for basic enforcement.
- Backend still validates tokens (defense in depth).

### Backend

- Replace Keycloak-specific assumptions with generic OIDC:
  - issuer URL
  - JWKS fetch
  - audience/client-id checks
  - standard claims mapping

Key refactor target: [`docker/backend/src/services/keycloak.ts`](docker/backend/src/services/keycloak.ts:1)

### Ballerine

Ballerine is used for onboarding / enhanced due diligence.

Guidelines:

- Ballerine should trust the **same user identity** (subject) used by the backend.
- If Ballerine needs to call backend APIs, use a dedicated service token flow (not end-user tokens).
- Keep tenant context explicit in backend APIs (tenant id header/path) so Ballerine workflows remain deterministic.

Prod-v1 Ballerine services are defined in [`docker/compose/prod-v1/fintech.yml`](docker/compose/prod-v1/fintech.yml:8).

## Phased execution plan

### Phase 0 — Inventory and seams

Deliverables:

- Document current auth flows (frontend ↔ backend ↔ Keycloak)
- Identify all Keycloak-specific behavior used by backend
- Define “OIDC Provider interface” for backend auth verification

### Phase 1 — Add Zitadel alongside Keycloak (no cutover)

Deliverables:

- Add Zitadel service + persistent DB/volume (no Keycloak removal)
- Configure TLS and internal CA trust consistent with existing stack
- Create OIDC clients for frontend and backend
- Establish backup/restore procedure for Zitadel DB

### Phase 2 — Backend becomes provider-agnostic (OIDC-only)

Deliverables:

- Backend validates tokens based on issuer configuration
- Feature-flagged issuer selection
- Ensure admin/service flows don’t depend on Keycloak admin APIs

### Phase 3 — Frontend pilot

Deliverables:

- Switch a non-prod environment to Zitadel issuer
- Validate login, refresh, logout, MFA enrollment

### Phase 4 — Production cutover

Deliverables:

- Switch production issuer
- Keep Keycloak available temporarily for rollback
- Monitor auth error rates, token validation failures, gateway logs

### Phase 5 — Decommission (later)

Only once stable:

- Remove Keycloak dependency paths and one-shot seeders
- Keep configuration artifacts for audit history

## Acceptance criteria

- Login UX is consistent and fast.
- MFA works and is enforceable for privileged roles.
- Token validation is stable and deterministic.
- Multi-tenant membership/roles enforced by backend/OPA.
- Zitadel survives restart/crash with no manual intervention beyond standard container restart.

