#!/bin/bash

# Comprehensive Test Runner Script
# Runs all tests and generates detailed reports

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_DIR="$PROJECT_ROOT/tests/comprehensive"

echo "🚀 Starting Comprehensive Test Suite..."
echo "======================================"
echo ""

# Check if API is accessible
API_URL="${API_URL:-http://localhost:3002}"
echo "🔍 Checking API availability at $API_URL..."

if ! curl -f -s "$API_URL/health" > /dev/null 2>&1; then
    echo "⚠️  Warning: API health check failed. Tests may fail."
    echo "   Make sure the backend is running at $API_URL"
    echo ""
fi

# Install dependencies if needed
if [ ! -d "$TEST_DIR/node_modules" ]; then
    echo "📦 Installing test dependencies..."
    cd "$TEST_DIR"
    npm install
fi

# Set environment variables
export API_URL="$API_URL"
export NODE_ENV=test

# Run tests
echo ""
echo "🧪 Running comprehensive tests..."
echo ""

cd "$TEST_DIR"

if command -v ts-node &> /dev/null; then
    ts-node test-runner.ts
else
    echo "❌ ts-node not found. Installing..."
    npm install -g ts-node typescript
    ts-node test-runner.ts
fi

# Check exit code
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ All tests completed successfully!"
    echo ""
    echo "📄 Reports generated in: $PROJECT_ROOT/test-reports/"
    echo "   - latest-report.html (HTML report)"
    echo "   - latest-report.json (JSON report)"
else
    echo ""
    echo "❌ Some tests failed. Check the report for details."
    echo ""
    echo "📄 Reports generated in: $PROJECT_ROOT/test-reports/"
fi

exit $EXIT_CODE

