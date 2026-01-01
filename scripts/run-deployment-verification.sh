#!/bin/bash

# Production Deployment Verification Script
# Comprehensive testing of the entire migrated platform

set -e

echo "🚀 ThaliumX Production Deployment Verification"
echo "=============================================="
echo ""

# Check if we're in the right directory
if [ ! -d "docker" ]; then
    echo "❌ Error: docker directory not found. Please run this script from the project root."
    exit 1
fi

echo "📋 Phase 1: Infrastructure Health Check"
echo "======================================="

# Start the production environment
echo "🔄 Starting production environment..."
docker compose -f docker/compose/prod-v1/base.yml -f docker/compose/prod-v1/production.yml up -d

# Wait for services to start
echo "⏳ Waiting for services to initialize..."
sleep 30

# Run service health check
echo "🏥 Running service health verification..."
python3 scripts/service_health_check.py

echo ""
echo "📋 Phase 2: Migration Verification"
echo "==================================="

# Run comprehensive migration verification
echo "🔍 Running migration verification..."
python3 scripts/migration_verification.py

echo ""
echo "📋 Phase 3: Authentication Flow Testing"
echo "======================================="

# Test authentication flows
echo "🔐 Testing authentication flows..."
python3 scripts/auth_flow_test.py

echo ""
echo "📋 Phase 4: API Gateway Verification"
echo "===================================="

# Test APISIX routing and authentication
echo "🌐 Testing API gateway and routing..."
curl -s http://localhost:9080/apisix/status || echo "⚠️  APISIX status check failed"

echo ""
echo "📋 Phase 5: End-to-End Integration Test"
echo "======================================="

# Run full integration test
echo "🔄 Running end-to-end integration test..."
python3 scripts/integration_test.py

echo ""
echo "📋 Phase 6: Performance Baseline"
echo "================================="

# Run basic performance checks
echo "⚡ Running performance baseline..."
python3 scripts/performance_test.py

echo ""
echo "📋 Phase 7: Security Verification"
echo "================================="

# Check security configurations
echo "🔒 Verifying security configurations..."
python3 scripts/security_check.py

echo ""
echo "📋 Phase 8: Final System Report"
echo "==============================="

# Generate final report
echo "📊 Generating final deployment report..."
python3 scripts/generate_deployment_report.py

echo ""
echo "✅ Deployment verification complete!"
echo "📄 Check logs/ directory for detailed reports"
echo "📋 Review scripts/deployment-report.html for comprehensive results"

# Show service status
echo ""
echo "🔍 Current Service Status:"
echo "=========================="
docker compose -f docker/compose/prod-v1/base.yml -f docker/compose/prod-v1/production.yml ps