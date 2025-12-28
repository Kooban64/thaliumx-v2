# ThaliumX Enterprise Auth + Gateway Roadmap (APISIX + ETCD + Keycloak)

Status: **Active implementation plan**

This document is the long-term, production-grade plan for making authentication/authorization and gateway routing **stable, secure, observable, and user-friendly**.

It is designed to be updated continuously as work is completed.

---

## 0) Non-negotiable goals

### 0.1 User experience goals
- No “random” login failures.
- No surprise `429` lockouts for legitimate users.
- Predictable redirects and deep links:
  - `https://thal.thaliumx.com/` must land on `/token-presale`.

### 0.2 Security goals
- Keycloak is the Identity Provider (IdP) and source of truth for identity.
- APISIX is the edge policy enforcement point (PEP).
- Backend enforces business authorization and tenant scoping.
- Admin APIs are not publicly exposed.

### 0.3 Reliability goals
- Gateway configuration is persisted (ETCD) and survives container recreation.
- No stale upstreams after backend/frontend recreation.
- Changes are validated automatically before rollout.

---

## 1) Current architecture snapshot (baseline)

### 1.1 Public entrypoint
- APISIX is the only public entrypoint.
- APISIX is configured in ETCD mode; routes/upstreams/ssls are created by the init job.

### 1.2 Routing rules
- `thaliumx.com` -> frontend
- `thal.thaliumx.com`:
  - `/` -> `/token-presale`
  - all other paths -> frontend
- `/api/*` -> backend
- `auth.thaliumx.com/auth/*` -> Keycloak

---

## 2) Target enterprise architecture (end-state)

### 2.1 Identity
- Frontend authenticates via **OIDC Authorization Code + PKCE** against Keycloak.
- All authenticated API calls carry a Keycloak access token (bearer).

### 2.2 Edge enforcement
- APISIX enforces OIDC on protected API routes.
- Public routes remain public:
  - `/health`
  - `/api/csrf-token`
  - `/api/auth/*` (only while migration exists)

### 2.3 Authorization + tenancy
- Backend authorizes based on roles/permissions and tenant mapping.
- Tenant derivation is deterministic (token claim/realm mapping). Header-injected tenant is a fallback for unauthenticated flows only.

---

## 3) Implementation checklist (keep this updated)

### Milestone 1 — Reliability hardening (preserve current UX)
- [x] Configure APISIX real client IP handling (behind LB/CDN)
- [x] Re-tune gateway rate limits to be user-safe (and abuse-resistant)
- [ ] Add continuous synthetic auth probes (through APISIX)
- [ ] Add CI gates to prevent invalid gateway config rollout
- [ ] Enforce upstream TLS verification (remove insecure defaults)

### Milestone 2 — Keycloak-first auth model
- [ ] Implement frontend OIDC (Auth Code + PKCE)
- [ ] Enable APISIX `openid-connect` on protected APIs
- [ ] Convert backend verification to JWKS-based JWT validation (introspection fallback)
- [ ] Deprecate/remove legacy backend auth issuance

### Milestone 3 — HA/DR + governance
- [ ] ETCD snapshots + restore drills
- [ ] Keycloak HA + DB HA + backups/restore drills
- [ ] Incident runbook (auth outage, gateway outage, Keycloak outage)
- [ ] Security operations: key rotation, audit log shipping, alerting

---

## 4) Verification plan (minimum acceptance)

### 4.1 User journeys
- Landing: `thaliumx.com` loads and basic navigation works
- Presale: `thal.thaliumx.com/` lands on `/token-presale` and deep links work
- Auth:
  - register
  - login
  - refresh session
  - password reset
  - profile fetch

### 4.2 Failure-mode tests
- Restart backend only (gateway must still route successfully)
- Restart APISIX only (routes must still exist; ETCD persists)
- Restart ETCD only (APISIX recovers and reads routes)
- Keycloak degraded:
  - public pages still work
  - protected APIs return correct auth errors

### 4.3 Automated smoke checks (implemented)
- Script: `docker/scripts/gateway-smoke-test.sh`
- Run locally/on-server: `bash docker/scripts/gateway-smoke-test.sh`
- CI: runs via GitHub Actions job `gateway-smoke` (APISIX+ETCD with a mock upstream)
- Next: wire into a production cron (synthetic monitoring)

---

## 5) Working notes / decisions

Record any irreversible decisions here (realm structure, tenant mapping, token strategy, redirect URIs, etc.).

### 5.1 Edge topology (client IP trust)
- Current deployment assumption: **APISIX is directly internet-facing** (no CDN/LB in front).
- Decision: do **not** enable Nginx real-ip rewriting via `X-Forwarded-For` in APISIX, because that would allow IP spoofing.
- Rate limiting should continue to use the real socket IP (`remote_addr`) as currently configured in APISIX routes.

### 5.2 Auth rate limiting strategy
- Sensitive endpoints only (login/register/reset) are rate-limited strictly at the gateway.
- Non-sensitive endpoints (profile/refresh/logout) fall back to the general `/api/*` rate limits.
- Implemented in the gateway route initializer.

### 5.3 Target auth model (enterprise end-state)
- **Identity provider:** Keycloak (OIDC)
- **Frontend flow:** OIDC Authorization Code + PKCE
- **API auth:** bearer access token (Keycloak-issued)
- **Edge enforcement:** APISIX enforces OIDC on protected API routes
- **Backend enforcement:** backend performs fine-grained authorization + tenant scoping

### 5.4 Legacy auth deprecation plan
- Phase 1 (now): keep backend native auth endpoints for compatibility.
- Phase 2: introduce frontend OIDC alongside existing login, with a feature flag.
- Phase 3: migrate users and remove backend-issued token flows.
- Phase 4: remove `/api/auth/login` and `/api/auth/register` from public surface (keep reset flows only if needed).

### 5.5 Frontend OIDC implementation status
- Implemented **Keycloak OIDC client** (PKCE) behind feature flag `NEXT_PUBLIC_AUTH_MODE=keycloak`.
- Implementation files:
  - Browser init + token sync: `docker/frontend/src/lib/auth/keycloak.ts`
  - Bearer token injection: `docker/frontend/src/lib/api/client.ts`
  - Auth page supports Keycloak mode: `docker/frontend/src/app/auth/page.tsx`
