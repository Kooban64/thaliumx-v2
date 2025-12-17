#!/bin/bash

# Comprehensive Test Runner - API + Playwright E2E
# Runs all test suites and generates unified reports

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Starting Comprehensive Test Suite (API + Playwright E2E)..."
echo "============================================================"
echo ""

# Check if services are running
API_URL="${API_URL:-http://localhost:3002}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3001}"

echo "🔍 Checking services availability..."
echo "   Backend API: $API_URL"
echo "   Frontend: $FRONTEND_URL"
echo ""

# Check backend
if curl -f -s "$API_URL/health" > /dev/null 2>&1; then
    echo "✅ Backend API is running"
else
    echo "⚠️  Warning: Backend API health check failed"
fi

# Check frontend
if curl -f -s "$FRONTEND_URL" > /dev/null 2>&1; then
    echo "✅ Frontend is running"
else
    echo "⚠️  Warning: Frontend is not accessible"
fi

echo ""

# Run comprehensive API tests
echo "📡 Running API Tests..."
echo "----------------------"
cd "$PROJECT_ROOT/tests/comprehensive"

if [ ! -d "node_modules" ]; then
    echo "📦 Installing API test dependencies..."
    npm install
fi

export API_URL="$API_URL"
export NODE_ENV=test

if command -v ts-node &> /dev/null; then
    ts-node test-runner.ts
else
    echo "📦 Installing ts-node..."
    npm install -g ts-node typescript
    ts-node test-runner.ts
fi

API_EXIT_CODE=$?

echo ""
echo "🎭 Running Playwright E2E Tests..."
echo "-----------------------------------"
cd "$PROJECT_ROOT/docker/frontend"

# Install Playwright if needed
if [ ! -d "node_modules/@playwright" ]; then
    echo "📦 Installing Playwright..."
    npm install
    npx playwright install --with-deps chromium
fi

# Run Playwright tests
export NEXT_PUBLIC_API_URL="$API_URL"
export NEXT_PUBLIC_APP_URL="$FRONTEND_URL"

npx playwright test --reporter=html --reporter=json --reporter=junit || true

PLAYWRIGHT_EXIT_CODE=$?

echo ""
echo "============================================================"
echo "📊 TEST SUMMARY"
echo "============================================================"
echo ""

if [ $API_EXIT_CODE -eq 0 ] && [ $PLAYWRIGHT_EXIT_CODE -eq 0 ]; then
    echo "✅ All tests completed successfully!"
    FINAL_EXIT_CODE=0
else
    echo "⚠️  Some tests failed"
    FINAL_EXIT_CODE=1
fi

echo ""
echo "📄 Reports generated:"
echo "   - API Tests: $PROJECT_ROOT/test-reports/latest-report.html"
echo "   - Playwright: $PROJECT_ROOT/docker/frontend/playwright-report/index.html"
echo ""

exit $FINAL_EXIT_CODE

