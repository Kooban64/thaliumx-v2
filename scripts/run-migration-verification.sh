#!/bin/bash

# Zitadel Migration Verification Test Runner
# Runs comprehensive E2E tests to verify 100% migration completion

set -e

echo "🚀 Starting Zitadel Migration Verification"
echo "=========================================="

# Check if we're in the right directory
if [ ! -f "docker/frontend/package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Set environment variables for Zitadel testing
export NEXT_PUBLIC_AUTH_MODE=zitadel
export NEXT_PUBLIC_ZITADEL_ISSUER=https://auth.thaliumx.com
export NEXT_PUBLIC_ZITADEL_CLIENT_ID=thaliumx-frontend
export NEXT_PUBLIC_E2E_TOKEN_PERSIST=1

echo "📋 Test Configuration:"
echo "   Auth Mode: $NEXT_PUBLIC_AUTH_MODE"
echo "   Zitadel Issuer: $NEXT_PUBLIC_ZITADEL_ISSUER"
echo "   Client ID: $NEXT_PUBLIC_ZITADEL_CLIENT_ID"

# Check if services are running
echo ""
echo "🔍 Checking service availability..."

# Check if Zitadel is accessible
if curl -f -s http://localhost:8080/healthz > /dev/null 2>&1; then
    echo "   ✅ Zitadel service is accessible"
else
    echo "   ⚠️  Zitadel service not accessible (may need deployment)"
fi

# Check if backend is accessible
if curl -f -s http://localhost:3002/health > /dev/null 2>&1; then
    echo "   ✅ Backend service is accessible"
else
    echo "   ⚠️  Backend service not accessible (may need deployment)"
fi

# Check if frontend is accessible
if curl -f -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "   ✅ Frontend service is accessible"
else
    echo "   ⚠️  Frontend service not accessible (may need deployment)"
fi

echo ""
echo "🧪 Running Migration Verification Tests..."

# Change to frontend directory for E2E tests
cd docker/frontend

# Run the migration verification tests
echo "Running Zitadel migration verification tests..."
npx playwright test zitadel-migration-verification.spec.ts --reporter=line --verbose

echo ""
echo "📊 Running Existing Zitadel Tests..."

# Also run the existing Zitadel smoke tests
echo "Running Zitadel smoke tests..."
npx playwright test zitadel-smoke.spec.ts --reporter=line --verbose

echo ""
echo "🔍 Running Debug Authentication Test..."

# Run the debug auth test to capture any issues
echo "Running debug authentication test..."
npx playwright test debug-auth.spec.ts --reporter=line --verbose

echo ""
echo "📋 Migration Verification Complete!"
echo "==================================="
echo "✅ Check the test results above for detailed verification"
echo "✅ All tests should pass for 100% migration completion"
echo ""
echo "If any tests fail, check:"
echo "  1. Services are deployed: docker compose -f ../../docker/compose/prod-v1/base.yml -f ../../docker/compose/prod-v1/production.yml up -d"
echo "  2. Zitadel is running: docker compose -f ../../docker/compose/prod-v1/base.yml -f ../../docker/compose/prod-v1/production.yml logs zitadel"
echo "  3. Authentication flow: Visit http://localhost:3000/auth"
echo ""
echo "🎉 Migration verification script completed!"