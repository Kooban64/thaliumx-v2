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
echo "🧪 Running Python-Based Migration Verification Tests..."

# Change to scripts directory for Python tests
cd scripts

# Run the comprehensive Python verification
echo "Running comprehensive migration verification..."
python3 migration_verification.py

echo ""
echo "📊 Running Service Health Checks..."

# Run the health check
echo "Running service health verification..."
python3 service_health_check.py

echo ""
echo "🔍 Running Authentication Flow Tests..."

# Run the auth flow test
echo "Running authentication flow verification..."
python3 auth_flow_test.py

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