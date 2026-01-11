# Phase 3: KYC System

## Overview

This phase implements the complete KYC (Know Your Customer) system with all 5 levels (L0, L1, L2, L3, INSTITUTIONAL), upgrade flows, document submission, and limit management as specified in `PLATFORM_FEATURES_AND_MENU_STRUCTURE.md`.

## Objectives

1. Implement KYC level display and management
2. Create KYC upgrade workflows
3. Implement document submission interface
4. Create limit display and tracking
5. Implement upgrade triggers and prompts
6. Create KYC status dashboard

## KYC Levels

### L0 - Web3 Basic
- Automatic on wallet connection
- No documents required
- Basic limits

### L1 - Basic Verification
- Email + Phone verification
- Sanctions check
- Higher limits

### L2 - Identity Verified
- Government ID
- Proof of Address
- Biometric verification
- PEP check
- Face verification

### L3 - Enhanced Verification
- All L2 requirements
- Source of Funds
- Enhanced screening
- Maximum limits

### INSTITUTIONAL - Institutional/KYB
- Business registration
- Incorporation documents
- Ownership structure
- Authorized signatories
- Regulatory licenses

## Implementation Requirements

### 1. KYC Status Display

#### Components
- `KYCStatusCard` - Display current KYC level
- `KYCLimitDisplay` - Display current limits
- `KYCProgressBar` - Show progress to next level
- `KYCUpgradePrompt` - Prompt for upgrade
- `KYCBlockingModal` - Block transaction modal

#### Features
- Current level display
- Limit usage display
- Progress to next level
- Upgrade benefits display
- Warning at 80% usage
- Blocking at 100% usage

### 2. KYC Upgrade Flow

#### Upgrade Workflow
1. User triggers upgrade (manual or automatic)
2. Show upgrade requirements
3. Collect required documents
4. Submit to Ballerine workflow
5. Track workflow status
6. Show approval/rejection

#### Components
- `KYCUpgradeWizard` - Multi-step upgrade wizard
- `KYCDocumentUpload` - Document upload interface
- `KYCWorkflowTracker` - Track workflow progress
- `KYCApprovalStatus` - Show approval status

### 3. Document Submission

#### Document Types
- NATIONAL_ID
- PROOF_OF_ADDRESS
- BIOMETRIC_DATA
- PASSPORT
- PROOF_OF_INCOME
- SOURCE_OF_FUNDS
- BUSINESS_LICENSE
- ARTICLES_OF_INCORPORATION
- CERTIFICATE_OF_INCORPORATION
- BANK_STATEMENT

#### Components
- `DocumentUploader` - File upload component
- `DocumentPreview` - Preview uploaded documents
- `DocumentValidator` - Validate document format
- `DocumentList` - List submitted documents

### 4. Limit Management

#### Limit Display
- Current limits by type (investment, trading, withdrawal, deposit)
- Usage statistics
- Remaining limits
- Daily/monthly breakdown

#### Components
- `TransactionLimitsDisplay` - Display all limits
- `LimitUsageChart` - Visualize limit usage
- `LimitWarningBanner` - Show warnings
- `LimitBlockingBanner` - Show blocking messages

### 5. Upgrade Triggers

#### Automatic Triggers
- 80% limit usage (warning)
- 100% limit usage (blocking)
- Transaction attempt exceeding limits
- Feature access requiring higher level

#### Manual Triggers
- User-initiated upgrade
- Account settings upgrade button

#### Components
- `UpgradeTriggerHandler` - Handle upgrade triggers
- `UpgradePromptModal` - Show upgrade prompt
- `UpgradeBlockingModal` - Block with upgrade option

### 6. KYC Dashboard

#### Admin KYC Dashboard
- All users KYC status
- Pending reviews
- Approved users
- Rejected users
- KYC analytics

#### User KYC Dashboard
- Current status
- Document status
- Workflow progress
- Upgrade options

## Component Structure

```
components/kyc/
├── KYCStatusCard.tsx
├── KYCLimitDisplay.tsx
├── KYCProgressBar.tsx
├── KYCUpgradePrompt.tsx
├── KYCBlockingModal.tsx
├── KYCUpgradeWizard.tsx
├── KYCDocumentUpload.tsx
├── KYCWorkflowTracker.tsx
├── KYCApprovalStatus.tsx
├── DocumentUploader.tsx
├── DocumentPreview.tsx
├── DocumentValidator.tsx
├── DocumentList.tsx
├── TransactionLimitsDisplay.tsx
├── LimitUsageChart.tsx
├── LimitWarningBanner.tsx
└── LimitBlockingBanner.tsx
```

## API Integration

### Endpoints
- `GET /api/kyc/status` - Get KYC status
- `POST /api/kyc/submit` - Submit KYC documents
- `GET /api/kyc/level/:userId` - Get KYC level
- `PUT /api/kyc/level/:userId` - Update KYC level (admin)
- `POST /api/kyc/upgrade` - Request upgrade
- `GET /api/kyc/workflows` - Get workflows
- `GET /api/admin/user-limits/:userId` - Get user limits

### React Query Hooks
- `useKYCStatus` - Get KYC status
- `useKYCUpgrade` - Trigger upgrade
- `useKYCDocuments` - Manage documents
- `useKYCWorkflow` - Track workflow
- `useUserLimits` - Get user limits

## State Management

### KYC Store (Zustand)
```typescript
interface KYCStore {
  currentLevel: KYCLevel;
  status: KYCStatus;
  limits: KYCLimits;
  documents: Document[];
  workflowStatus: WorkflowStatus;
  // Actions
  fetchKYCStatus: () => Promise<void>;
  submitDocuments: (docs: Document[]) => Promise<void>;
  triggerUpgrade: (level: KYCLevel) => Promise<void>;
}
```

## Upgrade Flow Logic

### Warning Threshold (80%)
1. Check limit usage
2. Show warning banner
3. Show upgrade prompt
4. Allow transaction (with warning)

### Blocking Threshold (100%)
1. Check limit usage
2. Block transaction
3. Show blocking modal
4. Force upgrade workflow

### Upgrade Workflow
1. Determine required level
2. Show requirements
3. Collect documents
4. Submit to Ballerine
5. Track progress
6. Show result

## Success Criteria

1. ✅ All KYC levels are displayed correctly
2. ✅ Upgrade workflows work end-to-end
3. ✅ Document submission is functional
4. ✅ Limits are displayed and tracked
5. ✅ Upgrade triggers work correctly
6. ✅ Warning and blocking states work
7. ✅ KYC dashboard is functional

## Next Steps

After completing Phase 3, proceed to:
- Phase 4: Role-Based Access (uses KYC levels)
- Phase 5: Trading (uses KYC limits)
- Phase 9: Limit Management (admin control)
