# Keycloak Broker Channel Risk Register

## Purpose
Track risks, impact, controls, owners, and validation evidence across the broker-channel rollout.

## Status Scale
- Open
- Mitigating
- Monitoring
- Closed

## Risk Register

| ID | Risk | Impact | Likelihood | Status | Mitigation | Validation Evidence |
|---|---|---|---|---|---|---|
| R1 | Host context and token broker claim mismatch | Unauthorized cross-broker access risk | Medium | Mitigating | Enforce hard deny in gateway and backend, signed host resolution context | Backend/gateway mismatch-deny behavior verified in current integration pass and migration hardening evidence |
| R2 | Legacy tenant semantics leak into new broker model | Inconsistent authorization and data handling | High | Open | CI guard to block new tenant semantic usage, dual-read compatibility layer, staged deprecation | Static scan reports, PR checks |
| R3 | Mandate guard bypass in delegated trade paths | Regulatory and legal exposure | Medium | Mitigating | Mandatory mandate middleware for trade actions, deny-by-default when missing scope or inactive mandate | Mandate enforcement path validated in broker-channel migration verification and backend integration matrix |
| R4 | Broker host onboarding drift DNS TLS routing | Broker onboarding outages | Medium | Open | Automated provisioning workflow with post-provision smoke checks | Provisioning logs and smoke test pass |
| R5 | Keycloak client or mapper drift across environments | Auth failures or wrong claims in tokens | Medium | Mitigating | Config as code and environment parity checks, release gate verification; enforce post-import realm hardening job | `keycloak-post-import-seed` init job applies canonical ThaliumX realm theme and settings idempotently |
| R6 | Data migration backfill ambiguity | Incorrect broker assignment in historical records | Medium | Open | Deterministic mapping precedence and manual review queue for ambiguous records | Backfill quality report |
| R7 | Rollback untested for migration and auth changes | Prolonged outage during incident | Medium | Open | Mandatory rollback rehearsal per stage before production go-live | Rehearsal report in runbook |
| R8 | Secrets rotation causes auth interruptions | Login and API disruptions | Low | Open | Dual-secret rotation window where supported, staged rollout and validation | Rotation checklist evidence |
| R9 | Direct channel polluted with broker context | Incorrect policy enforcement for public users | Medium | Mitigating | Channel resolver hard enforcement, null broker rules for direct channel | Broker-context middleware and route guard tests plus integration pass in current run |
| R10 | Incomplete audit chain for delegated actions | Compliance audit gap | Medium | Mitigating | Require channel, broker_id, customer_id, mandate_id, actor_id in audit events | Audit field continuity validated in migration hardening and integration outcomes |

## Session Update 2026-03-07

- Updated statuses moved to **Mitigating** where controls are now implemented and validated in current verification runs.
- Docker workspace lint warning debt is cleared:
  - `pnpm -C docker lint` reports no ESLint warnings/errors across `shared`, `backend`, and `frontend`.
  - machine-readable frontend lint report generated at `docker/frontend/lint-report.frontend.json`.
- Remaining open focus is frontend TypeScript strictness debt blocking workspace-wide typecheck gate:
  - `pnpm -C docker typecheck` currently fails with dominant classes:
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

## Stage Gate Risk Checks

### Stage 0
- Confirm R1 R2 R3 controls are designed and approved

### Stage 1
- Confirm host and token mismatch checks active for R1
- Confirm mapper parity checks active for R5

### Stage 2
- Confirm mandate enforcement checks active for R3
- Confirm direct channel isolation checks active for R9

### Stage 3
- Confirm backfill quality and ambiguity handling for R6
- Confirm rollback rehearsal readiness for R7

### Stage 4
- Confirm broker onboarding reliability controls for R4

### Stage 5 and 6
- Confirm secret rotation evidence for R8
- Confirm audit completeness evidence for R10

## Ownership Template
- Product owner:
- Security owner:
- Platform owner:
- Data owner:
- Compliance owner:

## Review Cadence
- Weekly during active implementation
- Per release before go-live window
- Post-incident immediate review and update

## Linkage
- Master plan: [`plans/keycloak-broker-channel-master-plan.md`](plans/keycloak-broker-channel-master-plan.md)
- Checklist: [`plans/keycloak-implementation-checklist.md`](plans/keycloak-implementation-checklist.md)
- Runbook: [`plans/keycloak-runbook.md`](plans/keycloak-runbook.md)
- Auth contract: [`plans/keycloak-auth-contract.md`](plans/keycloak-auth-contract.md)
