#!/bin/bash

# Run tests in sections to avoid timeouts
# Usage: ./tests/run-tests-by-section.sh [section-name]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_DIR="$PROJECT_ROOT/tests/comprehensive"

echo "🚀 ThaliumX Section-Based Test Runner"
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

cd "$TEST_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing test dependencies..."
    npm install
fi

export API_URL="$API_URL"
export NODE_ENV=test

# Get section name from argument
SECTION_NAME="$1"

if [ -z "$SECTION_NAME" ]; then
    echo "📋 Running all test sections sequentially..."
    echo ""
    
    # Run all sections one by one
    npx ts-node section-runner.ts
else
    echo "📋 Running section: $SECTION_NAME"
    echo ""
    
    # Run specific section
    npx ts-node section-runner.ts "$SECTION_NAME"
fi

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ Tests completed!"
    echo ""
    echo "📄 Reports available in: $PROJECT_ROOT/test-reports/sections/"
    echo "📄 Final report: $PROJECT_ROOT/test-reports/final-report.json"
else
    echo ""
    echo "❌ Some tests failed. Check reports for details."
fi

exit $EXIT_CODE

