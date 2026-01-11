#!/usr/bin/env bash
set -euo pipefail

# Create OIDC Application in Zitadel for Backend
# This script creates an OIDC app with password grant enabled

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

ZITADEL_URL="http://localhost:8080"
ROOT_USERNAME="root@localhost"
ROOT_PASSWORD="$(cat .secrets/generated/zitadel-firstadmin-password)"

echo "=========================================="
echo "Creating Zitadel OIDC Application"
echo "=========================================="
echo ""

# For Zitadel v2, we need to use the Management API
# But first we need a personal access token
# Since we can't easily get one programmatically, we'll provide instructions

echo "Since Zitadel v2 requires proper authentication for the Management API,"
echo "and the console requires OIDC login (which needs a configured client),"
echo "we need to use one of these approaches:"
echo ""
echo "Option 1: Use Zitadel CLI (if available)"
echo "  zitadelctl login --instance localhost:8080"
echo "  zitadelctl app oidc create --name thaliumx-backend-local \\"
echo "    --grant-types password,client_credentials \\"
echo "    --response-types token"
echo ""
echo "Option 2: Create via Database (Advanced - not recommended)"
echo "  This requires understanding Zitadel's event sourcing model"
echo ""
echo "Option 3: Fix Console Client and Use UI (Recommended)"
echo "  Update the console client to allow HTTP redirects"
echo ""

# Let's try to update the console client's redirect URI to allow HTTP
echo "Attempting to find and update console client configuration..."
echo ""

# Check if we can find the console client
CONSOLE_CLIENT=$(docker exec thaliumx-zitadel-postgres psql -U root -d zitadel -t -c "SELECT client_id FROM projections.apps6_oidc_configs WHERE client_id LIKE '%353322236922298392%' LIMIT 1;" 2>&1 | tr -d ' \n')

if [[ -n "$CONSOLE_CLIENT" ]]; then
  echo "Found console client: $CONSOLE_CLIENT"
  echo ""
  echo "To fix the console access issue, we need to update the redirect URI"
  echo "to allow HTTP. However, this requires using the Management API"
  echo "or modifying the event store directly (not recommended)."
  echo ""
  echo "For now, let's create a simple OIDC app using a workaround:"
  echo ""
fi

# Since we can't easily create via API without authentication,
# let's create a script that can be run manually or via a different method
cat > /tmp/zitadel-create-app-manual.sh <<'SCRIPT'
#!/bin/bash
# Manual script to create OIDC app in Zitadel
# This can be run after getting a PAT or using the console

# You can also try using curl with a PAT:
# curl -X POST "http://localhost:8080/management/v1/projects/{project_id}/applications/oidc" \
#   -H "Authorization: Bearer <PAT_TOKEN>" \
#   -H "Content-Type: application/json" \
#   -d '{
#     "name": "thaliumx-backend-local",
#     "grantTypes": ["GRANT_TYPE_PASSWORD", "GRANT_TYPE_CLIENT_CREDENTIALS"],
#     "responseTypes": ["RESPONSE_TYPE_TOKEN"],
#     "authMethodType": "AUTH_METHOD_TYPE_BASIC"
#   }'

echo "See docker/scripts/ZITADEL_LOCAL_SETUP.md for manual steps"
SCRIPT

chmod +x /tmp/zitadel-create-app-manual.sh

echo "Created helper script at /tmp/zitadel-create-app-manual.sh"
echo ""
echo "=========================================="
echo "Recommended Solution"
echo "=========================================="
echo ""
echo "Since programmatic creation is complex, the easiest approach is:"
echo ""
echo "1. Temporarily allow HTTP redirects for the console client"
echo "2. Access the console via browser"
echo "3. Create the OIDC application"
echo "4. Get the client ID and secret"
echo ""
echo "Let's try to update the console client configuration..."
echo ""

# Try to find the console app and see if we can update it
# But since projections are read-only, we'd need to use the event store
# which is complex. Let's provide a workaround instead.

echo "Actually, let's use a simpler workaround:"
echo "We'll create a basic OIDC app configuration that you can"
echo "import or use as a template."
echo ""

# Create a JSON template for the OIDC app
cat > /tmp/zitadel-oidc-app-template.json <<'JSON'
{
  "name": "thaliumx-backend-local",
  "grantTypes": [
    "GRANT_TYPE_PASSWORD",
    "GRANT_TYPE_CLIENT_CREDENTIALS"
  ],
  "responseTypes": [
    "RESPONSE_TYPE_TOKEN"
  ],
  "authMethodType": "AUTH_METHOD_TYPE_BASIC",
  "accessTokenType": "ACCESS_TOKEN_TYPE_BEARER",
  "devMode": true
}
JSON

echo "Created OIDC app template at /tmp/zitadel-oidc-app-template.json"
echo ""
echo "For now, the best approach is to:"
echo "1. Use the Zitadel CLI if available"
echo "2. Or manually create via console after fixing redirect URI"
echo "3. Or use the Management API with a PAT"
echo ""
echo "See docker/scripts/ZITADEL_LOCAL_SETUP.md for detailed instructions"
