# ThaliumX Production Deployment Verification Checklist

## Pre-Deployment Verification

### ✅ Configuration Files Modified
- [ ] `docker/compose/prod-v1/production.yml` - Identity layer added
- [ ] Legacy Keycloak files moved to `archive/deprecated/`
- [ ] APISIX configuration cleaned of Keycloak references
- [ ] Backend docker-compose Keycloak volumes removed

### 📋 Environment Variables Ready
- [ ] `ZITADEL_ISSUER` configured (default: https://auth.thaliumx.com)
- [ ] `ZITADEL_JWKS_URI` configured (default: http://zitadel:8080/oauth/v2/keys)
- [ ] Zitadel secrets generated (masterkey, postgres password, etc.)

## Deployment Commands

### **Start Deployment**
```bash
cd /home/ubuntu/thaliumx-v1
docker compose -f docker/compose/prod-v1/base.yml -f docker/compose/prod-v1/production.yml up -d
```

### **Monitor Startup**
```bash
# Watch Zitadel logs
docker compose -f docker/compose/prod-v1/base.yml -f docker/compose/prod-v1/production.yml logs -f zitadel

# Watch APISIX logs  
docker compose -f docker/compose/prod-v1/base.yml -f docker/compose/prod-v1/production.yml logs -f apisix
```

## Post-Deployment Verification

### **1. Service Health Checks**

#### Zitadel Services
- [ ] **Zitadel Container Status**: `docker ps | grep zitadel`
- [ ] **Zitadel Logs**: No critical errors in logs
- [ ] **Database Connection**: Zitadel can connect to zitadel-postgres
- [ ] **Port Accessibility**: Zitadel responding on port 8080 internally

#### Supporting Services
- [ ] **APISIX Gateway**: Running and healthy
- [ ] **Backend API**: Running and healthy
- [ ] **Frontend**: Running and healthy
- [ ] **Database**: PostgreSQL instances running
- [ ] **GraphQL API Gateway**: Running and healthy
- [ ] **Ballerina Workflows**: Running and healthy
- [ ] **Live Helper Chat**: Running and healthy
- [ ] **osTicket**: Running and healthy

### **2. Network Connectivity**

#### Internal Service Communication
```bash
# Test APISIX can reach Zitadel
docker exec thaliumx-apisix curl -f http://zitadel:8080/healthz || echo "Failed"

# Test Backend can reach Zitadel
docker exec thaliumx-backend curl -f http://zitadel:8080/healthz || echo "Failed"

# Test Frontend can reach Backend
docker exec thaliumx-frontend curl -f http://thaliumx-backend:3002/health || echo "Failed"
```

### **3. Zitadel Configuration Verification**

#### Database Initialization
- [ ] **Zitadel Database Created**: Tables and initial data loaded
- [ ] **Admin User Setup**: Initial admin account available
- [ ] **Organization Created**: Default organization initialized

#### OIDC Configuration
- [ ] **Issuer URL**: Correctly configured (https://auth.thaliumx.com)
- [ ] **JWKS Endpoint**: Accessible at `/oauth/v2/keys`
- [ ] **Client Registration**: Frontend and backend clients configured
- [ ] **Redirect URIs**: Properly configured for frontend

### **4. Gateway Configuration**

#### APISIX Routes
- [ ] **Auth Routes**: APISIX routing rules created for Zitadel
- [ ] **OIDC Plugin**: Configured for protected routes
- [ ] **SSL Certificates**: Valid certificates for auth.thaliumx.com
- [ ] **Route Health**: Auth routes responding correctly

#### Test APISIX Configuration
```bash
# Check APISIX dashboard (if accessible)
curl -H "Host: api.thaliumx.com" http://localhost:9000/ping

# Test auth endpoint routing
curl -H "Host: auth.thaliumx.com" http://localhost/health
```

### **5. Authentication Flow Testing**

#### Frontend Integration
- [ ] **Frontend Access**: Can access main application URL
- [ ] **Login Redirect**: Clicking login redirects to Zitadel
- [ ] **OIDC Flow**: Complete authentication flow works
- [ ] **Token Reception**: Frontend receives and stores tokens
- [ ] **API Calls**: Frontend can make authenticated API calls

#### Backend Integration
- [ ] **Token Validation**: Backend validates Zitadel JWT tokens
- [ ] **User Context**: User information properly extracted from tokens
- [ ] **Tenant Resolution**: Tenant context resolved correctly
- [ ] **Protected Routes**: Authenticated routes accessible
- [ ] **Logout**: Token invalidation works

### **6. End-to-End Scenarios**

#### User Registration Flow
- [ ] **New User Registration**: Can register through Zitadel
- [ ] **Email Verification**: Email verification process works
- [ ] **Profile Creation**: User profile created in application

#### User Login Flow  
- [ ] **Standard Login**: Email/password authentication works
- [ ] **MFA Support**: Multi-factor authentication (if configured)
- [ ] **Session Management**: Login sessions properly managed
- [ ] **Token Refresh**: Access token refresh works

#### Protected Resource Access
- [ ] **Dashboard Access**: Authenticated users can access dashboard
- [ ] **API Endpoints**: Protected API endpoints require authentication
- [ ] **Tenant Isolation**: Users can only access their tenant's data
- [ ] **Role-Based Access**: Different roles have appropriate permissions

### **7. Additional Components Verification**

#### GraphQL API Gateway
- [ ] **GraphQL Endpoint**: `/graphql` accessible and responding
- [ ] **GraphQL Playground**: Available at `/graphql` in development
- [ ] **Schema Introspection**: Schema queries work correctly
- [ ] **Real-time Subscriptions**: WebSocket connections for price updates
- [ ] **Caching**: Redis cache working for market data
- [ ] **Backend Integration**: Can query user portfolios and trading history

#### Ballerina Workflows
- [ ] **Workflow API**: `/workflows/*` endpoints responding
- [ ] **Kafka Integration**: Consumer connected to Kafka topics
- [ ] **User Onboarding**: Can trigger and complete onboarding workflows
- [ ] **Trading Workflows**: Order processing workflows functional
- [ ] **Event Processing**: Kafka events processed correctly
- [ ] **State Persistence**: Workflow state stored in database

#### Support Services
- [ ] **Live Helper Chat**: Chat interface accessible
- [ ] **WebSocket Connections**: Real-time messaging working
- [ ] **Chat History**: Messages persisted in database
- [ ] **osTicket Integration**: Chat escalation to tickets works
- [ ] **Moderation**: Chat moderation and analytics functional
- [ ] **Email Integration**: Ticket notifications sent via SMTP

### **7. Error Scenarios**

#### Authentication Failures
- [ ] **Invalid Credentials**: Proper error handling for bad login
- [ ] **Expired Tokens**: Graceful handling of expired tokens
- [ ] **Invalid Tokens**: Proper rejection of malformed tokens
- [ ] **Network Issues**: Resilient handling of connectivity problems

#### Recovery Procedures
- [ ] **Token Expiry**: Users can re-authenticate after token expiry
- [ ] **Service Restart**: Authentication works after service restart
- [ ] **Database Recovery**: Authentication survives database issues

## Performance Verification

### **Response Times**
- [ ] **Login Response**: Login completes within acceptable time (< 3 seconds)
- [ ] **Token Validation**: API responses with token validation (< 100ms overhead)
- [ ] **Page Load**: Authenticated pages load normally

### **Load Testing**
- [ ] **Concurrent Logins**: Multiple users can log in simultaneously
- [ ] **Token Validation Load**: API can handle concurrent token validations
- [ ] **Memory Usage**: Services don't consume excessive memory

## Security Verification

### **Token Security**
- [ ] **JWT Signing**: Tokens properly signed by Zitadel
- [ ] **Algorithm**: Uses secure signing algorithm (RS256)
- [ ] **Expiration**: Tokens have appropriate expiration times
- [ ] **Audience**: Token audience validation works

### **HTTPS Configuration**
- [ ] **SSL Certificates**: Valid certificates for all domains
- [ ] **Secure Transport**: All authentication uses HTTPS
- [ ] **HSTS Headers**: Proper security headers configured

## Troubleshooting Guide

### **Common Issues**

#### Zitadel Won't Start
```bash
# Check logs for specific errors
docker compose logs zitadel

# Common issues:
# - Missing secrets (masterkey, postgres password)
# - Database connectivity issues
# - Port conflicts
```

#### Authentication Not Working
```bash
# Verify APISIX routing
docker exec thaliumx-apisix apisix status

# Check backend logs for token validation errors
docker compose logs backend | grep -i auth
```

#### Frontend Login Issues
```bash
# Check frontend environment variables
docker exec thaliumx-frontend env | grep ZITADEL

# Verify network connectivity
docker exec thaliumx-frontend curl -I http://zitadel:8080
```

## Success Criteria

### **Minimum Viable Success**
- [ ] Zitadel service starts without errors
- [ ] Users can complete login flow
- [ ] Authenticated API calls work
- [ ] No regression in existing functionality

### **Full Success**
- [ ] All verification steps pass
- [ ] Performance meets requirements
- [ ] Security configuration is correct
- [ ] Error scenarios handled gracefully

## Rollback Plan

If critical issues are found during verification:

1. **Immediate Rollback**: 
   ```bash
   # Stop current deployment
   docker compose -f docker/compose/prod-v1/base.yml -f docker/compose/prod-v1/production.yml down
   
   # Restore previous state if needed (from archive)
   # Note: Actual rollback would require previous working deployment
   ```

2. **Issue Investigation**: Analyze logs and configuration for root cause

3. **Fix and Redeploy**: Apply fixes and repeat verification process

## Post-Verification Actions

### **Documentation Updates**
- [ ] Update operational runbooks
- [ ] Create Zitadel administration procedures
- [ ] Document troubleshooting steps
- [ ] Update API documentation

### **Monitoring Setup**
- [ ] Configure Zitadel health monitoring
- [ ] Set up authentication metrics
- [ ] Create alerts for authentication failures
- [ ] Monitor token validation performance

---

**Verification Completed**: ___________  
**Verified By**: ___________  
**Issues Found**: ___________  
**Resolution**: ___________