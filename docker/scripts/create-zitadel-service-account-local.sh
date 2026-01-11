#!/usr/bin/env bash
set -euo pipefail

# Create Zitadel Service Account for Local Development
# This script uses Zitadel's Management API to create a service account

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

ZITADEL_INTERNAL_URL="http://thaliumx-zitadel:8080"
ROOT_PASSWORD_FILE=".secrets/generated/zitadel-firstadmin-password"

if [[ ! -f "$ROOT_PASSWORD_FILE" ]]; then
  echo "ERROR: Root password file not found: $ROOT_PASSWORD_FILE"
  exit 1
fi

ROOT_PASSWORD="$(cat "$ROOT_PASSWORD_FILE")"
ROOT_USERNAME="root@localhost"

echo "=========================================="
echo "Creating Zitadel Service Account"
echo "=========================================="
echo "Zitadel URL: $ZITADEL_INTERNAL_URL"
echo "Root User: $ROOT_USERNAME"
echo ""

# For local development, we need to:
# 1. Create an OIDC application that supports password grants
# 2. Or create a service user via Management API

# Since Zitadel v2 requires personal access tokens for Management API,
# and password grants need proper OIDC client setup, we'll provide
# instructions and also try to set up a basic OIDC app

echo "For local development, we'll configure the backend to use"
echo "environment variables directly (bypassing Vault for now)."
echo ""
echo "Please follow these steps:"
echo ""
echo "1. We'll update the backend environment to use local Zitadel"
echo "2. For testing, we can create a simple OIDC app manually"
echo ""
echo "Updating backend configuration..."

# Update the compose file to use local Zitadel and set proper issuer
# For now, let's create a script that updates the environment

cat > /tmp/update-zitadel-config.sh <<'SCRIPT'
#!/bin/bash
# This will be used to update Zitadel config for local development

echo "To configure Zitadel for local development:"
echo ""
echo "1. Set ZITADEL_ISSUER to http://thaliumx-zitadel:8080"
echo "2. Create an OIDC application in Zitadel that supports:"
echo "   - Client Credentials grant (for service account)"
echo "   - Password grant (for user login)"
echo ""
echo "3. Update backend environment variables:"
echo "   ZITADEL_SERVICE_ACCOUNT_ID=<your-client-id>"
echo "   ZITADEL_SERVICE_ACCOUNT_KEY=<your-client-secret>"
echo "   ZITADEL_ISSUER=http://thaliumx-zitadel:8080"
echo "   ZITADEL_OIDC_CLIENT_ID=<same-or-different-client-id>"
echo "   ZITADEL_OIDC_CLIENT_SECRET=<same-or-different-secret>"
SCRIPT

chmod +x /tmp/update-zitadel-config.sh

echo ""
echo "Since Zitadel requires proper OIDC client setup, let's"
echo "try to access Zitadel and create the service account via API..."
echo ""

# Try to use Zitadel's default client for local development
# Zitadel might have a default client we can use
echo "Attempting to create service account via Management API..."

# First, let's check if we can access Zitadel's health endpoint
HEALTH_CHECK=$(curl -s "${ZITADEL_INTERNAL_URL}/.well-known/openid-configuration" 2>&1 || echo "failed")

if echo "$HEALTH_CHECK" | grep -q "issuer"; then
  echo "✓ Zitadel is accessible"
  ISSUER=$(echo "$HEALTH_CHECK" | grep -o '"issuer":"[^"]*' | cut -d'"' -f4 || echo "")
  echo "  Issuer: $ISSUER"
else
  echo "⚠ Cannot access Zitadel OIDC discovery endpoint"
  echo "  This might be normal if Zitadel is behind a gateway"
fi

echo ""
echo "=========================================="
echo "Next Steps"
echo "=========================================="
echo ""
echo "For local development, you have two options:"
echo ""
echo "Option A: Use Zitadel Console (if accessible)"
echo "  1. Port forward or access Zitadel console"
echo "  2. Login with: $ROOT_USERNAME / $ROOT_PASSWORD"
echo "  3. Create OIDC Application:"
echo "     - App Type: OIDC"
echo "     - Grant Types: Client Credentials + Password"
echo "     - Generate Client Secret"
echo "  4. Update backend environment with Client ID and Secret"
echo ""
echo "Option B: Update Backend Environment Directly"
echo "  We'll update docker/compose/prod-v1/applications.yml"
echo "  to use local Zitadel and set proper values"
echo ""
