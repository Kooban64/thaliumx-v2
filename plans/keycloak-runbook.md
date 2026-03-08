# Keycloak Broker Channel Runbook

## Purpose
Operational runbook for platform-first plus broker-channel identity and authorization.

## Services in Scope
- Keycloak realm and clients
- Gateway host-based routing for broker channel
- Backend auth middleware and mandate guard chain
- Data compatibility jobs for broker-plus-channel migration

## Daily Operations

### Health checks
1. Keycloak health endpoint and login flow
2. Gateway route health for direct and broker hosts
3. Token validation success rate in backend
4. Mandate guard deny and allow ratio stability
5. ThaliumX realm theme enforcement status (login/account/admin/email)

### Dashboard minimums
- auth success rate
- auth failure rate by reason
- host and token context mismatch count
- mandate validation failure count
- broker host resolution failures

## Incident Playbooks

### Incident A Login failures spike
1. Confirm Keycloak availability
2. Validate issuer and JWKS reachability
3. Check client configuration drift
4. Check gateway OIDC plugin errors
5. Roll back latest auth config if needed

### Incident B Broker host mismatch denials spike
1. Verify DNS and host mappings for affected brokers
2. Verify gateway host resolver cache
3. Confirm token `broker_id` mapper output
4. Reconcile broker slug to broker id map
5. Keep deny-by-default until context integrity is restored

### Incident C Delegated trade denials unexpected
1. Check mandate state service
2. Validate `mandate_scopes` in token and backend evaluation
3. Check customer to broker mapping integrity
4. Validate policy release changes
5. Roll back policy package if regression confirmed

## Change Management

### Pre-change checklist
1. Backup identity and database state
2. Confirm rollback scripts are prepared
3. Confirm canary validation plan is ready
4. Confirm stakeholder communication window

### Post-change checklist
1. Run auth smoke tests direct and broker channels
2. Run delegated trading mandate checks
3. Review dashboards for 30 to 60 minutes
4. Verify branded Keycloak UX is active and no user-facing Keycloak references remain in login UI
5. Record evidence in checklist and risk register

## Keycloak Theming Operations (ThaliumX branding)

### Runtime wiring
- Theme assets are mounted into Keycloak container via [`docker/compose/prod-v1/identity.yml`](docker/compose/prod-v1/identity.yml).
- Realm theme settings are applied by one-shot init job `keycloak-post-import-seed` using [`docker/keycloak/scripts/apply-thaliumx-theme.sh`](docker/keycloak/scripts/apply-thaliumx-theme.sh).
- The init job is executed by default in hardened bring-up through [`docker/scripts/prod-v1-stack.sh`](docker/scripts/prod-v1-stack.sh) and manual init-run path in [`docker/scripts/thaliumxctl.sh`](docker/scripts/thaliumxctl.sh).

### Verify theming state
1. Confirm Keycloak and init jobs completed in stack bring-up logs.
2. Query realm config with admin tooling and confirm:
   - `loginTheme=thaliumx`
   - `accountTheme=thaliumx`
   - `adminTheme=thaliumx`
   - `emailTheme=thaliumx`
3. Validate login UI visuals and branding text from theme resources under [`docker/keycloak/themes/thaliumx/login`](docker/keycloak/themes/thaliumx/login).

### Manual re-apply (idempotent)
```bash
./thaliumxctl.sh init
```

This re-runs `vault-unseal` and `keycloak-post-import-seed` safely.

## Backup and Restore

### Backup baseline
- Keycloak database snapshot
- Realm export backup
- Broker host mapping backup
- Migration state checkpoint backup

### Restore drill
1. Restore Keycloak DB in staging-like environment
2. Import realm backup if needed
3. Revalidate clients and mappers
4. Re-run direct and broker auth tests
5. Validate delegated trade flow under mandate

## Secret Rotation

### Rotation scope
- Keycloak client secrets
- gateway OIDC secrets
- signing and encryption related secrets if applicable

### Rotation procedure
1. Introduce new secret in secret manager
2. Deploy dual-secret compatibility window where supported
3. Roll dependent services
4. Validate auth and delegated flows
5. Revoke old secret and document evidence

## Rollback Matrix

### Level 1 Config rollback
- Trigger: immediate auth regression after config-only change
- Action: revert config and reseed routes

### Level 2 Service rollback
- Trigger: build or runtime regression in auth middleware
- Action: roll back backend or gateway service version

### Level 3 Migration rollback
- Trigger: data inconsistency in broker-plus-channel migration
- Action: enable dual-read fallback and restore pre-migration snapshot

## Session Handoff Protocol

At session start:
1. Read [`plans/keycloak-implementation-checklist.md`](plans/keycloak-implementation-checklist.md)
2. Read [`plans/keycloak-risk-register.md`](plans/keycloak-risk-register.md)
3. Confirm active stage and exact objective

At session end:
1. Update checklist statuses
2. Append incident notes and deviations
3. Record next exact action and owner

## Quality Gate Execution Snapshot (2026-03-07)

### Commands executed
1. `pnpm -C docker lint`
2. `pnpm -C docker/frontend exec next lint --format json --output-file lint-report.frontend.json`
3. `pnpm -C docker typecheck`
4. `pnpm -C docker/backend test`
5. `pnpm -C docker/backend test:integration`

### Outcomes
- Workspace lint: **PASS**
  - `shared`: clean
  - `backend`: clean
  - `frontend`: clean (`next lint` reported no warnings/errors)
  - machine-readable lint evidence: `docker/frontend/lint-report.frontend.json`
- Workspace typecheck: **FAIL** (frontend strict typing debt remains; shared/backend pass)
  - top error classes:
    - `TS18046`: 542
    - `TS2339`: 73
    - `TS2322`: 9
    - `TS2345`: 8
    - `TS2786`: 6
    - `TS2604`: 6
    - `TS2698`: 4
    - `TS2571`: 3
    - `TS2769`: 2
    - `TS7053`: 1
- Backend unit/coverage matrix: **PASS**
- Backend integration matrix: **PASS** (4 suites, 40 tests)

### Operational note
- No quality-gate bypasses were introduced.
- Current gating blocker is not ESLint warning debt; it is frontend TypeScript strictness debt (predominantly unknown-narrowing and response typing issues).

## Quality Gate Execution Snapshot (2026-03-08)

### Commands executed
1. `pnpm -C docker/frontend typecheck`
2. `pnpm -C docker typecheck`
3. `pnpm -C docker lint`

### Outcomes
- Frontend typecheck: **PASS**
  - `docker/frontend`: clean (`tsc --noEmit` exit code 0)
- Workspace typecheck: **PASS**
  - `shared`: clean
  - `backend`: clean
  - `frontend`: clean
- Workspace lint: **PASS**
  - `shared`: clean
  - `backend`: clean
  - `frontend`: clean (`next lint` reported no warnings/errors)
  - note: Next.js printed deprecation guidance for `next lint` and non-blocking SWC lockfile patching message

### Operational note
- Frontend strict typing blocker has been cleared for the current workspace state.
- Quality gates are now green without suppressions.

## Escalation Criteria
- sustained auth failure rate above baseline threshold
- sustained broker context mismatch denials
- inability to enforce mandate checks for broker channel
- failed backup restore validation

## Linked Planning Docs
- [`plans/keycloak-broker-channel-master-plan.md`](plans/keycloak-broker-channel-master-plan.md)
- [`plans/keycloak-auth-contract.md`](plans/keycloak-auth-contract.md)
- [`plans/broker-landing-host-architecture.md`](plans/broker-landing-host-architecture.md)
- [`plans/broker-data-migration-plan.md`](plans/broker-data-migration-plan.md)
- [`plans/keycloak-implementation-checklist.md`](plans/keycloak-implementation-checklist.md)
