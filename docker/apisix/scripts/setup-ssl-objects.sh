#!/bin/bash
# =============================================================================
# Setup SSL Objects in APISIX for Domain-Specific Certificates
# =============================================================================
# This script creates SSL objects in APISIX etcd for SNI (Server Name Indication)
# Usage: ./setup-ssl-objects.sh
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Setting up SSL Objects in APISIX ===${NC}"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APISIX_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SSL_CERTS_DIR="$(cd "$APISIX_DIR/../ssl-certs" && pwd)"
CERT_DIR="$SSL_CERTS_DIR/data/certbot/conf/live"

# Check if certificates exist
if [ ! -d "$CERT_DIR/thaliumx.com" ]; then
    echo -e "${RED}Error: Let's Encrypt certificates not found.${NC}"
    echo -e "${YELLOW}Please run: cd docker/ssl-certs && ./scripts/obtain-certs.sh${NC}"
    exit 1
fi

CERT_FILE="$CERT_DIR/thaliumx.com/fullchain.pem"
KEY_FILE="$CERT_DIR/thaliumx.com/privkey.pem"

if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
    echo -e "${RED}Error: Certificate files not found${NC}"
    exit 1
fi

# Check if etcd is accessible
if ! docker ps | grep -q thaliumx-etcd; then
    echo -e "${RED}Error: etcd container not running${NC}"
    exit 1
fi

echo -e "${YELLOW}Reading certificate files...${NC}"

# Read and escape certificate content for JSON
CERT_CONTENT=$(cat "$CERT_FILE" | sed 's/$/\\n/' | tr -d '\n' | sed 's/"/\\"/g')
KEY_CONTENT=$(cat "$KEY_FILE" | sed 's/$/\\n/' | tr -d '\n' | sed 's/"/\\"/g')

# Create SSL object JSON
SSL_JSON=$(cat <<EOF
{
  "id": "1",
  "snis": [
    "thaliumx.com",
    "www.thaliumx.com",
    "thal.thaliumx.com",
    "*.thaliumx.com"
  ],
  "cert": "$CERT_CONTENT",
  "key": "$KEY_CONTENT",
  "status": 1
}
EOF
)

echo -e "${YELLOW}Creating SSL object in APISIX etcd...${NC}"

# Store in etcd
echo "$SSL_JSON" | docker exec -i thaliumx-etcd etcdctl put /apisix/ssls/1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ SSL object created successfully${NC}"
    
    # Verify
    echo ""
    echo -e "${YELLOW}Verifying SSL object...${NC}"
    docker exec thaliumx-etcd etcdctl get /apisix/ssls/1 | python3 -m json.tool > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ SSL object verified${NC}"
    else
        echo -e "${YELLOW}⚠ SSL object created but verification failed${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}Restarting APISIX to load SSL configuration...${NC}"
    docker restart thaliumx-apisix
    sleep 5
    
    echo ""
    echo -e "${GREEN}=== SSL Objects Setup Complete ===${NC}"
    echo ""
    echo "SSL object configured for:"
    echo "  - thaliumx.com"
    echo "  - www.thaliumx.com"
    echo "  - thal.thaliumx.com"
    echo "  - *.thaliumx.com (wildcard)"
    echo ""
    echo "Test with:"
    echo "  curl -I https://thaliumx.com"
    echo "  curl -I https://thal.thaliumx.com"
else
    echo -e "${RED}Error: Failed to create SSL object${NC}"
    exit 1
fi
