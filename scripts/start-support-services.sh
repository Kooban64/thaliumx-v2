#!/bin/bash
# Script to start osTicket, Live Helper Chat, and verify Authentik
# This works around Docker Compose path resolution issues

set -e

echo "🚀 Starting Support Services (osTicket, Live Helper Chat, Authentik)"
echo "===================================================================="

# Get support database password
DB_PASSWORD=$(cat /home/ubuntu/thaliumx-v1/.secrets/generated/support-db-password)

# Start osTicket using docker run (workaround for compose path issues)
echo ""
echo "📦 Starting osTicket..."
if ! docker ps | grep -q thaliumx-osticket; then
    docker run -d \
        --name thaliumx-osticket \
        --network thaliumx-net \
        --restart unless-stopped \
        -e DB_HOST=thaliumx-support-postgres \
        -e DB_USER=support \
        -e DB_PASS="$DB_PASSWORD" \
        -e DB_NAME=support \
        -e AUTHENTIK_CLIENT_ID="${AUTHENTIK_CLIENT_ID:-}" \
        -e AUTHENTIK_CLIENT_SECRET="${AUTHENTIK_CLIENT_SECRET:-}" \
        -e OSTICKET_SECRET_SALT="${OSTICKET_SECRET_SALT:-$(openssl rand -hex 16)}" \
        -e LHC_API_KEY="${LHC_API_KEY:-}" \
        -e SMTP_HOST=thaliumx-mailhog \
        -e SMTP_PORT=1025 \
        thaliumx/osticket:latest
    
    echo "✅ osTicket started"
else
    echo "✅ osTicket already running"
fi

# Check Authentik
echo ""
echo "🔐 Checking Authentik..."
if docker ps | grep -q thaliumx-Authentik; then
    AUTHENTIK_STATUS=$(docker inspect thaliumx-Authentik --format '{{.State.Status}}')
    echo "✅ Authentik: $AUTHENTIK_STATUS"
    
    if docker ps | grep -q thaliumx-Authentik-postgres; then
        AUTHENTIK_PG_HEALTH=$(docker inspect thaliumx-Authentik-postgres --format '{{.State.Health.Status}}')
        echo "✅ Authentik Postgres: $AUTHENTIK_PG_HEALTH"
    fi
else
    echo "⚠️  Authentik not running"
fi

# Wait for services to be ready
echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Health check
echo ""
echo "🏥 Health Status:"
echo "================="

# Check osTicket
if docker ps | grep -q thaliumx-osticket; then
    OSTICKET_STATUS=$(docker inspect thaliumx-osticket --format '{{.State.Status}}')
    echo "osTicket: $OSTICKET_STATUS"
    
    # Try to check if it's responding
    if docker exec thaliumx-osticket wget -q -O /dev/null http://localhost:80/ 2>/dev/null; then
        echo "  ✅ osTicket HTTP endpoint responding"
    else
        echo "  ⏳ osTicket starting up..."
    fi
else
    echo "osTicket: not running"
fi

# Check support services
if docker ps --filter "health=healthy" | grep -q support-postgres; then
    echo "support-postgres: ✅ healthy"
else
    echo "support-postgres: ⚠️  not healthy"
fi

if docker ps --filter "health=healthy" | grep -q support-moderation-analytics; then
    echo "support-moderation-analytics: ✅ healthy"
else
    echo "support-moderation-analytics: ⚠️  not healthy"
fi

# Check Authentik
if docker ps | grep -q thaliumx-Authentik; then
    echo "Authentik: ✅ running"
    if docker ps --filter "health=healthy" | grep -q Authentik-postgres; then
        echo "Authentik-postgres: ✅ healthy"
    fi
fi

echo ""
echo "✅ Support services startup complete!"
echo ""
echo "Note: Live Helper Chat requires a different base image."
echo "      The remorhaz/livehelperchat image is not publicly available."
