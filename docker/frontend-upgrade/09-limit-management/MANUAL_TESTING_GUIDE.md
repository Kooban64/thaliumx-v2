# Phase 9: Admin Limit Configuration System - Manual Testing Guide

## Overview

This guide provides step-by-step instructions for manually testing all Phase 9 features with authentication.

## Prerequisites

1. ✅ Backend service running on port 3002
2. ✅ Frontend service running on port 3000
3. ✅ Database connected and models created
4. ✅ Admin user logged in (with admin or super_admin role)
5. ✅ Valid JWT token

## Test Environment Setup

### 1. Verify Services
```bash
# Check backend
curl http://localhost:3002/health

# Check frontend
curl http://localhost:3000
```

### 2. Login as Admin
1. Navigate to `/login`
2. Login with admin credentials
3. Verify JWT token is stored
4. Verify user has admin role

### 3. Database Models
Ensure the following models exist:
- `Limit` - For KYC and role limits
- `UserLimitOverride` - For user-specific overrides
- `AuditLog` - For limit change history

---

## Test Cases

### Test 1: KYC Limit Configuration

#### Steps:
1. Navigate to `/admin/limits/kyc`
2. Verify page loads with KYC level selector
3. Select "L1" level
4. Enter the following limits:
   - Max Investment: 10000
   - Max Trading: 5000
   - Max Withdrawal: 2000
   - Max Deposit: 10000
   - Max Daily Transactions: 10
   - Currency: USD
5. Click "Validate Limits"
6. Verify validation passes
7. Review preview changes
8. Click "Save Changes"
9. Verify success message
10. Verify limits are saved

#### Expected Results:
- ✅ Page loads correctly
- ✅ Form validation works
- ✅ Preview shows changes
- ✅ Validation passes
- ✅ Limits saved successfully
- ✅ Notification sent (if enabled)

#### Verification:
```bash
# Check API response
curl -X GET "http://localhost:3002/api/admin/limits/kyc/L1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### Test 2: Role Limit Configuration

#### Steps:
1. Navigate to `/admin/limits/roles`
2. Select "Platform Roles"
3. Select "user" role
4. Enter the following limits:
   - Max Daily Volume: 50000
   - Max Monthly Volume: 1000000
   - Max Single Transaction: 10000
   - Max Withdrawal Daily: 5000
   - Max Withdrawal Monthly: 50000
   - Max Deposit Daily: 10000
   - Max Deposit Monthly: 100000
   - Currency: USD
5. Click "Validate Limits"
6. Verify validation passes
7. Click "Save Changes"
8. Verify success message

#### Expected Results:
- ✅ Role selection works
- ✅ Limits saved successfully
- ✅ Validation works
- ✅ Notification sent (if enabled)

---

### Test 3: User Limit Override

#### Steps:
1. Navigate to `/admin/users`
2. Find a test user and note their user ID
3. Navigate to `/admin/limits/users/[userId]/override`
4. Click "Create Override"
5. Select "Temporary" override type
6. Set expiry date (7 days from now)
7. Enter override limits:
   - Max Investment: 50000
   - Max Trading: 25000
8. Enter reason: "Testing temporary override"
9. Click "Create Override"
10. Verify override appears in list
11. Verify expiry date displays correctly

#### Expected Results:
- ✅ Override created successfully
- ✅ Temporary override shows expiry
- ✅ User notified (if enabled)
- ✅ Override appears in list

#### Test Permanent Override:
1. Create another override
2. Select "Permanent"
3. Enter different limits
4. Verify permanent badge shows
5. Verify no expiry date

---

### Test 4: Limit History

#### Steps:
1. Navigate to `/admin/limits/history`
2. Verify history loads
3. Filter by type "KYC"
4. Filter by target "L1"
5. Verify filtered results
6. Click on a history entry
7. Verify change details display
8. Test pagination (if multiple pages)

#### Expected Results:
- ✅ History loads correctly
- ✅ Filters work
- ✅ Change details accurate
- ✅ Pagination works

---

### Test 5: Limit Validation

#### Steps:
1. Navigate to `/admin/limits/kyc`
2. Select "L2" level
3. Enter invalid limits (negative numbers)
4. Click "Validate Limits"
5. Verify validation errors show
6. Fix errors
7. Validate again
8. Verify validation passes

#### Expected Results:
- ✅ Invalid limits rejected
- ✅ Error messages clear
- ✅ Valid limits pass validation

---

### Test 6: Notification Settings

#### Steps:
1. Navigate to `/admin/limits/notifications`
2. Toggle notification settings
3. Verify switches work
4. Click "Save Settings"
5. Verify settings saved

#### Expected Results:
- ✅ Settings page loads
- ✅ Toggles work correctly
- ✅ Settings persist

---

### Test 7: End-to-End Flow

#### Complete Workflow:
1. **Setup**: Create test user with L1 KYC level
2. **Configure KYC Limits**: Set L1 limits to 1000 max investment
3. **Verify**: Check user's effective limits
4. **Create Override**: Override user's limits to 5000
5. **Verify**: Check user's effective limits (should be 5000)
6. **Update KYC Limits**: Change L1 limits to 2000
7. **Verify**: Check user's effective limits (should still be 5000 - override takes precedence)
8. **Delete Override**: Remove user override
9. **Verify**: Check user's effective limits (should be 2000 - new KYC limit)

#### Expected Results:
- ✅ Limit hierarchy works correctly
- ✅ Overrides take precedence
- ✅ Changes propagate correctly
- ✅ Notifications sent appropriately

---

## API Testing

### Test KYC Limits API

```bash
# Get all KYC limits
curl -X GET "http://localhost:3002/api/admin/limits/kyc" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Get specific level
curl -X GET "http://localhost:3002/api/admin/limits/kyc/L1" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update limits
curl -X PUT "http://localhost:3002/api/admin/limits/kyc/L1" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "maxInvestment": 10000,
    "maxTrading": 5000,
    "maxWithdrawal": 2000,
    "maxDeposit": 10000,
    "maxDailyTransactions": 10,
    "currency": "USD"
  }'
```

### Test Role Limits API

```bash
# Get all role limits
curl -X GET "http://localhost:3002/api/admin/limits/roles" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update role limits
curl -X PUT "http://localhost:3002/api/admin/limits/roles/user" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "maxDailyVolume": 50000,
    "maxMonthlyVolume": 1000000,
    "maxSingleTransaction": 10000
  }'
```

### Test User Overrides API

```bash
# Get user overrides
curl -X GET "http://localhost:3002/api/admin/limits/users/USER_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create override
curl -X POST "http://localhost:3002/api/admin/limits/users/USER_ID/override" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "temporary",
    "limits": {
      "maxInvestment": 50000,
      "maxTrading": 25000
    },
    "expiresAt": "2025-01-20T00:00:00Z",
    "reason": "Testing override"
  }'

# Delete override
curl -X DELETE "http://localhost:3002/api/admin/limits/users/USER_ID/override/OVERRIDE_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Limit History API

```bash
# Get history
curl -X GET "http://localhost:3002/api/admin/limits/history?type=kyc&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Validation API

```bash
# Validate limits
curl -X POST "http://localhost:3002/api/admin/limits/validate" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "kyc",
    "target": "L1",
    "limits": {
      "maxInvestment": 10000,
      "maxTrading": 5000
    }
  }'
```

---

## Error Scenarios

### Test 1: Unauthorized Access
- Try accessing `/admin/limits/kyc` without login
- Expected: Redirect to login

### Test 2: Invalid Role
- Login as regular user (not admin)
- Try accessing limit pages
- Expected: Access denied

### Test 3: Invalid Data
- Try saving negative limits
- Expected: Validation error

### Test 4: Missing Required Fields
- Try creating override without reason
- Expected: Validation error

---

## Performance Testing

### Test 1: Load Time
- Navigate to limit pages
- Measure page load time
- Expected: < 2 seconds

### Test 2: Large Data Sets
- Create 100+ limit changes
- Load history page
- Expected: Pagination works, page loads < 3 seconds

---

## Browser Compatibility

Test in:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile browsers

---

## Checklist

### KYC Limits
- [ ] Page loads
- [ ] Level selection works
- [ ] Form validation works
- [ ] Preview works
- [ ] Validation works
- [ ] Save works
- [ ] Notifications sent

### Role Limits
- [ ] Page loads
- [ ] Role selection works
- [ ] Form validation works
- [ ] Save works
- [ ] Notifications sent

### User Overrides
- [ ] Page loads
- [ ] Create override works
- [ ] Temporary override works
- [ ] Permanent override works
- [ ] Delete override works
- [ ] Notifications sent

### History
- [ ] Page loads
- [ ] Filters work
- [ ] Pagination works
- [ ] Details display correctly

### Validation
- [ ] Validation works
- [ ] Errors display correctly
- [ ] Warnings display correctly

### Notifications
- [ ] Settings page loads
- [ ] Settings save
- [ ] Notifications sent on limit changes
- [ ] Users receive notifications

---

## Test Data

### Sample KYC Limits
```json
{
  "L0": {
    "maxInvestment": 1000,
    "maxTrading": 500,
    "maxWithdrawal": 200,
    "maxDeposit": 1000,
    "maxDailyTransactions": 5,
    "currency": "USD"
  },
  "L1": {
    "maxInvestment": 10000,
    "maxTrading": 5000,
    "maxWithdrawal": 2000,
    "maxDeposit": 10000,
    "maxDailyTransactions": 10,
    "currency": "USD"
  }
}
```

### Sample Role Limits
```json
{
  "user": {
    "maxDailyVolume": 50000,
    "maxMonthlyVolume": 1000000,
    "maxSingleTransaction": 10000,
    "maxWithdrawalDaily": 5000,
    "maxWithdrawalMonthly": 50000,
    "maxDepositDaily": 10000,
    "maxDepositMonthly": 100000,
    "currency": "USD"
  }
}
```

---

## Troubleshooting

### Issue: 401 Unauthorized
**Solution**: 
- Verify JWT token is valid
- Check token expiration
- Re-login if needed

### Issue: 403 Forbidden
**Solution**:
- Verify user has admin role
- Check RBAC permissions
- Contact system administrator

### Issue: 404 Not Found
**Solution**:
- Verify route exists
- Check API proxy is working
- Verify backend endpoint exists

### Issue: Database Errors
**Solution**:
- Verify database connection
- Check models are created
- Run database migrations

### Issue: Notifications Not Sending
**Solution**:
- Check Kafka connection
- Verify EventStreamingService is initialized
- Check notification settings

---

## Success Criteria

All tests pass when:
- ✅ All pages load correctly
- ✅ All forms validate correctly
- ✅ All saves work correctly
- ✅ All notifications sent
- ✅ All history tracked
- ✅ No errors in console
- ✅ Performance acceptable

---

**Test Date**: _______________  
**Tester**: _______________  
**Environment**: _______________  
**Results**: _______________
