# APISIX Architecture & Rate Limiting Analysis

## Overview

Your architecture uses a **layered defense strategy** with APISIX as the API Gateway and backend rate limiting. This is a **best practice** approach, but currently APISIX rate limiting is **not configured** in routes.

---

## Architecture Flow

```
Internet
  ↓
APISIX (API Gateway) ← First line of defense
  ↓
  ├─→ Frontend (Next.js)
  └─→ Backend (Express) ← Second line of defense
        ↓
      Business Logic
```

### Request Flow

1. **Client Request** → APISIX (Port 80/443)
2. **APISIX** → Routes request based on host/URI
3. **APISIX** → Applies gateway-level protections (if configured)
4. **APISIX** → Proxies to Backend/Frontend
5. **Backend** → Applies application-level protections
6. **Backend** → Processes request

---

## Current State

### ✅ **APISIX Configuration**

**Plugins Enabled:**
- ✅ `limit-conn` - Connection limiting
- ✅ `limit-count` - Request count limiting
- ✅ `limit-req` - Request rate limiting
- ✅ `jwt-auth` - JWT authentication
- ✅ `authz-keycloak` - Keycloak authorization
- ✅ `cors` - CORS handling
- ✅ `ip-restriction` - IP allowlist/blocklist
- ✅ `csrf` - CSRF protection

**Routes Configured:**
- ✅ Main landing page (thaliumx.com)
- ✅ Token presale (thal.thaliumx.com)
- ✅ API endpoints (/api/*)
- ✅ Health check (/health)

**Rate Limiting Status:**
- ⚠️ **Plugins enabled but NOT configured in routes**
- ⚠️ Only one route has `limit-count` configured (admin API: 1000/60s)

### ✅ **Backend Rate Limiting**

**Multiple Layers:**

1. **express-rate-limit** (`rateLimiter`)
   - Window: 15 minutes
   - Dynamic limits based on role/endpoint:
     - Financial endpoints: 50 requests (admins: 1000)
     - Auth endpoints: 10 requests
     - Default: 100 requests (admins: 500)

2. **Financial Rate Limiter** (`financialRateLimiter`)
   - Stricter limits for financial operations
   - Applied to: `/api/financial`, `/api/margin`, `/api/exchange`, `/api/wallets`

3. **API Gateway Middleware** (`apiGateway`)
   - IP-based rate limiting (in-memory)
   - User-based rate limiting (in-memory)
   - Request throttling (max concurrent requests)
   - Circuit breaker

4. **Redis-backed Rate Limiter** (`rateLimiter` from rate-limiter.ts)
   - Per-tenant, per-user/IP
   - Default: 120 requests/minute
   - Uses Redis for distributed rate limiting

---

## Why Both APISIX and Backend Rate Limiting?

### **Defense in Depth Strategy** ✅

This is a **best practice** for production systems:

#### **APISIX (Edge/Network Level)**
- **Purpose**: First line of defense, DDoS protection
- **Advantages**:
  - ✅ **Low latency**: Blocks requests before they reach backend
  - ✅ **Resource efficient**: Protects backend from overload
  - ✅ **Distributed**: Works across multiple backend instances
  - ✅ **IP-based**: Can block malicious IPs immediately
  - ✅ **Connection limiting**: Prevents connection exhaustion

#### **Backend (Application Level)**
- **Purpose**: Fine-grained control, business logic protection
- **Advantages**:
  - ✅ **User-aware**: Can rate limit by user ID, role, tenant
  - ✅ **Endpoint-specific**: Different limits for different endpoints
  - ✅ **Business logic**: Can implement complex rules
  - ✅ **Context-aware**: Has access to user data, permissions

### **Complementary, Not Duplicative**

| Feature | APISIX | Backend |
|---------|--------|---------|
| **IP-based limiting** | ✅ Primary | ✅ Secondary |
| **User-based limiting** | ⚠️ Limited | ✅ Full support |
| **Endpoint-specific** | ⚠️ Route-based | ✅ Fine-grained |
| **Business logic** | ❌ No | ✅ Yes |
| **Latency** | ✅ ~1ms | ⚠️ ~5-10ms |
| **Resource usage** | ✅ Low | ⚠️ Higher |
| **Distributed** | ✅ Yes | ✅ With Redis |

---

## Recommended Configuration

### **APISIX Rate Limiting Strategy**

#### **1. Global Rate Limiting (All Routes)**

```json
{
  "plugins": {
    "limit-req": {
      "rate": 100,
      "burst": 50,
      "key": "remote_addr",
      "rejected_code": 429,
      "rejected_msg": "Too many requests"
    }
  }
}
```

**Purpose**: Basic DDoS protection, prevent overwhelming backend

#### **2. API Endpoints (Stricter)**

```json
{
  "uri": "/api/*",
  "plugins": {
    "limit-req": {
      "rate": 60,
      "burst": 30,
      "key": "remote_addr"
    },
    "limit-count": {
      "count": 1000,
      "time_window": 60,
      "key": "remote_addr"
    }
  }
}
```

**Purpose**: Protect API from abuse

#### **3. Auth Endpoints (Very Strict)**

```json
{
  "uri": "/api/auth/*",
  "plugins": {
    "limit-req": {
      "rate": 10,
      "burst": 5,
      "key": "remote_addr"
    },
    "limit-count": {
      "count": 20,
      "time_window": 60,
      "key": "remote_addr"
    }
  }
}
```

**Purpose**: Prevent brute force attacks

#### **4. Financial Endpoints (Strict + User-based)**

```json
{
  "uri": "/api/financial/*",
  "plugins": {
    "limit-req": {
      "rate": 30,
      "burst": 15,
      "key": "remote_addr"
    },
    "limit-count": {
      "count": 100,
      "time_window": 60,
      "key": "consumer_name"  // Requires consumer setup
    }
  }
}
```

**Purpose**: Protect financial operations

### **Backend Rate Limiting Strategy**

Keep current implementation but **tune limits**:

1. **Reduce backend limits** since APISIX handles edge protection
2. **Focus on user/tenant-specific limits**
3. **Keep financial rate limiter strict**

---

## Implementation Plan

### **Phase 1: Configure APISIX Rate Limiting** (High Priority)

1. **Add global rate limiting** to all routes
2. **Add strict rate limiting** to `/api/auth/*`
3. **Add moderate rate limiting** to `/api/*`
4. **Add strict rate limiting** to financial endpoints

**Benefits:**
- ✅ Immediate DDoS protection
- ✅ Reduces backend load
- ✅ Faster response to attacks

### **Phase 2: Tune Backend Rate Limiting** (Medium Priority)

1. **Reduce backend limits** (APISIX handles edge)
2. **Focus on user-specific limits**
3. **Keep Redis-backed limiter for distributed systems**

**Benefits:**
- ✅ More efficient resource usage
- ✅ Better user experience
- ✅ Maintains fine-grained control

### **Phase 3: Add APISIX Authentication** (Optional)

1. **JWT validation at APISIX level**
2. **Keycloak authorization**
3. **User-based rate limiting in APISIX**

**Benefits:**
- ✅ Offload authentication from backend
- ✅ User-aware rate limiting at edge
- ✅ Better performance

---

## Current Issues & Recommendations

### ⚠️ **Issue 1: APISIX Rate Limiting Not Configured**

**Problem:**
- Plugins enabled but not used
- All traffic goes through without edge protection

**Impact:**
- Backend handles all rate limiting
- Higher backend load
- Slower response to attacks

**Solution:**
- Configure `limit-req` and `limit-count` in routes
- Start with conservative limits, tune based on metrics

### ⚠️ **Issue 2: Potential Duplication**

**Problem:**
- Both APISIX and backend do rate limiting
- Could cause conflicts or confusion

**Impact:**
- Users might hit APISIX limit before backend limit
- Different error messages
- Harder to debug

**Solution:**
- **APISIX**: Coarse-grained, IP-based, high limits
- **Backend**: Fine-grained, user-based, lower limits
- Document limits clearly

### ⚠️ **Issue 3: No User-Based Rate Limiting in APISIX**

**Problem:**
- APISIX can only do IP-based limiting without consumers
- Backend must handle all user-based limiting

**Impact:**
- All requests reach backend for user validation
- Can't block malicious users at edge

**Solution:**
- Option A: Keep current (backend handles user limits)
- Option B: Set up APISIX consumers for user-based limits
- **Recommendation**: Option A (simpler, backend already works)

---

## Best Practices

### ✅ **Layered Defense** (Current Approach)

1. **APISIX (Edge)**: Coarse-grained, IP-based, high limits
2. **Backend (Application)**: Fine-grained, user-based, lower limits

### ✅ **Rate Limiting Strategy**

**APISIX Limits (Edge Protection):**
- Global: 100 req/s per IP
- API: 60 req/s per IP
- Auth: 10 req/s per IP
- Financial: 30 req/s per IP

**Backend Limits (Application Protection):**
- Global: 100 req/15min per user
- Auth: 10 req/15min per IP
- Financial: 50 req/15min per user
- Per-tenant: 120 req/min per user/IP

### ✅ **Monitoring**

- Monitor APISIX rate limit hits
- Monitor backend rate limit hits
- Alert on unusual patterns
- Track false positives

---

## Summary

### **Current State:**
- ✅ APISIX plugins enabled
- ⚠️ APISIX rate limiting **not configured** in routes
- ✅ Backend has comprehensive rate limiting
- ✅ Layered defense strategy (good!)

### **Recommendations:**
1. **Configure APISIX rate limiting** (high priority)
   - Add edge-level protection
   - Reduce backend load
   - Faster attack response

2. **Keep backend rate limiting** (maintain)
   - Fine-grained control
   - User/tenant-specific limits
   - Business logic protection

3. **Tune limits** (optimize)
   - APISIX: Higher limits (edge protection)
   - Backend: Lower limits (application protection)
   - Monitor and adjust

### **Architecture is Sound** ✅

Your layered defense approach is correct. Just need to **activate APISIX rate limiting** to complete the protection.

