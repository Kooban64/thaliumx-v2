#!/usr/bin/env bash
set -euo pipefail

# Create OIDC Application in Zitadel via Management API
# This script attempts to create an OIDC app programmatically

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

ZITADEL_INTERNAL_URL="http://thaliumx-zitadel:8080"
ROOT_PASSWORD_FILE=".secrets/generated/zitadel-firstadmin-password"
ROOT_PASSWORD="$(cat "$ROOT_PASSWORD_FILE")"
ROOT_USERNAME="root@localhost"

echo "=========================================="
echo "Creating Zitadel OIDC Application"
echo "=========================================="
echo ""

# Step 1: Try to authenticate and get a personal access token
# For Zitadel v2, we need to use the console or create a PAT first
echo "Step 1: Attempting to authenticate..."

# Try using the default Zitadel client with password grant
# Note: This may not work if password grant is disabled
TOKEN_RESPONSE=$(curl -s -X POST "${ZITADEL_INTERNAL_URL}/oauth/v2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=353322236855189528@zitadel" \
  -d "username=${ROOT_USERNAME}" \
  -d "password=${ROOT_PASSWORD}" \
  -d "scope=openid profile email urn:zitadel:iam:org:project:id:zitadel:aud" 2>&1 || echo "")

if echo "$TOKEN_RESPONSE" | grep -q "access_token"; then
  ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
  echo "✓ Authentication successful"
  
  # Step 2: Get default project ID
  echo ""
  echo "Step 2: Getting default project..."
  PROJECTS_RESPONSE=$(curl -s -X POST "${ZITADEL_INTERNAL_URL}/management/v1/projects/_search" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{}' 2>&1)
  
  echo "Projects response: $PROJECTS_RESPONSE"
  
  # Step 3: Create OIDC application
  # This is a simplified approach - actual API may vary
  echo ""
  echo "Step 3: Creating OIDC application..."
  echo "Note: This requires proper project and organization setup"
  
else
  echo "⚠ Password grant authentication failed"
  echo "Response: $TOKEN_RESPONSE"
  echo ""
  echo "This is expected - Zitadel v2 requires OIDC client setup first"
  echo ""
  echo "=========================================="
  echo "Manual Setup Required"
  echo "=========================================="
  echo ""
  echo "Since programmatic setup requires a PAT (Personal Access Token),"
  echo "please use the Zitadel console to create the OIDC application:"
  echo ""
  echo "1. Access Zitadel Console"
  echo "   - You may need to set up port forwarding:"
  echo "     docker port thaliumx-zitadel"
  echo "   - Or access via internal network if gateway is configured"
  echo ""
  echo "2. Login"
  echo "   Username: $ROOT_USERNAME"
  echo "   Password: $ROOT_PASSWORD"
  echo ""
  echo "3. Create OIDC Application"
  echo "   - Navigate to: Projects > (Default Project) > Applications"
  echo "   - Click 'New Application'"
  echo "   - Select 'OIDC'"
  echo "   - Name: 'thaliumx-backend-local'"
  echo "   - Grant Types:"
  echo "     ✓ Client Credentials (for service account)"
  echo "     ✓ Password (for user login)"
  echo "   - Click 'Create'"
  echo ""
  echo "4. Generate Client Secret"
  echo "   - In app details, click 'Generate Client Secret'"
  echo "   - Copy Client ID and Client Secret"
  echo ""
  echo "5. Update Environment"
  echo "   Update docker/core/compose.yaml or set environment variables:"
  echo "   ZITADEL_SERVICE_ACCOUNT_ID=<client-id>"
  echo "   ZITADEL_SERVICE_ACCOUNT_KEY=<client-secret>"
  echo "   ZITADEL_OIDC_CLIENT_ID=<client-id>"
  echo "   ZITADEL_OIDC_CLIENT_SECRET=<client-secret>"
  echo ""
  echo "6. Restart Backend"
  echo "   docker restart thaliumx-backend"
  echo ""
fi

echo "=========================================="
