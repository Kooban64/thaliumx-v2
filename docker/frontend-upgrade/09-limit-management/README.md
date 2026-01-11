# Phase 9: Admin Limit Configuration System

## Overview

This phase implements a comprehensive admin interface for configuring all transaction limits dynamically, eliminating hardcoded values. Admins can configure KYC level limits, role-based limits, and user-specific overrides.

## Objectives

1. Create admin interface for KYC level limit configuration
2. Create admin interface for role-based limit configuration
3. Create user-specific limit override interface
4. Implement limit validation and testing
5. Create limit history and audit trail
6. Implement limit change notifications

## Key Principle

**No Hardcoding**: All limits must be configurable through the admin interface. The system should have sensible defaults but allow full administrative control.

## Implementation Requirements

### 1. KYC Level Limit Configuration

#### Features
- Configure default limits for each KYC level (L0, L1, L2, L3, INSTITUTIONAL)
- Configure limit types:
  - Max Investment
  - Max Trading
  - Max Withdrawal
  - Max Deposit
  - Max Daily Transactions
- Currency-specific limits
- Real-time validation
- Preview changes before saving

#### Components
- `KYCLimitConfig` - Main configuration interface
- `KYCLimitEditor` - Edit limits for a level
- `LimitTypeSelector` - Select limit type
- `CurrencyLimitConfig` - Currency-specific limits
- `LimitPreview` - Preview changes
- `LimitValidator` - Validate limits

### 2. Role-Based Limit Configuration

#### Features
- Configure limits for each role
- Platform roles, broker roles, user roles
- Limit types:
  - Max Daily Volume
  - Max Monthly Volume
  - Max Single Transaction
  - Max Withdrawal Daily/Monthly
  - Max Deposit Daily/Monthly
- Currency support

#### Components
- `RoleLimitConfig` - Role limit configuration
- `RoleLimitEditor` - Edit role limits
- `RoleSelector` - Select role
- `RoleLimitPreview` - Preview changes

### 3. User-Specific Overrides

#### Features
- Override KYC limits for specific users
- Temporary overrides (with expiry)
- Permanent overrides
- Override reason tracking
- Override approval workflow

#### Components
- `UserLimitOverride` - User override interface
- `OverrideEditor` - Edit override
- `OverrideTypeSelector` - Temporary/Permanent
- `OverrideApproval` - Approval workflow
- `OverrideHistory` - Override history

### 4. Limit Validation & Testing

#### Features
- Validate limit changes
- Test limit impact
- Preview affected users
- Simulate transactions
- Validate limit hierarchy

#### Components
- `LimitValidator` - Validate limits
- `LimitTester` - Test limit changes
- `ImpactPreview` - Preview impact
- `TransactionSimulator` - Simulate transactions

### 5. Limit History & Audit

#### Features
- Track all limit changes
- Show change history
- Audit trail
- Change approval tracking
- Rollback capability

#### Components
- `LimitHistory` - Change history
- `LimitAuditTrail` - Audit trail
- `LimitChangeDetails` - Change details
- `LimitRollback` - Rollback changes

### 6. Limit Change Notifications

#### Features
- Notify affected users
- Notification preferences
- Email notifications
- In-app notifications
- Notification history

#### Components
- `LimitNotificationSettings` - Notification settings
- `NotificationPreview` - Preview notifications
- `NotificationHistory` - Notification history

## Component Structure

```
components/limits/
├── KYCLimitConfig.tsx
├── KYCLimitEditor.tsx
├── LimitTypeSelector.tsx
├── CurrencyLimitConfig.tsx
├── LimitPreview.tsx
├── LimitValidator.tsx
├── RoleLimitConfig.tsx
├── RoleLimitEditor.tsx
├── UserLimitOverride.tsx
├── OverrideEditor.tsx
├── OverrideApproval.tsx
├── LimitHistory.tsx
├── LimitAuditTrail.tsx
└── LimitChangeDetails.tsx
```

## API Integration

### Endpoints (to be created in backend)
- `GET /api/admin/limits/kyc` - Get KYC limits
- `PUT /api/admin/limits/kyc/:level` - Update KYC limits
- `GET /api/admin/limits/roles` - Get role limits
- `PUT /api/admin/limits/roles/:role` - Update role limits
- `GET /api/admin/limits/users/:userId` - Get user overrides
- `POST /api/admin/limits/users/:userId/override` - Create override
- `DELETE /api/admin/limits/users/:userId/override/:id` - Remove override
- `GET /api/admin/limits/history` - Get limit history
- `POST /api/admin/limits/validate` - Validate limits
- `POST /api/admin/limits/test` - Test limit changes

### React Query Hooks
- `useKYCLimits` - KYC limit management
- `useRoleLimits` - Role limit management
- `useUserOverrides` - User override management
- `useLimitHistory` - Limit history
- `useLimitValidation` - Limit validation

## State Management

### Limit Store (Zustand)
```typescript
interface LimitStore {
  kycLimits: Record<string, KYCLimits>;
  roleLimits: Record<string, RoleLimits>;
  userOverrides: Record<string, UserOverride[]>;
  limitHistory: LimitChange[];
  // Actions
  fetchKYCLimits: () => Promise<void>;
  updateKYCLimits: (level: string, limits: KYCLimits) => Promise<void>;
  fetchRoleLimits: () => Promise<void>;
  updateRoleLimits: (role: string, limits: RoleLimits) => Promise<void>;
  createUserOverride: (userId: string, override: UserOverride) => Promise<void>;
  fetchLimitHistory: () => Promise<void>;
}
```

## Limit Configuration Flow

### KYC Limit Update Flow
1. Admin opens KYC limit configuration
2. Admin selects KYC level
3. Admin edits limits
4. System validates changes
5. System shows preview and impact
6. Admin confirms changes
7. System saves changes
8. System notifies affected users
9. System logs change to audit trail

### Role Limit Update Flow
1. Admin opens role limit configuration
2. Admin selects role
3. Admin edits limits
4. System validates changes
5. System shows preview
6. Admin confirms changes
7. System saves changes
8. System logs change

### User Override Flow
1. Admin opens user details
2. Admin creates limit override
3. Admin selects override type (temporary/permanent)
4. Admin sets limits and expiry (if temporary)
5. Admin provides reason
6. System validates override
7. System shows approval (if required)
8. System applies override
9. System notifies user
10. System logs override

## Success Criteria

1. ✅ All limits are configurable via admin interface
2. ✅ KYC level limits can be updated
3. ✅ Role-based limits can be updated
4. ✅ User-specific overrides work
5. ✅ Limit validation works
6. ✅ Limit history is tracked
7. ✅ Audit trail is complete
8. ✅ Notifications work
9. ✅ No hardcoded limits remain

## Next Steps

After completing Phase 9, proceed to:
- Phase 10: Integration (testing limit management)
- Backend: Create limit management API endpoints
