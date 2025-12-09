#!/bin/bash

# Setup script for testing Ballerine integration
# Ensures all required services are running and configured

set -e

echo "🔧 Ballerine Integration Test Setup"
echo "===================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker."
    exit 1
fi

echo "✅ Docker is running"

# Check if Ballerine service is running
if docker ps | grep -q "thaliumx-ballerine-workflow"; then
    echo "✅ Ballerine service is running"
else
    echo "⚠️  Ballerine service is not running"
    echo "   Starting Ballerine service..."
    
    cd /home/ubuntu/thaliumx-clean
    docker-compose -f docker-compose.services-standalone.yml up -d ballerine-workflow
    
    echo "⏳ Waiting for Ballerine to be healthy..."
    sleep 10
    
    # Wait for health check
    max_attempts=30
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if curl -sf http://localhost:4000/api/v1/_health/ready > /dev/null 2>&1; then
            echo "✅ Ballerine service is healthy"
            break
        fi
        attempt=$((attempt + 1))
        echo "   Attempt $attempt/$max_attempts..."
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        echo "❌ Ballerine service failed to start"
        exit 1
    fi
fi

# Check if backend is running
if docker ps | grep -q "thaliumx-backend"; then
    echo "✅ Backend service is running"
else
    echo "⚠️  Backend service is not running"
    echo "   Note: Backend is needed for full integration tests"
fi

# Check required environment variables
echo ""
echo "📝 Environment Variables Check:"
echo "-------------------------------"

required_vars=(
    "BALLERINE_BASE_URL"
    "BALLERINE_API_KEY"
    "DATABASE_URL"
    "REDIS_URL"
)

missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "⚠️  $var is not set"
        missing_vars+=("$var")
    else
        echo "✅ $var is set"
    fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo ""
    echo "📋 Recommended .env configuration:"
    echo "-----------------------------------"
    for var in "${missing_vars[@]}"; do
        case $var in
            BALLERINE_BASE_URL)
                echo "BALLERINE_BASE_URL=http://ballerine-workflow:4000"
                ;;
            BALLERINE_API_KEY)
                echo "BALLERINE_API_KEY=ballerine_oss_api_key_12345"
                ;;
            DATABASE_URL)
                echo "DATABASE_URL=postgresql://thaliumx_user:changeme@thaliumx-postgres:5432/thaliumx"
                ;;
            REDIS_URL)
                echo "REDIS_URL=redis://thaliumx-redis:6379"
                ;;
        esac
    done
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Run integration tests: ./backend/scripts/test-ballerine-integration.sh"
echo "2. Or test manually: curl http://localhost:4000/api/v1/_health/ready"

