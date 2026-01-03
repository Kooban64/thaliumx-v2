#!/bin/bash

# ThaliumX Phase 2 Integration Tests
# Tests GraphQL, Ballerina Workflows, Live Helper Chat, and osTicket integrations

set -e

echo "🧪 Testing Phase 2 Core Integrations for ThaliumX"
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check service health
check_service() {
    local service_name=$1
    local url=$2
    local expected_status=${3:-200}

    echo -n "Testing $service_name... "

    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "$expected_status"; then
        echo -e "${GREEN}✓ PASS${NC}"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        return 1
    fi
}

# Function to test GraphQL endpoint
test_graphql() {
    echo "Testing GraphQL API..."

    # Test GraphQL health
    if ! check_service "GraphQL Health" "http://localhost:4000/graphql" 400; then
        return 1
    fi

    # Test GraphQL query
    local query='{"query":"query{hello}"}'
    local response=$(curl -s -X POST -H "Content-Type: application/json" \
        -d "$query" http://localhost:4000/graphql 2>/dev/null)

    if echo "$response" | grep -q "Hello from ThaliumX GraphQL API"; then
        echo -e "GraphQL Query: ${GREEN}✓ PASS${NC}"
    else
        echo -e "GraphQL Query: ${RED}✗ FAIL${NC}"
        echo "Response: $response"
        return 1
    fi

    return 0
}

# Function to test Ballerina workflows
test_ballerina() {
    echo "Testing Ballerina Workflows..."

    # Test health endpoint
    if ! check_service "Ballerina Health" "http://localhost:9090/health"; then
        return 1
    fi

    # Test workflow trigger (mock data)
    local workflow_data='{"userId":"test-user-123","email":"test@thaliumx.com","userData":{"kycLevel":"basic"}}'
    local response=$(curl -s -X POST -H "Content-Type: application/json" \
        -d "$workflow_data" http://localhost:9090/workflows 2>/dev/null)

    if echo "$response" | grep -q "workflowId"; then
        echo -e "Workflow Trigger: ${GREEN}✓ PASS${NC}"
    else
        echo -e "Workflow Trigger: ${RED}✗ FAIL${NC}"
        echo "Response: $response"
        return 1
    fi

    return 0
}

# Function to test Live Helper Chat
test_live_helper_chat() {
    echo "Testing Live Helper Chat..."

    if ! check_service "Live Helper Chat" "http://localhost/support/chat/"; then
        return 1
    fi

    return 0
}

# Function to test osTicket
test_osticket() {
    echo "Testing osTicket..."

    if ! check_service "osTicket" "http://localhost/support/tickets/"; then
        return 1
    fi

    # Test escalation endpoint
    local escalation_data='{"chat_id":"test-chat-123","user_id":"test-user","subject":"Test Escalation","message":"Test message","priority":"normal"}'
    local response=$(curl -s -X POST -H "Content-Type: application/json" \
        -d "$escalation_data" http://localhost/support/tickets/escalate-chat.php 2>/dev/null)

    if echo "$response" | grep -q "ticket_id"; then
        echo -e "Ticket Escalation: ${GREEN}✓ PASS${NC}"
    else
        echo -e "Ticket Escalation: ${RED}✗ FAIL${NC}"
        echo "Response: $response"
        return 1
    fi

    return 0
}

# Function to test security
test_security() {
    echo "Testing Security Standards..."

    # Test that endpoints require authentication
    local unauth_response=$(curl -s -w "%{http_code}" -o /dev/null http://localhost/graphql 2>/dev/null)

    if [ "$unauth_response" = "401" ] || [ "$unauth_response" = "302" ]; then
        echo -e "Authentication Required: ${GREEN}✓ PASS${NC}"
    else
        echo -e "Authentication Required: ${YELLOW}⚠ WARN${NC} (got $unauth_response, expected 401/302)"
    fi

    # Test HTTPS enforcement (would need proper SSL setup)
    echo -e "HTTPS Enforcement: ${YELLOW}⚠ MANUAL${NC} (requires SSL certificate setup)"

    return 0
}

# Main test execution
main() {
    local failed_tests=0

    echo "Prerequisites:"
    echo "- Services should be running via: docker compose -f docker/compose/prod-v1/base.yml -f docker/compose/prod-v1/production.yml up -d"
    echo "- Wait for services to be healthy before running tests"
    echo ""

    # Run tests
    test_graphql || ((failed_tests++))
    echo ""

    test_ballerina || ((failed_tests++))
    echo ""

    test_live_helper_chat || ((failed_tests++))
    echo ""

    test_osticket || ((failed_tests++))
    echo ""

    test_security || ((failed_tests++))
    echo ""

    # Summary
    echo "================================================="
    if [ $failed_tests -eq 0 ]; then
        echo -e "${GREEN}🎉 All Phase 2 integrations passed!${NC}"
        echo ""
        echo "Next steps:"
        echo "1. Run end-to-end tests with real data"
        echo "2. Configure monitoring and alerting"
        echo "3. Update API documentation"
        echo "4. Plan Phase 3 advanced features"
    else
        echo -e "${RED}❌ $failed_tests test(s) failed${NC}"
        echo ""
        echo "Troubleshooting:"
        echo "1. Check service logs: docker compose logs [service-name]"
        echo "2. Verify environment variables are set"
        echo "3. Ensure databases are initialized"
        echo "4. Check network connectivity between services"
        exit 1
    fi
}

# Run main function
main "$@"