#!/bin/bash
# =============================================================================
# SSL Certificate Obtainment Script
# =============================================================================
# This script obtains SSL certificates from Let's Encrypt for ThaliumX domains
# Usage: ./obtain-certs.sh [--staging] [--force-renewal]
# =============================================================================

set -e

# Configuration
DOMAINS=("thaliumx.com" "www.thaliumx.com" "thal.thaliumx.com")
EMAIL="admin@thaliumx.com"
STAGING=false
FORCE_RENEWAL=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --staging)
            STAGING=true
            shift
            ;;
        --force-renewal)
            FORCE_RENEWAL=true
            shift
            ;;
        --email)
            EMAIL="$2"
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

echo -e "${GREEN}=== ThaliumX SSL Certificate Obtainment ===${NC}"
echo ""

# Change to script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Check if running from correct directory
if [ ! -f "compose.yaml" ]; then
    echo -e "${RED}Error: Cannot find compose.yaml${NC}"
    exit 1
fi

# Create required directories
echo -e "${YELLOW}Creating required directories...${NC}"
mkdir -p data/certbot/conf
mkdir -p data/certbot/www/.well-known/acme-challenge
mkdir -p data/certbot/logs

# Start nginx for ACME challenge
echo -e "${YELLOW}Starting nginx for ACME challenge...${NC}"
docker compose up -d nginx-acme

# Wait for nginx to be ready
echo -e "${YELLOW}Waiting for nginx to be ready...${NC}"
sleep 5

# Check if nginx is running
if ! docker compose ps nginx-acme | grep -q "Up"; then
    echo -e "${RED}Error: nginx-acme failed to start${NC}"
    docker compose logs nginx-acme
    exit 1
fi

# Build certbot command
CERTBOT_CMD="certonly --webroot -w /var/www/certbot"

# Add domains
for domain in "${DOMAINS[@]}"; do
    CERTBOT_CMD="$CERTBOT_CMD -d $domain"
done

# Add email
CERTBOT_CMD="$CERTBOT_CMD --email $EMAIL"

# Add staging flag if requested
if [ "$STAGING" = true ]; then
    echo -e "${YELLOW}Using Let's Encrypt staging environment${NC}"
    CERTBOT_CMD="$CERTBOT_CMD --staging"
fi

# Add force renewal if requested
if [ "$FORCE_RENEWAL" = true ]; then
    echo -e "${YELLOW}Forcing certificate renewal${NC}"
    CERTBOT_CMD="$CERTBOT_CMD --force-renewal"
fi

# Add non-interactive flags
CERTBOT_CMD="$CERTBOT_CMD --agree-tos --non-interactive"

# Obtain certificates
echo -e "${YELLOW}Obtaining SSL certificates...${NC}"
echo "Running: certbot $CERTBOT_CMD"
echo ""

docker compose run --rm certbot $CERTBOT_CMD

# Check if certificates were obtained
if [ -d "data/certbot/conf/live/thaliumx.com" ]; then
    echo ""
    echo -e "${GREEN}=== SSL Certificates Obtained Successfully ===${NC}"
    echo ""
    echo "Certificate files are located at:"
    echo "  - data/certbot/conf/live/thaliumx.com/fullchain.pem"
    echo "  - data/certbot/conf/live/thaliumx.com/privkey.pem"
    echo ""
    echo "To use with APISIX, copy certificates to gateway config:"
    echo "  cp data/certbot/conf/live/thaliumx.com/fullchain.pem ../gateway/config/ssl/"
    echo "  cp data/certbot/conf/live/thaliumx.com/privkey.pem ../gateway/config/ssl/"
else
    echo ""
    echo -e "${RED}=== Certificate Obtainment Failed ===${NC}"
    echo "Check the logs for more information:"
    echo "  docker compose logs certbot"
fi

# Stop nginx
echo ""
echo -e "${YELLOW}Stopping nginx ACME service...${NC}"
docker compose down

echo ""
echo -e "${GREEN}Done!${NC}"