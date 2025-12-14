#!/bin/bash
# ThaliumX E2E Test Runner
# =========================
# Runs Playwright E2E tests against production environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/docker/frontend"

echo "=========================================="
echo "ThaliumX E2E Test Runner"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check if services are running
print_status "Checking if services are running..."
if ! docker ps --filter "name=thaliumx-frontend" --format "{{.Names}}" | grep -q "thaliumx-frontend"; then
    print_warning "Frontend container not running. Starting services..."
    cd "$PROJECT_ROOT/docker"
    docker compose -f compose.yaml up -d frontend backend
    sleep 30
fi

# Set test environment
export NODE_ENV=test
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3001}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3002}"

# Navigate to frontend directory
cd "$FRONTEND_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
fi

# Install Playwright browsers if needed
if [ ! -d "node_modules/.cache/playwright" ]; then
    print_status "Installing Playwright browsers..."
    npx playwright install --with-deps
fi

# Run tests
print_status "Running E2E tests..."
echo ""

# Parse arguments
MODE="${1:-all}"
WORKERS="${2:-4}"

case "$MODE" in
    "headed")
        print_status "Running tests in headed mode (visible browser)..."
        npx playwright test --headed --workers="$WORKERS"
        ;;
    "ui")
        print_status "Running tests in UI mode (interactive)..."
        npx playwright test --ui
        ;;
    "debug")
        print_status "Running tests in debug mode..."
        npx playwright test --debug
        ;;
    "auth")
        print_status "Running authentication tests only..."
        npx playwright test e2e/auth.spec.ts --workers="$WORKERS"
        ;;
    "trading")
        print_status "Running trading tests only..."
        npx playwright test e2e/trading.spec.ts --workers="$WORKERS"
        ;;
    "presale")
        print_status "Running presale tests only..."
        npx playwright test e2e/token-presale.spec.ts --workers="$WORKERS"
        ;;
    "all"|*)
        print_status "Running all E2E tests with $WORKERS workers..."
        npx playwright test --workers="$WORKERS"
        ;;
esac

TEST_EXIT_CODE=$?

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    print_status "All E2E tests passed!"
    echo ""
    echo "View HTML report: npx playwright show-report"
else
    print_warning "Some tests failed. Exit code: $TEST_EXIT_CODE"
    echo ""
    echo "View HTML report: npx playwright show-report"
    echo "View traces: npx playwright show-trace test-results/"
fi

exit $TEST_EXIT_CODE

