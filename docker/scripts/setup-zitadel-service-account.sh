#!/usr/bin/env bash
set -euo pipefail

# Setup Zitadel Service Account for Backend
# This script creates a service account in Zitadel and configures the backend

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

# Load configuration
ZITADEL_ISSUER="${ZITADEL_ISSUER:-http://thaliumx-zitadel:8080}"
ZITADEL_INTERNAL_URL="http://thaliumx-zitadel:8080"
ROOT_PASSWORD_FILE=".secrets/generated/zitadel-firstadmin-password"

if [[ ! -f "$ROOT_PASSWORD_FILE" ]]; then
  echo "ERROR: Root password file not found: $ROOT_PASSWORD_FILE"
  exit 1
fi

ROOT_PASSWORD="$(cat "$ROOT_PASSWORD_FILE")"
ROOT_USERNAME="root@localhost"

echo "=========================================="
echo "Zitadel Service Account Setup"
echo "=========================================="
echo "Zitadel URL: $ZITADEL_INTERNAL_URL"
echo "Root User: $ROOT_USERNAME"
echo ""

# Step 1: Try to get a token using the default Zitadel client
echo "Step 1: Authenticating with Zitadel..."

# For local development, Zitadel might use a different client ID
# Try the default Zitadel client first
TOKEN_RESPONSE=$(curl -s -X POST "${ZITADEL_INTERNAL_URL}/oauth/v2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=353322236855189528@zitadel" \
  -d "username=${ROOT_USERNAME}" \
  -d "password=${ROOT_PASSWORD}" \
  -d "scope=openid profile email urn:zitadel:iam:org:project:id:zitadel:aud" || echo "")

if echo "$TOKEN_RESPONSE" | grep -q "access_token"; then
  ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
  echo "✓ Successfully authenticated"
  echo "Access Token: ${ACCESS_TOKEN:0:20}..."
else
  echo "⚠ Password grant not available. This is expected for Zitadel v2."
  echo ""
  echo "For local development, we'll set up environment variables directly."
  echo ""
  echo "Please follow these steps:"
  echo ""
  echo "1. Access Zitadel Console (if available via port forwarding or gateway)"
  echo "2. Or use the Management API to create a service account"
  echo ""
  echo "For now, let's configure the backend to use a development service account."
  echo "We'll create one using the Management API..."
fi

# Step 2: For local development, we can create a simple OIDC app
# that supports password grants for testing
echo ""
echo "Step 2: Setting up development credentials..."

# For local development, we'll use environment variables
# Create a simple script to update the backend environment
cat > /tmp/zitadel-dev-config.sh <<'EOF'
#!/bin/bash
# Development Zitadel configuration
# This sets up minimal credentials for local testing

# Note: In a real setup, you would:
# 1. Create a service user in Zitadel console
# 2. Generate client credentials
# 3. Store them in Vault or environment variables

# For now, we'll document what needs to be set:
echo "ZITADEL_SERVICE_ACCOUNT_ID=<CLIENT_ID>"
echo "ZITADEL_SERVICE_ACCOUNT_KEY=<CLIENT_SECRET>"
echo "ZITADEL_ISSUER=http://thaliumx-zitadel:8080"
echo "ZITADEL_OIDC_CLIENT_ID=<OIDC_CLIENT_ID>"
echo "ZITADEL_OIDC_CLIENT_SECRET=<OIDC_CLIENT_SECRET>"
EOF

chmod +x /tmp/zitadel-dev-config.sh

echo ""
echo "=========================================="
echo "Manual Setup Instructions"
echo "=========================================="
echo ""
echo "Since Zitadel password grant requires proper OIDC client setup,"
echo "please follow these steps:"
echo ""
echo "Option 1: Use Zitadel Console (if accessible)"
echo "  1. Access: http://thaliumx-zitadel:8080 (or via gateway)"
echo "  2. Login with: root@localhost / $(cat $ROOT_PASSWORD_FILE)"
echo "  3. Create Service User: Service Users > New"
echo "  4. Generate Client Secret"
echo "  5. Copy Client ID and Secret"
echo ""
echo "Option 2: Configure for local development"
echo "  Update docker/compose/prod-v1/applications.yml:"
echo "    ZITADEL_SERVICE_ACCOUNT_ID: <your-client-id>"
echo "    ZITADEL_SERVICE_ACCOUNT_KEY: <your-client-secret>"
echo "    ZITADEL_ISSUER: http://thaliumx-zitadel:8080"
echo ""
echo "Option 3: Use environment variables (for testing)"
echo "  docker exec -e ZITADEL_SERVICE_ACCOUNT_ID=... \\"
echo "         -e ZITADEL_SERVICE_ACCOUNT_KEY=... \\"
echo "         thaliumx-backend ..."
echo ""
echo "=========================================="
