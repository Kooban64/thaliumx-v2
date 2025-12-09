#!/bin/bash
# =============================================================================
# APISIX Route Configuration Script
# =============================================================================
# This script configures APISIX routes for ThaliumX domains
# Usage: ./configure-routes.sh [--ssl]
# =============================================================================

set -e

# Configuration
APISIX_ADMIN_URL="http://localhost:9180/apisix/admin"
ADMIN_KEY="thaliumx-admin-key"
FRONTEND_UPSTREAM="thaliumx-frontend:3000"
BACKEND_UPSTREAM="thaliumx-backend:3001"
ENABLE_SSL=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --ssl)
            ENABLE_SSL=true
            shift
            ;;
        --admin-url)
            APISIX_ADMIN_URL="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== ThaliumX APISIX Route Configuration ===${NC}"
echo ""

# Function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    curl -s -X "$method" "$APISIX_ADMIN_URL$endpoint" \
        -H "X-API-KEY: $ADMIN_KEY" \
        -H "Content-Type: application/json" \
        -d "$data"
}

# Check if APISIX is running
echo -e "${YELLOW}Checking APISIX connectivity...${NC}"
if ! curl -s -f "$APISIX_ADMIN_URL/routes" -H "X-API-KEY: $ADMIN_KEY" > /dev/null 2>&1; then
    echo -e "${RED}Error: Cannot connect to APISIX Admin API at $APISIX_ADMIN_URL${NC}"
    echo "Make sure APISIX is running and accessible."
    exit 1
fi
echo -e "${GREEN}APISIX is accessible${NC}"
echo ""

# =============================================================================
# Configure Upstreams
# =============================================================================
echo -e "${YELLOW}Configuring upstreams...${NC}"

# Frontend upstream
echo "Creating frontend upstream..."
api_call PUT "/upstreams/1" '{
    "name": "frontend-upstream",
    "type": "roundrobin",
    "nodes": {
        "thaliumx-frontend:3000": 1
    },
    "timeout": {
        "connect": 6,
        "send": 6,
        "read": 6
    },
    "retries": 2
}'
echo ""

# Backend upstream
echo "Creating backend upstream..."
api_call PUT "/upstreams/2" '{
    "name": "backend-upstream",
    "type": "roundrobin",
    "nodes": {
        "thaliumx-backend:3001": 1
    },
    "timeout": {
        "connect": 6,
        "send": 6,
        "read": 6
    },
    "retries": 2
}'
echo ""

# =============================================================================
# Configure SSL Certificates (if enabled)
# =============================================================================
if [ "$ENABLE_SSL" = true ]; then
    echo -e "${YELLOW}Configuring SSL certificates...${NC}"
    
    SSL_DIR="$(dirname "$0")/../config/ssl"
    
    if [ -f "$SSL_DIR/fullchain.pem" ] && [ -f "$SSL_DIR/privkey.pem" ]; then
        CERT=$(cat "$SSL_DIR/fullchain.pem" | sed ':a;N;$!ba;s/\n/\\n/g')
        KEY=$(cat "$SSL_DIR/privkey.pem" | sed ':a;N;$!ba;s/\n/\\n/g')
        
        echo "Creating SSL certificate for thaliumx.com..."
        api_call PUT "/ssls/1" "{
            \"cert\": \"$CERT\",
            \"key\": \"$KEY\",
            \"snis\": [\"thaliumx.com\", \"www.thaliumx.com\", \"thal.thaliumx.com\"]
        }"
        echo ""
    else
        echo -e "${RED}Warning: SSL certificates not found in $SSL_DIR${NC}"
        echo "Run the SSL certificate obtainment script first."
    fi
fi

# =============================================================================
# Configure Routes
# =============================================================================
echo -e "${YELLOW}Configuring routes...${NC}"

# Route 1: thaliumx.com - Main landing page (frontend)
echo "Creating route for thaliumx.com (main landing)..."
api_call PUT "/routes/1" '{
    "name": "thaliumx-main",
    "desc": "Main landing page - thaliumx.com",
    "uri": "/*",
    "host": "thaliumx.com",
    "upstream_id": 1,
    "plugins": {
        "redirect": {
            "http_to_https": true
        }
    },
    "priority": 10
}'
echo ""

# Route 2: www.thaliumx.com - Redirect to thaliumx.com
echo "Creating route for www.thaliumx.com (redirect)..."
api_call PUT "/routes/2" '{
    "name": "thaliumx-www-redirect",
    "desc": "Redirect www to non-www",
    "uri": "/*",
    "host": "www.thaliumx.com",
    "plugins": {
        "redirect": {
            "uri": "https://thaliumx.com$request_uri",
            "ret_code": 301
        }
    },
    "priority": 10
}'
echo ""

# Route 3: thal.thaliumx.com - Token presale page
echo "Creating route for thal.thaliumx.com (presale)..."
api_call PUT "/routes/3" '{
    "name": "thaliumx-presale",
    "desc": "Token presale page - thal.thaliumx.com",
    "uri": "/*",
    "host": "thal.thaliumx.com",
    "upstream_id": 1,
    "plugins": {
        "redirect": {
            "http_to_https": true
        },
        "proxy-rewrite": {
            "uri": "/presale$request_uri"
        }
    },
    "priority": 10
}'
echo ""

# Route 4: API routes (backend)
echo "Creating route for API endpoints..."
api_call PUT "/routes/4" '{
    "name": "thaliumx-api",
    "desc": "API endpoints",
    "uri": "/api/*",
    "hosts": ["thaliumx.com", "thal.thaliumx.com"],
    "upstream_id": 2,
    "plugins": {
        "redirect": {
            "http_to_https": true
        },
        "cors": {
            "allow_origins": "https://thaliumx.com,https://thal.thaliumx.com",
            "allow_methods": "GET,POST,PUT,DELETE,OPTIONS",
            "allow_headers": "Content-Type,Authorization,X-Requested-With",
            "allow_credential": false,
            "max_age": 3600
        }
    },
    "priority": 20
}'
echo ""

# Route 5: Health check endpoint
echo "Creating health check route..."
api_call PUT "/routes/5" '{
    "name": "health-check",
    "desc": "Health check endpoint",
    "uri": "/health",
    "methods": ["GET"],
    "plugins": {
        "serverless-pre-function": {
            "phase": "access",
            "functions": ["return function() ngx.say(\"{\\\"status\\\":\\\"healthy\\\"}\") end"]
        }
    },
    "priority": 100
}'
echo ""

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${GREEN}=== Route Configuration Complete ===${NC}"
echo ""
echo "Configured routes:"
echo "  1. thaliumx.com/* → Frontend (main landing page)"
echo "  2. www.thaliumx.com/* → Redirect to thaliumx.com"
echo "  3. thal.thaliumx.com/* → Frontend /token-presale (presale page)"
echo "  4. */api/* → Backend API"
echo "  5. /health → Health check"
echo ""

if [ "$ENABLE_SSL" = true ]; then
    echo "SSL: Enabled"
else
    echo "SSL: Disabled (run with --ssl to enable)"
fi

echo ""
echo -e "${GREEN}Done!${NC}"