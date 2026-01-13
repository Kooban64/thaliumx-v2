#!/bin/bash

# Phase 9: Admin Limit Configuration System - Automated Test Script
# This script tests the API endpoints (requires valid JWT token)

set -e

BASE_URL="${BACKEND_URL:-http://localhost:3002}"
TOKEN="${AUTH_TOKEN:-}"

if [ -z "$TOKEN" ]; then
    echo "⚠️  Warning: AUTH_TOKEN not set. Some tests will fail."
    echo "   Set AUTH_TOKEN environment variable with a valid JWT token"
    echo ""
fi

echo "=== Phase 9: Limit Management API Tests ==="
echo "Backend URL: $BASE_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_count=0
pass_count=0
fail_count=0

test_api() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    
    test_count=$((test_count + 1))
    echo -n "Test $test_count: $name... "
    
    if [ -z "$TOKEN" ]; then
        echo -e "${YELLOW}SKIPPED (no token)${NC}"
        return
    fi
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" 2>&1)
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data" 2>&1)
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data" 2>&1)
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" 2>&1)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}PASS${NC} (HTTP $http_code)"
        pass_count=$((pass_count + 1))
        return 0
    else
        echo -e "${RED}FAIL${NC} (HTTP $http_code)"
        echo "   Response: $body"
        fail_count=$((fail_count + 1))
        return 1
    fi
}

# Test 1: Get all KYC limits
test_api "Get all KYC limits" "GET" "/api/admin/limits/kyc" ""

# Test 2: Get specific KYC level
test_api "Get L1 KYC limits" "GET" "/api/admin/limits/kyc/L1" ""

# Test 3: Update KYC limits
test_api "Update L1 KYC limits" "PUT" "/api/admin/limits/kyc/L1" '{
  "maxInvestment": 10000,
  "maxTrading": 5000,
  "maxWithdrawal": 2000,
  "maxDeposit": 10000,
  "maxDailyTransactions": 10,
  "currency": "USD"
}'

# Test 4: Get all role limits
test_api "Get all role limits" "GET" "/api/admin/limits/roles" ""

# Test 5: Get specific role limits
test_api "Get user role limits" "GET" "/api/admin/limits/roles/user" ""

# Test 6: Update role limits
test_api "Update user role limits" "PUT" "/api/admin/limits/roles/user" '{
  "maxDailyVolume": 50000,
  "maxMonthlyVolume": 1000000,
  "maxSingleTransaction": 10000,
  "maxWithdrawalDaily": 5000,
  "maxWithdrawalMonthly": 50000,
  "maxDepositDaily": 10000,
  "maxDepositMonthly": 100000,
  "currency": "USD"
}'

# Test 7: Get limit history
test_api "Get limit history" "GET" "/api/admin/limits/history?page=1&limit=10" ""

# Test 8: Validate limits
test_api "Validate KYC limits" "POST" "/api/admin/limits/validate" '{
  "type": "kyc",
  "target": "L1",
  "limits": {
    "maxInvestment": 10000,
    "maxTrading": 5000
  }
}'

# Test 9: Get user overrides (requires valid user ID)
if [ -n "$TEST_USER_ID" ]; then
    test_api "Get user overrides" "GET" "/api/admin/limits/users/$TEST_USER_ID" ""
else
    echo -e "${YELLOW}Skipping user override tests (TEST_USER_ID not set)${NC}"
fi

echo ""
echo "=== Test Summary ==="
echo "Total Tests: $test_count"
echo -e "${GREEN}Passed: $pass_count${NC}"
echo -e "${RED}Failed: $fail_count${NC}"

if [ $fail_count -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
