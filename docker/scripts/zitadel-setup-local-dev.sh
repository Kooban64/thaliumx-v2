#!/usr/bin/env bash
set -euo pipefail

# Complete Zitadel Setup for Local Development
# This script helps set up Zitadel service account for local testing

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

ZITADEL_INTERNAL_URL="http://thaliumx-zitadel:8080"
ROOT_PASSWORD_FILE=".secrets/generated/zitadel-firstadmin-password"
ROOT_PASSWORD="$(cat "$ROOT_PASSWORD_FILE")"
ROOT_USERNAME="root@localhost"

echo "=========================================="
echo "Zitadel Local Development Setup"
echo "=========================================="
echo ""

# Step 1: Check Zitadel accessibility
echo "Step 1: Checking Zitadel accessibility..."
if curl -s -f "${ZITADEL_INTERNAL_URL}/.well-known/openid-configuration" > /dev/null 2>&1; then
  echo "✓ Zitadel is accessible at $ZITADEL_INTERNAL_URL"
else
  echo "⚠ Cannot access Zitadel directly (might be behind gateway)"
  echo "  This is OK - we'll configure for internal access"
fi

# Step 2: For local development, we need to create an OIDC application
# that supports both Client Credentials (for service account) and Password grant
echo ""
echo "Step 2: Setting up Zitadel for local development..."
echo ""
echo "Since Zitadel v2 requires proper OIDC client setup, we need to:"
echo "1. Create an OIDC application in Zitadel"
echo "2. Configure it to support Client Credentials and Password grants"
echo "3. Get the Client ID and Secret"
echo ""
echo "For now, let's create a temporary solution:"
echo ""

# Create a script that will help create the OIDC app via API
# But first, we need a personal access token from the root user

cat > /tmp/zitadel-create-oidc-app.sh <<'SCRIPT'
#!/bin/bash
# This script creates an OIDC application in Zitadel
# It requires a personal access token from the root user

ZITADEL_URL="${1:-http://thaliumx-zitadel:8080}"
PAT_TOKEN="${2:-}"

if [[ -z "$PAT_TOKEN" ]]; then
  echo "ERROR: Personal Access Token required"
  echo "Usage: $0 <zitadel-url> <personal-access-token>"
  echo ""
  echo "To get a PAT:"
  echo "1. Login to Zitadel console"
  echo "2. Go to Personal Settings > Personal Access Tokens"
  echo "3. Create a new PAT with Management API permissions"
  exit 1
fi

# Create OIDC application
echo "Creating OIDC application..."

# Note: This is a simplified example - actual API may vary
curl -X POST "${ZITADEL_URL}/management/v1/projects/default/applications/oidc" \
  -H "Authorization: Bearer ${PAT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "thaliumx-backend-local",
    "grantTypes": ["GRANT_TYPE_CLIENT_CREDENTIALS", "GRANT_TYPE_PASSWORD"],
    "responseTypes": ["RESPONSE_TYPE_TOKEN"],
    "authMethodType": "AUTH_METHOD_TYPE_BASIC"
  }' || echo "Failed to create OIDC app - may need to use console"

echo ""
echo "After creating the app, get the Client ID and Secret"
echo "and update the backend environment variables."
SCRIPT

chmod +x /tmp/zitadel-create-oidc-app.sh

echo "Created helper script at /tmp/zitadel-create-oidc-app.sh"
echo ""
echo "=========================================="
echo "Recommended Approach for Local Development"
echo "=========================================="
echo ""
echo "Since programmatic setup is complex, here's the easiest way:"
echo ""
echo "1. Access Zitadel Console:"
echo "   - If you have port forwarding: http://localhost:8080"
echo "   - Or via gateway if configured"
echo "   - Login: $ROOT_USERNAME"
echo "   - Password: $ROOT_PASSWORD"
echo ""
echo "2. Create OIDC Application:"
echo "   - Navigate to: Projects > Default Project > Applications"
echo "   - Click 'New Application' > 'OIDC'"
echo "   - Name: 'thaliumx-backend-local'"
echo "   - Grant Types: Enable 'Client Credentials' and 'Password'"
echo "   - Click 'Create'"
echo ""
echo "3. Generate Client Secret:"
echo "   - In the app details, click 'Generate Client Secret'"
echo "   - Copy the Client ID and Client Secret"
echo ""
echo "4. Update Backend Environment:"
echo "   Edit: docker/compose/prod-v1/applications.yml"
echo "   Set:"
echo "     ZITADEL_SERVICE_ACCOUNT_ID: <your-client-id>"
echo "     ZITADEL_SERVICE_ACCOUNT_KEY: <your-client-secret>"
echo "     ZITADEL_OIDC_CLIENT_ID: <same-client-id>"
echo "     ZITADEL_OIDC_CLIENT_SECRET: <same-client-secret>"
echo "     ZITADEL_ISSUER: http://thaliumx-zitadel:8080"
echo ""
echo "5. Restart Backend:"
echo "   docker restart thaliumx-backend"
echo ""
echo "=========================================="
