# Phase 7: Admin Dashboard - API Testing Guide

## Overview

This document provides testing instructions for the Admin Dashboard API integration.

## Backend API Endpoints

### Dashboard
- `GET /api/admin/dashboard` - Dashboard data with metrics
- `GET /api/admin/health` - System health
- `GET /api/admin/system/info` - System information
- `GET /api/admin/system-info` - System information (alias)

### User Management
- `GET /api/admin/users` - Get all users (with filters: search, role, kycLevel, status)
- `GET /api/admin/users/:id` - Get specific user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user (super_admin only)

### Broker Management
- `GET /api/admin/brokers` - Get all brokers
- `GET /api/admin/brokers/:id` - Get specific broker

### User Limits
- `GET /api/admin/user-limits/:userId` - Get user limits
- `PUT /api/admin/user-limits/:userId` - Update user limits

### Audit Logs
- `GET /api/admin/audit-logs` - Get audit logs (with filters: userId, action, startDate, endDate, limit, offset)

## Frontend API Proxy

The frontend proxy at `/api/admin/[...path]/route.ts` supports:
- GET
- POST
- PUT
- DELETE
- PATCH

All requests are proxied to the backend with proper authentication headers.

## Testing Checklist

### 1. Dashboard Endpoints
- [ ] Test `/api/admin/dashboard` - Should return metrics and recent activity
- [ ] Test `/api/admin/health` - Should return system health status
- [ ] Test `/api/admin/system/info` - Should return system information

### 2. User Management
- [ ] Test `/api/admin/users` - Should return user list
- [ ] Test `/api/admin/users?search=test` - Should filter by search
- [ ] Test `/api/admin/users?role=user` - Should filter by role
- [ ] Test `/api/admin/users?kycLevel=L1` - Should filter by KYC level
- [ ] Test `/api/admin/users/:id` - Should return specific user
- [ ] Test `/api/admin/user-limits/:userId` - Should return user limits

### 3. Broker Management
- [ ] Test `/api/admin/brokers` - Should return broker list with user counts
- [ ] Test `/api/admin/brokers/:id` - Should return specific broker

### 4. Audit Logs
- [ ] Test `/api/admin/audit-logs` - Should return audit logs
- [ ] Test `/api/admin/audit-logs?limit=10` - Should limit results
- [ ] Test `/api/admin/audit-logs?userId=xxx` - Should filter by user

### 5. Frontend Integration
- [ ] Test admin dashboard page loads
- [ ] Test system health card displays
- [ ] Test user list page loads
- [ ] Test broker list page loads
- [ ] Test all API hooks work correctly

## Manual Testing

### Prerequisites
1. Backend service running
2. Frontend service running
3. Admin user logged in

### Test Steps

1. **Dashboard Test**
   ```bash
   curl -X GET http://localhost:3002/api/admin/dashboard \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **System Health Test**
   ```bash
   curl -X GET http://localhost:3002/api/admin/health \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Users Test**
   ```bash
   curl -X GET "http://localhost:3002/api/admin/users?search=test&role=user" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

4. **Brokers Test**
   ```bash
   curl -X GET http://localhost:3002/api/admin/brokers \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

## Expected Responses

### Dashboard Response
```json
{
  "success": true,
  "data": {
    "metrics": {
      "totalUsers": 100,
      "totalBrokers": 5,
      "totalTransactions": 1000,
      "activeUsers": 50,
      "totalVolume": 50000,
      "activeTenants": 3
    },
    "totalUsers": 100,
    "totalTransactions": 1000,
    "recentActivity": [...]
  }
}
```

### Health Response
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 3600,
    "services": {
      "database": "healthy",
      "redis": "healthy"
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **502 Bad Gateway**
   - Check backend service is running
   - Check Docker network connectivity
   - Verify backend URL in proxy

2. **401 Unauthorized**
   - Check authentication token
   - Verify token is valid
   - Check user has admin role

3. **404 Not Found**
   - Verify endpoint path is correct
   - Check route is registered in backend
   - Verify proxy path replacement

4. **Empty Data**
   - Check database has data
   - Verify model queries are correct
   - Check filters aren't too restrictive
