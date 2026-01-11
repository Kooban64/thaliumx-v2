# Phase 9: Admin Limit Configuration System - Todos

## KYC Level Limit Configuration

- [ ] Create `/admin/limits/kyc` page
  - [ ] KYC level selector
  - [ ] Limit configuration interface
  - [ ] All limit types
- [ ] Create `KYCLimitConfig` component
  - [ ] Level selection
  - [ ] Limit display
  - [ ] Edit functionality
- [ ] Create `KYCLimitEditor` component
  - [ ] Limit input fields
  - [ ] Validation
  - [ ] Currency support
- [ ] Create `LimitTypeSelector` component
  - [ ] Select limit type
  - [ ] Show current value
- [ ] Create `CurrencyLimitConfig` component
  - [ ] Currency selection
  - [ ] Currency-specific limits
- [ ] Create `LimitPreview` component
  - [ ] Preview changes
  - [ ] Show impact
- [ ] Create `LimitValidator` component
  - [ ] Validate limits
  - [ ] Show validation errors

## Role-Based Limit Configuration

- [ ] Create `/admin/limits/roles` page
  - [ ] Role selector
  - [ ] Limit configuration
- [ ] Create `RoleLimitConfig` component
  - [ ] Role selection
  - [ ] Limit display
- [ ] Create `RoleLimitEditor` component
  - [ ] Limit input fields
  - [ ] Validation
- [ ] Create `RoleSelector` component
  - [ ] Role selection
  - [ ] Role categories
- [ ] Create `RoleLimitPreview` component
  - [ ] Preview changes
  - [ ] Show impact

## User-Specific Overrides

- [ ] Create `/admin/limits/users/:userId/override` page
  - [ ] Override interface
  - [ ] Override type selection
- [ ] Create `UserLimitOverride` component
  - [ ] Override display
  - [ ] Create override
  - [ ] Edit override
- [ ] Create `OverrideEditor` component
  - [ ] Override input
  - [ ] Expiry date (temporary)
  - [ ] Reason input
- [ ] Create `OverrideTypeSelector` component
  - [ ] Temporary/Permanent
  - [ ] Expiry date for temporary
- [ ] Create `OverrideApproval` component
  - [ ] Approval workflow
  - [ ] Approval status
- [ ] Create `OverrideHistory` component
  - [ ] Override history
  - [ ] Override details

## Limit Validation & Testing

- [ ] Create `LimitValidator` utility
  - [ ] Validate limit values
  - [ ] Validate limit hierarchy
  - [ ] Check for conflicts
- [ ] Create `LimitTester` component
  - [ ] Test limit changes
  - [ ] Simulate transactions
  - [ ] Show test results
- [ ] Create `ImpactPreview` component
  - [ ] Show affected users
  - [ ] Show impact analysis
- [ ] Create `TransactionSimulator` component
  - [ ] Simulate transactions
  - [ ] Show limit checks

## Limit History & Audit

- [ ] Create `/admin/limits/history` page
  - [ ] Limit change history
  - [ ] Filters
  - [ ] Search
- [ ] Create `LimitHistory` component
  - [ ] History list
  - [ ] Change details
  - [ ] Filters
- [ ] Create `LimitAuditTrail` component
  - [ ] Audit trail display
  - [ ] Audit filters
- [ ] Create `LimitChangeDetails` component
  - [ ] Change details
  - [ ] Before/after comparison
  - [ ] Change metadata
- [ ] Create `LimitRollback` component
  - [ ] Rollback functionality
  - [ ] Rollback confirmation

## Limit Change Notifications

- [ ] Create `LimitNotificationSettings` component
  - [ ] Notification preferences
  - [ ] Notification types
- [ ] Create `NotificationPreview` component
  - [ ] Preview notifications
  - [ ] Notification templates
- [ ] Create `NotificationHistory` component
  - [ ] Notification history
  - [ ] Notification status

## API Integration

- [ ] Create backend API endpoints (coordinate with backend team)
  - [ ] GET/PUT KYC limits
  - [ ] GET/PUT role limits
  - [ ] GET/POST/DELETE user overrides
  - [ ] GET limit history
  - [ ] POST limit validation
  - [ ] POST limit testing
- [ ] Create `useKYCLimits` hook
- [ ] Create `useRoleLimits` hook
- [ ] Create `useUserOverrides` hook
- [ ] Create `useLimitHistory` hook
- [ ] Create `useLimitValidation` hook
- [ ] Integrate with backend API
- [ ] Handle API errors
- [ ] Handle loading states

## State Management

- [ ] Create `limitStore` (Zustand)
  - [ ] KYC limits state
  - [ ] Role limits state
  - [ ] User overrides state
  - [ ] Limit history state
- [ ] Create limit actions
  - [ ] Fetch KYC limits
  - [ ] Update KYC limits
  - [ ] Fetch role limits
  - [ ] Update role limits
  - [ ] Create user override
  - [ ] Fetch limit history

## Limit Configuration Flow

- [ ] Implement KYC limit update flow
- [ ] Implement role limit update flow
- [ ] Implement user override flow
- [ ] Implement limit validation
- [ ] Implement limit testing
- [ ] Implement notification system
- [ ] Implement audit trail

## Remove Hardcoded Limits

- [ ] Audit codebase for hardcoded limits
- [ ] Replace hardcoded limits with API calls
- [ ] Update all limit references
- [ ] Test limit loading
- [ ] Test limit updates

## Testing

- [ ] Test KYC limit configuration
- [ ] Test role limit configuration
- [ ] Test user overrides
- [ ] Test limit validation
- [ ] Test limit testing
- [ ] Test limit history
- [ ] Test notifications
- [ ] Test audit trail

## Documentation

- [ ] Document limit management system
- [ ] Document limit configuration
- [ ] Document user overrides
- [ ] Document API integration
- [ ] Create admin guide for limit management
