#!/bin/bash
# =============================================================================
# Setup Let's Encrypt Certificates for APISIX
# =============================================================================
# This script copies Let's Encrypt certificates to APISIX and configures them
# Usage: ./setup-letsencrypt-certs.sh
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Setting up Let's Encrypt Certificates for APISIX ===${NC}"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APISIX_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SSL_CERTS_DIR="$(cd "$APISIX_DIR/../ssl-certs" && pwd)"
CERT_DIR="$SSL_CERTS_DIR/data/certbot/conf/live"

# Check if certificates exist
if [ ! -d "$CERT_DIR/thaliumx.com" ]; then
    echo -e "${YELLOW}Let's Encrypt certificates not found.${NC}"
    echo -e "${YELLOW}Please run: cd docker/ssl-certs && ./scripts/obtain-certs.sh${NC}"
    echo ""
    echo -e "${YELLOW}For localhost testing, using self-signed certificates...${NC}"
    
    # Create self-signed cert for localhost
    mkdir -p "$APISIX_DIR/certs/letsencrypt"
    if [ ! -f "$APISIX_DIR/certs/letsencrypt/server.crt" ]; then
        echo -e "${YELLOW}Generating self-signed certificate for localhost...${NC}"
        openssl req -x509 -newkey rsa:4096 \
            -keyout "$APISIX_DIR/certs/letsencrypt/server.key" \
            -out "$APISIX_DIR/certs/letsencrypt/server.crt" \
            -days 365 -nodes \
            -subj "/CN=localhost" \
            -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1,IP:0.0.0.0"
        chmod 600 "$APISIX_DIR/certs/letsencrypt/server.key"
        chmod 644 "$APISIX_DIR/certs/letsencrypt/server.crt"
        echo -e "${GREEN}Self-signed certificate created${NC}"
    fi
    exit 0
fi

# Copy Let's Encrypt certificates
echo -e "${YELLOW}Copying Let's Encrypt certificates...${NC}"

# Create target directory
mkdir -p "$APISIX_DIR/certs/letsencrypt"

# Copy fullchain (certificate + chain)
if [ -f "$CERT_DIR/thaliumx.com/fullchain.pem" ]; then
    cp "$CERT_DIR/thaliumx.com/fullchain.pem" "$APISIX_DIR/certs/letsencrypt/server.crt"
    echo -e "${GREEN}✓ Copied fullchain.pem -> server.crt${NC}"
else
    echo -e "${RED}Error: fullchain.pem not found${NC}"
    exit 1
fi

# Copy private key
if [ -f "$CERT_DIR/thaliumx.com/privkey.pem" ]; then
    cp "$CERT_DIR/thaliumx.com/privkey.pem" "$APISIX_DIR/certs/letsencrypt/server.key"
    chmod 600 "$APISIX_DIR/certs/letsencrypt/server.key"
    echo -e "${GREEN}✓ Copied privkey.pem -> server.key${NC}"
else
    echo -e "${RED}Error: privkey.pem not found${NC}"
    exit 1
fi

# Copy to APISIX container if running
if docker ps | grep -q thaliumx-apisix; then
    echo -e "${YELLOW}Copying certificates to APISIX container...${NC}"
    docker cp "$APISIX_DIR/certs/letsencrypt/server.crt" thaliumx-apisix:/tmp/certs/server.crt
    docker cp "$APISIX_DIR/certs/letsencrypt/server.key" thaliumx-apisix:/tmp/certs/server.key
    docker exec thaliumx-apisix chmod 644 /tmp/certs/server.crt
    docker exec thaliumx-apisix chmod 600 /tmp/certs/server.key
    echo -e "${GREEN}✓ Certificates copied to container${NC}"
    
    # Reload APISIX
    echo -e "${YELLOW}Reloading APISIX...${NC}"
    docker restart thaliumx-apisix || echo -e "${YELLOW}Note: APISIX restart may be needed manually${NC}"
fi

echo ""
echo -e "${GREEN}=== Let's Encrypt Certificates Setup Complete ===${NC}"
echo ""
echo "Certificates are located at:"
echo "  - $APISIX_DIR/certs/letsencrypt/server.crt"
echo "  - $APISIX_DIR/certs/letsencrypt/server.key"
echo ""
echo "APISIX is configured to use:"
echo "  - /tmp/certs/server.crt"
echo "  - /tmp/certs/server.key"
