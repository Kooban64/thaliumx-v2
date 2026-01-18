#!/bin/bash
# =============================================================================
# SSL Certificate Renewal Script
# =============================================================================
# This script renews SSL certificates from Let's Encrypt
# Can be run as a cron job for automatic renewal
# Usage: ./renew-certs.sh [--deploy-hook]
# =============================================================================

set -e

# Configuration
DEPLOY_HOOK=false
GATEWAY_SSL_DIR="../gateway/config/ssl"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --deploy-hook)
            DEPLOY_HOOK=true
            shift
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

echo -e "${GREEN}=== ThaliumX SSL Certificate Renewal ===${NC}"
echo ""

# Change to script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

if [ ! -f "compose.yaml" ]; then
    echo -e "${RED}Error: Cannot find compose.yaml${NC}"
    exit 1
fi

# Check if certificates exist
if [ ! -d "data/certbot/conf/live/thaliumx.com" ]; then
    echo -e "${RED}Error: No certificates found. Run obtain-certs.sh first.${NC}"
    exit 1
fi

# Start nginx for ACME challenge
echo -e "${YELLOW}Starting nginx for ACME challenge...${NC}"
docker compose up -d nginx-acme

# Wait for nginx to be ready
sleep 3

# Renew certificates
echo -e "${YELLOW}Renewing SSL certificates...${NC}"
docker compose run --rm certbot renew

# Check renewal status
RENEWAL_STATUS=$?

if [ $RENEWAL_STATUS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}Certificate renewal completed${NC}"
    
    # Deploy hook - copy certificates to APISIX
    if [ "$DEPLOY_HOOK" = true ]; then
        echo ""
        echo -e "${YELLOW}Deploying certificates to APISIX gateway...${NC}"
        
        # Run the APISIX certificate setup script
        APISIX_SCRIPT_DIR="$(cd "$SCRIPT_DIR/../../apisix/scripts" && pwd)"
        if [ -f "$APISIX_SCRIPT_DIR/setup-letsencrypt-certs.sh" ]; then
            bash "$APISIX_SCRIPT_DIR/setup-letsencrypt-certs.sh"
        else
            # Fallback: copy to APISIX certs directory
            APISIX_CERTS_DIR="$(cd "$SCRIPT_DIR/../../apisix/certs/letsencrypt" && pwd)"
            mkdir -p "$APISIX_CERTS_DIR"
            
            # Copy certificates
            cp data/certbot/conf/live/thaliumx.com/fullchain.pem "$APISIX_CERTS_DIR/server.crt"
            cp data/certbot/conf/live/thaliumx.com/privkey.pem "$APISIX_CERTS_DIR/server.key"
            chmod 600 "$APISIX_CERTS_DIR/server.key"
            chmod 644 "$APISIX_CERTS_DIR/server.crt"
            
            echo -e "${GREEN}Certificates deployed to $APISIX_CERTS_DIR${NC}"
            
            # Copy to APISIX container if running
            if docker ps | grep -q thaliumx-apisix; then
                echo -e "${YELLOW}Copying certificates to APISIX container...${NC}"
                docker cp "$APISIX_CERTS_DIR/server.crt" thaliumx-apisix:/tmp/certs/server.crt
                docker cp "$APISIX_CERTS_DIR/server.key" thaliumx-apisix:/tmp/certs/server.key
                docker exec thaliumx-apisix chmod 644 /tmp/certs/server.crt
                docker exec thaliumx-apisix chmod 600 /tmp/certs/server.key
                echo -e "${GREEN}Certificates copied to container${NC}"
            fi
        fi
        
        # Reload APISIX if running
        if docker ps | grep -q thaliumx-apisix; then
            echo -e "${YELLOW}Reloading APISIX configuration...${NC}"
            docker restart thaliumx-apisix || echo -e "${YELLOW}Note: APISIX restart may be needed manually${NC}"
            echo -e "${GREEN}APISIX reloaded${NC}"
        fi
    fi
else
    echo ""
    echo -e "${RED}Certificate renewal failed${NC}"
fi

# Stop nginx
echo ""
echo -e "${YELLOW}Stopping nginx ACME service...${NC}"
docker compose down

echo ""
echo -e "${GREEN}Done!${NC}"