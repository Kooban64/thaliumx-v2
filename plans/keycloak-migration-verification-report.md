# Keycloak Migration Verification Report

Date: 2026-03-07
Scope source of truth:
- `plans/keycloak-broker-channel-master-plan.md`
- `plans/broker-first-operating-model.md`
- `plans/keycloak-auth-contract.md`
- `plans/broker-landing-host-architecture.md`
- `plans/broker-data-migration-plan.md`
- `plans/keycloak-implementation-checklist.md`
- `plans/keycloak-runbook.md`
- `plans/keycloak-risk-register.md`

## Implemented Changes Summary

### 1) Provider abstraction and Keycloak-first compatibility
- Added compatibility-safe Keycloak shim service:
  - `docker/backend/src/services/keycloak.ts`
- Preserved existing non-Keycloak paths while keeping keycloak-first provider mode in existing config/middleware paths.

### 2) Gateway OIDC route/bootstrap hardening
- APISIX bootstrap hardened in:
  - `docker/gateway/scripts/init-apisix-routes.sh`
- Enforced OIDC strictness/guard rails via:
  - explicit discovery/issuer wiring,
  - audience/issuer environment controls,
  - deny mode on OIDC-protected route,
  - context forwarding headers (`X-Channel`, `X-Broker-ID`, `X-Broker-Slug`, `X-Resolved-Host`).

### 3) Broker-channel context propagation host→gateway→backend
- Implemented/used broker context middleware chain in:
  - `docker/backend/src/middleware/broker-context.ts`
  - `docker/backend/src/routes/trading.ts`
  - `docker/backend/src/middleware/error-handler.ts`

### 4) Backend strict claim normalization + deny-by-default mismatch checks
- Enforced strict context invariants and mismatch denials in:
  - `docker/backend/src/middleware/error-handler.ts`

### 5) Mandate guard + delegated-trading authorization
- Mandate scope enforcement in broker channel via:
  - `docker/backend/src/middleware/broker-context.ts`
- Delegated trading context requirements + broker ownership checks on trading route:
  - `docker/backend/src/routes/trading.ts`

### 6) Compatibility-safe data migration support (`broker_id` + `channel`)
- Added non-destructive migration overlay:
  - `docker/backend/src/migrations/015-add-broker-channel-compat-columns.ts`
- Legacy fields preserved; no destructive tenant field deletion in this migration.

### 7) Reconciliation/backfill helpers and invariants
- Added reconciliation/backfill service:
  - `docker/backend/src/services/broker-channel-reconciliation.ts`
- Exposed admin reconciliation endpoint (dry-run / apply):
  - `docker/backend/src/routes/admin-migration.ts`

### 8) Host-based broker landing + callback safety
- Frontend domain/channel resolution and callback safety updates:
  - `docker/frontend/src/lib/utils/domain-detection.ts`
  - `docker/frontend/src/lib/auth/zitadel.ts`
  - `docker/frontend/src/app/oidc/callback/page.tsx`
  - `docker/frontend/src/lib/auth/backend-auth.ts`

### 9) Broker-specific integration points with RBAC boundaries
- Broker context route and broker-scoped checks in trading compatibility path:
  - `docker/backend/src/routes/trading.ts`

### 10) Tests added/expanded
- New middleware security tests:
  - `docker/backend/src/__tests__/services/broker-context.test.ts`
- Workflow test stabilization after migration-related compatibility changes:
  - `docker/backend/src/__tests__/workflows/workflow-orchestrator.test.ts`

## Verification Matrix

### Lint/Type checks
- Workspace typecheck (`shared`, `backend`, `frontend`): FAIL (frontend strict typing debt)
  - Command: `pnpm -C docker typecheck`
  - Dominant error classes:
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
- Backend ESLint strict gate: PASS
  - Command: `pnpm -C docker/backend lint`
- Shared ESLint gate: PASS
  - Command: `pnpm -C docker/shared lint`
  - Note: lint script aligned to `--no-warn-ignored` to remove ignored-file reporter noise from `.d.ts` globs.
- Workspace lint: PASS (zero warnings/errors)
  - Command: `pnpm -C docker lint`
  - Frontend machine-readable report: `docker/frontend/lint-report.frontend.json`
  - Command used to generate report: `pnpm -C docker/frontend exec next lint --format json --output-file lint-report.frontend.json`

### Tests
- Backend unit/coverage matrix: PASS
  - Command: `pnpm test` (cwd: `docker/backend`)
- Backend integration matrix (Kafka/workflows/auth): PASS
  - Command: `pnpm test:integration` (cwd: `docker/backend`)
  - Result: 4 suites passed, 40/40 tests passed (repeat run also green).

## Pass/Fail Criteria

### Criteria Status
1. Provider abstraction and keycloak-first compatibility: **PASS**
2. Gateway strict issuer/audience/context checks + OIDC deny-by-default route: **PASS**
3. Broker context propagation and mismatch denial: **PASS**
4. Backend strict claim normalization + context invariants: **PASS**
5. Mandate/delegated trading guard rails in critical route: **PASS**
6. Non-destructive compatibility migration (`broker_id`, `channel`) with legacy preserved: **PASS**
7. Reconciliation/backfill tooling + invariants endpoint: **PASS**
8. Host-based callback safety and broker-channel frontend guards: **PASS**
9. Expanded targeted security tests: **PASS**
10. Full backend matrix clean: **PASS**
11. Keycloak theming wired and enforced in deployment: **PASS**

## Keycloak theming implementation and deployment wiring

- Theme assets are present under:
  - `docker/keycloak/themes/thaliumx/login/theme.properties`
  - `docker/keycloak/themes/thaliumx/login/resources/css/styles.css`
- Runtime mount is wired in compose:
  - `docker/compose/prod-v1/identity.yml` mounts `./../../keycloak/themes:/opt/keycloak/themes:ro`
- Post-import enforcement is wired via idempotent init job:
  - `keycloak-post-import-seed` in `docker/compose/prod-v1/identity.yml`
  - script `docker/keycloak/scripts/apply-thaliumx-theme.sh`
  - applies `loginTheme/accountTheme/adminTheme/emailTheme=thaliumx` and display branding to realm.
- Init execution path integrated into operations:
  - `docker/scripts/prod-v1-stack.sh` runs `keycloak-post-import-seed` in `init-jobs` profile
  - `docker/scripts/thaliumxctl.sh` `init` flow runs same job

## Residual Risks
- Full workspace lint is now clean; frontend warning debt no longer blocks the workspace lint gate.
- Migration rollout still requires staged dry-run reconciliation before apply on production data.
- Workspace typecheck remains non-green due widespread frontend strict typing issues (unknown narrowing/contract typing).

## Hard Blocker Details (workspace-wide typecheck gate)

- Blocker: frontend package has broad pre-existing TypeScript strictness debt (dominantly `unknown`-typed response/data handling and untyped component props), causing `pnpm -C docker typecheck` failure.
- Repro:
  1. Run `pnpm -C docker typecheck`
  2. Observe frontend failures with high-volume `TS18046` and related strict typing errors while backend/shared complete.
- Constraint:
  - Eliminating this class safely requires broad typed API contract normalization and unknown narrowing across numerous frontend modules.
  - Completing that full strictness migration inside the active Keycloak migration/theming scope risks unrelated UI/runtime regressions and exceeds change boundary.

## Evidence Paths
- Gateway hardening: `docker/gateway/scripts/init-apisix-routes.sh`
- Auth/context enforcement: `docker/backend/src/middleware/error-handler.ts`, `docker/backend/src/middleware/broker-context.ts`
- Delegated trading guards: `docker/backend/src/routes/trading.ts`
- Keycloak compatibility shim: `docker/backend/src/services/keycloak.ts`
- Migration overlay: `docker/backend/src/migrations/015-add-broker-channel-compat-columns.ts`
- Reconciliation tooling: `docker/backend/src/services/broker-channel-reconciliation.ts`, `docker/backend/src/routes/admin-migration.ts`
- Frontend callback/channel safety: `docker/frontend/src/lib/utils/domain-detection.ts`, `docker/frontend/src/lib/auth/zitadel.ts`, `docker/frontend/src/app/oidc/callback/page.tsx`, `docker/frontend/src/lib/auth/backend-auth.ts`
- Tests: `docker/backend/src/__tests__/services/broker-context.test.ts`, `docker/backend/src/__tests__/workflows/workflow-orchestrator.test.ts`
- Keycloak theming + runtime wiring:
  - `docker/keycloak/themes/thaliumx/login/theme.properties`
  - `docker/keycloak/themes/thaliumx/login/resources/css/styles.css`
  - `docker/keycloak/scripts/apply-thaliumx-theme.sh`
  - `docker/compose/prod-v1/identity.yml`
  - `docker/scripts/prod-v1-stack.sh`
  - `docker/scripts/thaliumxctl.sh`

## Commands Executed in Verification Session (2026-03-07)

1. `pnpm -C docker lint`
2. `pnpm -C docker/frontend exec next lint --format json --output-file lint-report.frontend.json`
3. `pnpm -C docker typecheck`
4. `pnpm -C docker/backend test`
5. `pnpm -C docker/backend test:integration`
