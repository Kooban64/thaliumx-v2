# Workflow Orchestrator - Workflows Directory

This directory contains all workflow implementations for the ThaliumX platform.

## Architecture

All workflows follow the **Saga Pattern** for distributed transaction management:
- Each workflow is a series of steps executed sequentially
- Each step can have a compensation function for rollback
- Workflow state is persisted after each step
- Supports retry logic and timeouts

## Implemented Workflows

### Core Workflows (9 implemented)

1. **User Onboarding** (`user-onboarding.ts`)
   - 8 steps: Validate → KYC → Wait → Create User → Setup Wallets → Email → Complete
   - Full compensation support

2. **Trading Order** (`trading-order.ts`)
   - 7 steps: Validate → Compliance → Reserve → Submit → Wait → Settle → Event
   - Fund reservation with compensation

3. **Payment Processing** (`payment-processing.ts`)
   - 7 steps: Validate → Fraud → Compliance → Dual Auth → Execute → Verify → Event
   - Fraud detection and dual authorization

4. **Order Cancellation** (`order-cancellation.ts`)
   - 4 steps: Validate → Cancel → Release Funds → Event

5. **User Suspension** (`user-suspension.ts`)
   - 4 steps: Validate → Suspend → Cancel Orders → Notify

6. **User Reactivation** (`user-reactivation.ts`)
   - 5 steps: Validate → Compliance → Reactivate → Restore → Notify

7. **Refund Processing** (`refund-processing.ts`)
   - 5 steps: Validate → Check Transaction → Process → Update → Event

8. **Token Issuance** (`token-issuance.ts`)
   - 6 steps: Validate → Compliance → Deploy → Mint → Distribute → Event

9. **Broker Onboarding** (`broker-onboarding.ts`)
   - 6 steps: Validate → KYC → Create Tenant → Setup Accounts → Configure → Notify

## Remaining Workflows (39)

Use `WORKFLOW_TEMPLATE.ts` as a starting point for new workflows.

### Categories:

**User Management (6 remaining)**
- Password Reset
- Account Closure
- API Key Rotation
- Credential Rotation
- User Profile Update

**Trading Operations (10 remaining)**
- Order Modification
- Order Expiration
- Stop-Loss/Take-Profit
- Margin Trading Position
- DEX Swap
- Yield Farming
- Staking
- Liquidity Mining
- Liquidity Pool Management
- Cross-Chain Bridge

**Payment Processing (4 remaining)**
- Chargeback Dispute
- Settlement Batch
- Fiat Operations
- Reconciliation

**Compliance & Risk (8 remaining)**
- KYC Reverification
- Compliance Case Review
- Suspicious Activity Investigation
- Regulatory Reporting
- Token Freeze
- Risk Monitoring
- Audit Log Generation
- Data Migration

**Web3 Operations (8 remaining)**
- Web3 Wallet Creation
- NFT Minting
- NFT Transfer
- Token Distribution
- Token Vesting Release
- Token Burn
- Smart Contract Deployment
- Smart Contract Upgrade
- Multi-Sig Setup

**Infrastructure (5 remaining)**
- Backup Creation
- Service Health Check
- Configuration Update
- Governance Proposal
- Token Sale

## Creating a New Workflow

1. Copy `WORKFLOW_TEMPLATE.ts` to `{workflow-name}.ts`
2. Update the workflow function name
3. Implement saga steps with:
   - `name`: Step identifier
   - `execute`: Step logic
   - `compensate`: Rollback logic (optional)
   - `retryable`: Whether step can be retried (default: true)
   - `maxRetries`: Maximum retry attempts
   - `timeout`: Step timeout in milliseconds
4. Register workflow at bottom:
   ```typescript
   WorkflowOrchestratorService.registerWorkflow(
     WorkflowType.WORKFLOW_NAME,
     createWorkflowNameWorkflow
   );
   ```
5. Import in `index.ts`

## Best Practices

1. **Always add compensation** for steps that create resources (users, accounts, orders)
2. **Use meaningful step names** that describe what the step does
3. **Log important operations** using LoggerService
4. **Handle errors gracefully** - throw errors for saga executor to handle
5. **Store context** in workflow data for compensation
6. **Use retryable: false** for validation steps
7. **Set appropriate timeouts** for async operations

## Testing

- Unit tests: `src/__tests__/workflows/{workflow-name}.test.ts`
- Integration tests: `src/__tests__/workflows/integration.test.ts`

## Workflow State

Workflow state is persisted in the `workflow_states` table:
- `workflow_id`: Unique workflow identifier
- `workflow_type`: Type of workflow
- `status`: Current status (pending, running, completed, failed, cancelled)
- `current_step`: Current step name
- `step_index`: Current step index
- `data`: JSONB field for workflow data
- `error_message`: Error message if failed
- `retry_count`: Number of retries attempted

## Event-Driven Continuation

Some workflows wait for external events:
- **User Onboarding**: Waits for Ballerine KYC webhook
- **Trading Order**: Waits for order fill event
- **Payment Processing**: Waits for transaction completion

These workflows use `continueWorkflow()` to resume execution when events arrive.

## API Usage

Start a workflow:
```typescript
POST /api/workflows/start
{
  "workflowType": "user_onboarding",
  "data": { ... }
}
```

Get status:
```typescript
GET /api/workflows/:workflowId/status
```

Cancel:
```typescript
POST /api/workflows/:workflowId/cancel
{
  "reason": "User requested"
}
```
