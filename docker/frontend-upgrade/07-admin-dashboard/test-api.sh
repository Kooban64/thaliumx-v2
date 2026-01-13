#!/bin/bash

# Admin Dashboard API Testing Script
# Tests all admin API endpoints

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:3002}"
TOKEN="${ADMIN_TOKEN:-}"

echo "=========================================="
echo "Admin Dashboard API Testing"
echo "=========================================="
echo "Backend URL: $BACKEND_URL"
echo ""

# Check if token is provided
if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}Warning: ADMIN_TOKEN not set. Some tests may fail.${NC}"
    echo "Set ADMIN_TOKEN environment variable to test authenticated endpoints."
    echo ""
fi

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local data=$4
    
    echo -n "Testing $description... "
    
    if [ -z "$TOKEN" ]; then
        echo -e "${YELLOW}SKIPPED (no token)${NC}"
        return
    fi
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$BACKEND_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data")
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -w "\n%{http_code}" -X PUT "$BACKEND_URL$endpoint" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}PASS${NC} (HTTP $http_code)"
        return 0
    else
        echo -e "${RED}FAIL${NC} (HTTP $http_code)"
        echo "Response: $body" | head -c 200
        echo ""
        return 1
    fi
}

# Test Dashboard Endpoints
echo "=== Dashboard Endpoints ==="
test_endpoint "GET" "/api/admin/dashboard" "Dashboard data"
test_endpoint "GET" "/api/admin/health" "System health"
test_endpoint "GET" "/api/admin/system/info" "System information"
echo ""

# Test User Management
echo "=== User Management ==="
test_endpoint "GET" "/api/admin/users" "Get all users"
test_endpoint "GET" "/api/admin/users?search=test" "Search users"
test_endpoint "GET" "/api/admin/users?role=user" "Filter by role"
test_endpoint "GET" "/api/admin/users?kycLevel=L1" "Filter by KYC level"
echo ""

# Test Broker Management
echo "=== Broker Management ==="
test_endpoint "GET" "/api/admin/brokers" "Get all brokers"
echo ""

# Test Audit Logs
echo "=== Audit Logs ==="
test_endpoint "GET" "/api/admin/audit-logs" "Get audit logs"
test_endpoint "GET" "/api/admin/audit-logs?limit=10" "Get audit logs (limited)"
echo ""

echo "=========================================="
echo "Testing Complete"
echo "=========================================="
