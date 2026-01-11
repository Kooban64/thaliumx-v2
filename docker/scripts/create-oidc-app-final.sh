#!/usr/bin/env bash
set -euo pipefail

# Final attempt to create OIDC app - using a workaround
# Since we can't easily access the console or use Management API without PAT,
# we'll create a simple script that can be executed once we have access

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

INSTANCE_ID="353322233650741272"
PROJECT_ID="353322233650937880"
ZITADEL_URL="http://localhost:8080"

echo "=========================================="
echo "Zitadel OIDC App Creation"
echo "=========================================="
echo ""
echo "Since we cannot easily create the OIDC app programmatically"
echo "without a Personal Access Token, here's what we'll do:"
echo ""
echo "We'll create a temporary OIDC app with test credentials"
echo "that you can use for local development."
echo ""

# For now, let's create a simple configuration that can be used
# We'll set up the backend to use placeholder values that you can
# replace once you create the actual OIDC app

cat > /tmp/zitadel-oidc-app-config.json <<EOF
{
  "name": "thaliumx-backend-local",
  "projectId": "${PROJECT_ID}",
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
EOF

echo "Created OIDC app configuration template"
echo ""
echo "To create the app, you need to:"
echo ""
echo "1. Get a Personal Access Token (PAT) from Zitadel"
echo "   - This requires accessing the console"
echo "   - Or using Zitadel CLI: zitadelctl login"
echo ""
echo "2. Use this curl command (replace <PAT_TOKEN>):"
echo ""
echo "curl -X POST '${ZITADEL_URL}/management/v1/projects/${PROJECT_ID}/applications/oidc' \\"
echo "  -H 'Authorization: Bearer <PAT_TOKEN>' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d @/tmp/zitadel-oidc-app-config.json"
echo ""
echo "3. From the response, extract:"
echo "   - clientId"
echo "   - clientSecret (if generated)"
echo ""
echo "4. Update backend environment:"
echo "   ZITADEL_SERVICE_ACCOUNT_ID=<clientId>"
echo "   ZITADEL_SERVICE_ACCOUNT_KEY=<clientSecret>"
echo "   ZITADEL_OIDC_CLIENT_ID=<clientId>"
echo "   ZITADEL_OIDC_CLIENT_SECRET=<clientSecret>"
echo ""
echo "=========================================="
echo ""
echo "For now, let's set up the backend with placeholder values"
echo "that will show clear error messages when Zitadel is not configured"
echo ""
