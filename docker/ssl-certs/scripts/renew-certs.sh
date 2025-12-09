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
    
    # Deploy hook - copy certificates to gateway
    if [ "$DEPLOY_HOOK" = true ]; then
        echo ""
        echo -e "${YELLOW}Deploying certificates to APISIX gateway...${NC}"
        
        # Create gateway SSL directory if it doesn't exist
        mkdir -p "$GATEWAY_SSL_DIR"
        
        # Copy certificates
        cp data/certbot/conf/live/thaliumx.com/fullchain.pem "$GATEWAY_SSL_DIR/"
        cp data/certbot/conf/live/thaliumx.com/privkey.pem "$GATEWAY_SSL_DIR/"
        
        echo -e "${GREEN}Certificates deployed to $GATEWAY_SSL_DIR${NC}"
        
        # Reload APISIX if running
        if docker ps | grep -q thaliumx-apisix; then
            echo -e "${YELLOW}Reloading APISIX configuration...${NC}"
            docker exec thaliumx-apisix apisix reload
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