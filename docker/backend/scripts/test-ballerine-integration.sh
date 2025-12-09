#!/bin/bash

# Ballerine Integration Test Script
# Tests all Ballerine features against a running instance

set -e

BALLERINE_URL="${BALLERINE_BASE_URL:-http://localhost:4000}"
API_KEY="${BALLERINE_API_KEY:-ballerine_oss_api_key_12345}"
BACKEND_URL="${BACKEND_URL:-http://localhost:3002}"

echo "🧪 Ballerine Integration Test Suite"
echo "===================================="
echo "Ballerine URL: $BALLERINE_URL"
echo "Backend URL: $BACKEND_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_count=0
pass_count=0
fail_count=0

# Test function
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local expected_status=${4:-200}
    local data=$5
    
    test_count=$((test_count + 1))
    echo -n "Test $test_count: $name ... "
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Authorization: Bearer $API_KEY" \
            -H "Content-Type: application/json" \
            "$BALLERINE_URL$endpoint" 2>/dev/null || echo "ERROR\n000")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Authorization: Bearer $API_KEY" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BALLERINE_URL$endpoint" 2>/dev/null || echo "ERROR\n000")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ] || [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓ PASS${NC}"
        pass_count=$((pass_count + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
        echo "  Response: $body" | head -n 3
        fail_count=$((fail_count + 1))
        return 1
    fi
}

# Test Backend API endpoint
test_backend_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local expected_status=${4:-200}
    local token=${5:-""}
    
    test_count=$((test_count + 1))
    echo -n "Test $test_count: $name ... "
    
    headers="-H 'Content-Type: application/json'"
    if [ -n "$token" ]; then
        headers="$headers -H 'Authorization: Bearer $token'"
    fi
    
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
        $headers \
        "$BACKEND_URL$endpoint" 2>/dev/null || echo "ERROR\n000")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ] || [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓ PASS${NC}"
        pass_count=$((pass_count + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
        echo "  Response: $body" | head -n 3
        fail_count=$((fail_count + 1))
        return 1
    fi
}

echo "📋 Testing Ballerine Service Directly"
echo "------------------------------------"

# Test 1: Health Check
test_endpoint "Health Check" "GET" "/api/v1/_health/ready"

# Test 2: Get Workflow Definitions
test_endpoint "Get Workflow Definitions" "GET" "/workflow-definition"

# Test 3: List Workflows
test_endpoint "List Workflows" "GET" "/external/workflows"

# Test 4: Get Metrics
test_endpoint "Get Metrics" "GET" "/metrics" 200

echo ""
echo "📋 Testing Backend Ballerine Integration"
echo "----------------------------------------"

# Test 5: Backend Health Check (Ballerine via backend)
test_backend_endpoint "Backend KYC Health" "GET" "/api/kyc/health"

# Test 6: Get Workflow Definitions via Backend
# Note: Requires auth token in production
echo "Test $((test_count + 1)): Get Workflow Definitions via Backend ... ${YELLOW}SKIP (requires auth)${NC}"
test_count=$((test_count + 1))

echo ""
echo "📊 Test Summary"
echo "==============="
echo "Total Tests: $test_count"
echo -e "${GREEN}Passed: $pass_count${NC}"
echo -e "${RED}Failed: $fail_count${NC}"
echo "Skipped: 1"

if [ $fail_count -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi

