# Keycloak Implementation Checklist

## Usage
- Update status at start and end of every session
- Keep evidence links in notes column
- Do not mark complete without validation evidence

## Status Key
- [ ] pending
- [-] in progress
- [x] complete

## Stage 0 Architecture and policy lock
- [ ] Approve [`plans/keycloak-broker-channel-master-plan.md`](plans/keycloak-broker-channel-master-plan.md)
- [ ] Approve [`plans/broker-first-operating-model.md`](plans/broker-first-operating-model.md)
- [ ] Approve [`plans/keycloak-auth-contract.md`](plans/keycloak-auth-contract.md)
- [ ] Approve [`plans/broker-landing-host-architecture.md`](plans/broker-landing-host-architecture.md)
- [ ] Approve [`plans/broker-data-migration-plan.md`](plans/broker-data-migration-plan.md)

## Stage 1 Keycloak and gateway foundation
- [x] Pin Keycloak latest stable image tag and lock upgrade policy
- [ ] Configure single realm, required roles, required claim mappers
- [ ] Configure OIDC clients for web and backend
- [ ] Implement host-based broker routing in gateway
- [x] Implement host context to token claim mismatch hard deny
- [ ] Validate direct and broker channel auth happy paths

## Stage 2 Backend normalization and mandate enforcement
- [ ] Add channel resolver middleware
- [ ] Add broker context resolver middleware
- [ ] Add mandate guard middleware for delegated trading
- [ ] Enforce broker ownership checks for customer operations
- [ ] Enforce direct-channel isolation from broker actions
- [ ] Add audit fields channel broker_id customer_id mandate_id actor_id

## Stage 3 Data compatibility migration
- [ ] Complete field inventory for tenant_id and broker_id usage
- [ ] Add broker_id and channel columns where missing
- [ ] Implement dual-read dual-write adapters
- [ ] Backfill broker_id and channel values
- [ ] Run mismatch reconciliation and resolve ambiguous records
- [ ] Enable CI guard against new tenant semantic usage

## Stage 4 Broker landing and customer operations
- [ ] Activate host-based broker landing pages
- [ ] Implement broker branding configuration path
- [ ] Implement broker customer management screens and APIs
- [ ] Implement delegated trade flows with mandate checks
- [ ] Validate broker-specific reporting and access isolation

## Stage 5 Hardening and operations
- [ ] Configure TLS wildcard and DNS automation checks
- [ ] Configure secret rotation workflow and validation
- [ ] Configure auth and mandate observability dashboards
- [ ] Run backup and restore drill for identity and data stores
- [-] Run rollback rehearsal for gateway and auth contract

## Stage 6 Production go-live and stabilization
- [ ] Execute canary launch for broker channel
- [ ] Validate auth error rates and policy deny rates
- [ ] Validate mandate enforcement telemetry
- [ ] Complete post-launch verification checklist
- [ ] Approve deprecation window for legacy tenant naming paths

## Cross-cutting controls
- [x] Update [`plans/keycloak-risk-register.md`](plans/keycloak-risk-register.md) each session
- [ ] Record deviations and decisions in related plan docs
- [x] Keep runbook current in [`plans/keycloak-runbook.md`](plans/keycloak-runbook.md)
- [ ] Keep next action documented at end of each session

## Evidence Log
- Session date: 2026-03-07
- Active stage: Stage 1 and Stage 5 hardening
- Completed items:
  - Keycloak image pin verified (`quay.io/keycloak/keycloak:26.1.1`)
  - Host/token mismatch hard-deny retained in backend/gateway path
  - Keycloak ThaliumX theme post-import enforcement wired as idempotent init job
- Evidence links:
  - [`docker/compose/prod-v1/identity.yml`](docker/compose/prod-v1/identity.yml)
  - [`docker/keycloak/scripts/apply-thaliumx-theme.sh`](docker/keycloak/scripts/apply-thaliumx-theme.sh)
  - [`docker/scripts/prod-v1-stack.sh`](docker/scripts/prod-v1-stack.sh)
  - [`docker/scripts/thaliumxctl.sh`](docker/scripts/thaliumxctl.sh)
  - [`docker/keycloak/themes/thaliumx/login/theme.properties`](docker/keycloak/themes/thaliumx/login/theme.properties)
  - [`docker/keycloak/themes/thaliumx/login/resources/css/styles.css`](docker/keycloak/themes/thaliumx/login/resources/css/styles.css)
- Open blockers:
  - Workspace lint is now clean (no frontend/shared/backend warnings or errors):
    - Command: `pnpm -C docker lint`
    - Machine-readable report: `docker/frontend/lint-report.frontend.json`
  - Workspace typecheck is currently non-green due pre-existing frontend strictness debt:
    - Command: `pnpm -C docker typecheck`
    - Error code counts:
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
    - Highest-density files (top):
      - `src/lib/api/hooks/useBroker.ts` (49)
      - `src/components/admin/brokers/BrokerList.tsx` (24)
      - `src/components/broker/trading/BrokerTradingConfig.tsx` (23)
      - `src/components/admin/users/UserList.tsx` (23)
      - `src/lib/api/support.ts` (22)
- Next action:
  - Execute dedicated frontend type-hardening workstream (unknown narrowing, API response contract typing, component prop typing), then re-run workspace quality gates.
