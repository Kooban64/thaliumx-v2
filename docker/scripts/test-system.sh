#!/bin/bash
# ThaliumX System Test Script
# ===========================
# Tests that the system is properly configured and rebuildable

set -e

echo "🧪 ThaliumX System Tests"
echo "========================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0

# Test function
test() {
    local name=$1
    local command=$2

    echo -n "Testing: $name... "

    if eval "$command" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC}"
        ((FAILED++))
    fi
}

# Test volume existence
test "Postgres volume exists" "docker volume ls --format '{{.Name}}' | grep -q '^thaliumx-postgres-data$'"
test "Redis volume exists" "docker volume ls --format '{{.Name}}' | grep -q '^thaliumx-redis-data$'"
test "MongoDB volume exists" "docker volume ls --format '{{.Name}}' | grep -q '^thaliumx-mongodb-data$'"
test "Vault volume exists" "docker volume ls --format '{{.Name}}' | grep -q '^thaliumx-vault-data$'"

# Test directory structure
test "Data directory exists" "[ -d /opt/thaliumx/data ]"
test "Backup directory exists" "[ -d /opt/thaliumx/backups ]"
test "Config backup directory exists" "[ -d /opt/thaliumx/backups/config ]"

# Test configuration files
test "Docker compose exists" "[ -f docker/compose.yaml ]"
test "Override compose exists" "[ -f docker/docker-compose.override.yml ]"
test "Init script exists" "[ -x docker/scripts/init-system.sh ]"

# Test service definitions
test "Postgres service defined" "grep -q 'postgres:' docker/compose.yaml"
test "Vault service defined" "grep -q 'vault:' docker/compose.yaml"
test "Backend service defined" "grep -q 'backend:' docker/compose.production.yaml"

# Test network definitions
test "ThaliumX network defined" "grep -q 'thaliumx-net:' docker/compose.yaml"
test "Database network defined" "grep -q 'database-network:' docker/compose.production.yaml"

# Test volume mounts in override
test "Postgres volume mounted" "grep -q 'thaliumx-postgres-data:/var/lib/postgresql/data' docker/docker-compose.override.yml"
test "Vault volume mounted" "grep -q 'thaliumx-vault-data:/vault/data' docker/docker-compose.override.yml"

# Test init script functionality
test "Init script has init function" "grep -q 'function init_vault' docker/scripts/init-system.sh"
test "Init script has backup function" "grep -q 'function backup_volume' docker/scripts/init-system.sh"

echo ""
echo "📊 Test Results:"
echo "================="
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo -e "Total:  $((PASSED + FAILED))"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! System is ready for deployment.${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please check the configuration.${NC}"
    exit 1
fi