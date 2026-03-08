# Broker Data Migration Plan

## Goal
Normalize business data model from legacy tenant naming to broker plus channel naming without service interruption.

## Migration Principles
1. Compatibility first
2. Deny unsafe context combinations
3. Observable and reversible phases
4. No new tenant semantic usage in business domain

## Canonical Fields
- `channel` direct or broker
- `broker_id` nullable for direct channel and required for broker channel
- `customer_id` where customer scoping applies
- `mandate_id` for delegated operations

## Legacy Field Handling
- Existing `tenant_id` remains during transition
- Canonical authorization decisions use channel plus broker semantics
- Introduce adapter layer to map legacy reads and writes safely

## Phase Plan

## Phase 0 Inventory and impact map
1. Build table and endpoint inventory using `tenant_id` and `broker_id`
2. Classify each artifact
   - keep as platform-global
   - migrate to broker scoped
   - dual scoped by channel
3. Define critical path services and cutover order

Deliverables:
- inventory matrix
- migration wave map

## Phase 1 Schema compatibility overlay
1. Add `broker_id` and `channel` columns where missing
2. Add nullable constraints initially
3. Add indexes for new access paths
4. Add write triggers or app guards for consistency checks

Guard rules:
- broker channel requires non-null `broker_id`
- direct channel requires null or absent `broker_id` unless explicit exception

Deliverables:
- migration scripts v1
- compatibility constraints and index scripts

## Phase 2 Dual write and dual read
1. Backend writes both legacy and canonical fields
2. Read paths prefer canonical fields and fallback to legacy
3. Middleware enforces host, token, payload broker consistency

Validation checks:
- count parity legacy vs canonical columns
- mismatch report per service boundary

Deliverables:
- adapter implementation notes
- reconciliation query pack

## Phase 3 Backfill and data quality
1. Backfill `broker_id` and `channel` from trusted mapping rules
2. Resolve ambiguous records through review queue
3. Create signed data quality report

Mapping precedence:
1. explicit broker mapping table
2. audited event history context
3. user-broker relationship source
4. manual review

Deliverables:
- backfill scripts
- ambiguity resolution protocol
- quality certification report

## Phase 4 Canonicalization
1. Switch business services to canonical broker-plus-channel fields
2. Rename indexes and constraints to broker naming
3. Add CI guard to block new tenant semantic field introduction

Deliverables:
- canonical service release notes
- CI policy rule definition

## Phase 5 Legacy deprecation
1. Keep legacy read fallback for two green release cycles
2. Remove fallback paths after stability gate
3. Archive mapping and validation evidence

Deliverables:
- deprecation checklist sign-off
- archived migration evidence bundle

## Cross-Service Constraints
Any write must fail when:
1. host broker context and token broker claim mismatch
2. payload broker differs from resolved broker context
3. broker action attempted on direct channel without explicit override

## Rollback Strategy

### Rollback scope
- schema rollback where safe
- application flag rollback to dual-read mode
- gateway strict enforcement softening only under emergency control

### Rollback prerequisites
1. pre-change backup snapshot
2. rollback SQL prepared and tested
3. incident owner and communication plan assigned

### Rollback triggers
- sustained mismatch growth above threshold
- mandate enforcement failures in broker channel
- material query regression or integrity violations

## Test and Validation Matrix
1. schema migration unit tests
2. data backfill validation tests
3. broker channel end-to-end flow tests
4. direct channel isolation tests
5. regression suite for critical financial operations

## Operational Metrics
Track:
- mismatch count legacy vs canonical
- null broker_id count for broker channel records
- context mismatch deny count
- migration job failure rate

Alert thresholds are defined in runbook.

## Dependencies
- auth contract [`plans/keycloak-auth-contract.md`](plans/keycloak-auth-contract.md)
- host architecture [`plans/broker-landing-host-architecture.md`](plans/broker-landing-host-architecture.md)
- domain model [`plans/broker-first-operating-model.md`](plans/broker-first-operating-model.md)

## Acceptance Criteria
1. All broker channel writes include valid broker_id.
2. Direct channel records do not carry unintended broker context.
3. Dual-read mismatch rate is below agreed threshold for two cycles.
4. Canonical broker-plus-channel model is default in all critical services.
5. Legacy tenant semantics are deprecated with evidence archived.

