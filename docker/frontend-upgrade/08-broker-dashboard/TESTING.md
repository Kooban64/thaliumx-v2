# Phase 8: Broker Admin Dashboard - Testing Guide

## Overview

This document provides testing instructions for the Broker Admin Dashboard implementation.

## Backend API Endpoints

### Dashboard
- `GET /api/broker/dashboard` - Broker dashboard data
- `GET /api/broker/health` - Broker health status
- `GET /api/broker/metrics` - Broker metrics

### User Management
- `GET /api/broker/users` - Get broker users (with filters: search, status, page, limit)
- `GET /api/broker/kyc` - Get KYC records (with filters: status, level, page, limit)

### Transactions
- `GET /api/broker/transactions` - Get broker transactions (with filters: status, type, userId, page, limit)

### Audit Logs
- `GET /api/broker/audit-logs` - Get audit logs (with filters: action, userId, startDate, endDate, page, limit)

## Frontend Pages

### Dashboard
- `/broker` - Main broker dashboard

### User Management
- `/broker/users` - Broker user list
- `/broker/users/[id]` - User details
- `/broker/users/kyc` - KYC management

### Trading Operations
- `/broker/trading/orders` - Order management
- `/broker/trading/market` - Market data
- `/broker/trading/config` - Trading configuration

### Financial Management
- `/broker/financial/ledger` - Broker ledger
- `/broker/financial/reconciliation` - Reconciliation
- `/broker/financial/reports` - Financial reports

### Compliance
- `/broker/compliance` - Compliance dashboard
- `/broker/compliance/monitoring` - Transaction monitoring
- `/broker/compliance/audit` - Audit logs

### Broker Settings
- `/broker/settings` - Broker configuration
- `/broker/settings/branding` - Branding
- `/broker/settings/limits` - Limits & controls

### Analytics
- `/broker/analytics/users` - User analytics
- `/broker/analytics/trading` - Trading analytics
- `/broker/analytics/financial` - Financial analytics

## Testing Checklist

### 1. Dashboard
- [ ] Test `/broker` page loads
- [ ] Test metrics cards display
- [ ] Test quick actions work
- [ ] Test real-time updates (if applicable)

### 2. User Management
- [ ] Test `/broker/users` - User list loads
- [ ] Test search functionality
- [ ] Test status filter
- [ ] Test pagination
- [ ] Test `/broker/users/[id]` - User details load
- [ ] Test `/broker/users/kyc` - KYC management loads

### 3. Trading Operations
- [ ] Test `/broker/trading/orders` - Order management loads
- [ ] Test `/broker/trading/market` - Market data loads
- [ ] Test `/broker/trading/config` - Trading config loads

### 4. Financial Management
- [ ] Test `/broker/financial/ledger` - Ledger loads
- [ ] Test `/broker/financial/reconciliation` - Reconciliation loads
- [ ] Test `/broker/financial/reports` - Reports load

### 5. Compliance
- [ ] Test `/broker/compliance` - Compliance dashboard loads
- [ ] Test `/broker/compliance/monitoring` - Monitoring loads
- [ ] Test `/broker/compliance/audit` - Audit logs load

### 6. Settings
- [ ] Test `/broker/settings` - Settings load
- [ ] Test `/broker/settings/branding` - Branding loads
- [ ] Test `/broker/settings/limits` - Limits load

### 7. Analytics
- [ ] Test `/broker/analytics/users` - User analytics loads
- [ ] Test `/broker/analytics/trading` - Trading analytics loads
- [ ] Test `/broker/analytics/financial` - Financial analytics loads

## Manual Testing

### Prerequisites
1. Backend service running
2. Frontend service running
3. Broker user logged in (with broker role)

### Test Steps

1. **Dashboard Test**
   - Navigate to `/broker`
   - Verify dashboard loads with metrics
   - Check quick actions are clickable

2. **User Management Test**
   - Navigate to `/broker/users`
   - Test search functionality
   - Test filters
   - Click on a user to view details
   - Navigate to KYC management

3. **Trading Operations Test**
   - Navigate to `/broker/trading/orders`
   - Verify orders display (if any)
   - Test other trading pages

4. **Financial Management Test**
   - Navigate to financial pages
   - Verify pages load correctly

5. **Compliance Test**
   - Navigate to compliance pages
   - Verify audit logs load

6. **Settings Test**
   - Navigate to settings pages
   - Verify pages load

7. **Analytics Test**
   - Navigate to analytics pages
   - Verify pages load

## API Testing

### Test Dashboard Endpoint
```bash
curl -X GET http://localhost:3002/api/broker/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Users Endpoint
```bash
curl -X GET "http://localhost:3002/api/broker/users?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Transactions Endpoint
```bash
curl -X GET "http://localhost:3002/api/broker/transactions?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Expected Behavior

1. **Authentication**: All pages should check for broker permissions
2. **Data Loading**: Pages should show loading states
3. **Error Handling**: Errors should be displayed gracefully
4. **Navigation**: All menu items should navigate correctly
5. **Responsive**: Pages should work on mobile devices

## Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Check user has broker role
   - Verify token is valid
   - Check brokerId in user context

2. **404 Not Found**
   - Verify route exists
   - Check API proxy is working
   - Verify backend endpoint exists

3. **Empty Data**
   - Check broker has users/transactions
   - Verify brokerId filtering works
   - Check database has data

4. **TypeScript Errors**
   - Run `npm run typecheck`
   - Fix any type errors
   - Ensure all imports are correct
