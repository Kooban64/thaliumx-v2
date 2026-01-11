#!/usr/bin/env bash
set -euo pipefail

# Create OIDC Application directly using Management API
# This script attempts to create an OIDC app by authenticating first

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

ZITADEL_URL="http://localhost:8080"
ROOT_USERNAME="root@localhost"
ROOT_PASSWORD="$(cat .secrets/generated/zitadel-firstadmin-password)"

echo "Creating OIDC Application in Zitadel..."
echo ""

# Get instance and project IDs
INSTANCE_ID=$(docker exec thaliumx-zitadel-postgres psql -U root -d zitadel -t -c "SELECT instance_id FROM projections.apps6 LIMIT 1;" 2>/dev/null | tr -d ' \n' || echo "")
PROJECT_ID=$(docker exec thaliumx-zitadel-postgres psql -U root -d zitadel -t -c "SELECT project_id FROM projections.apps6 LIMIT 1;" 2>/dev/null | tr -d ' \n' || echo "")

if [[ -z "$INSTANCE_ID" || -z "$PROJECT_ID" ]]; then
  echo "ERROR: Could not determine instance or project ID"
  echo "Zitadel might not be fully initialized"
  exit 1
fi

echo "Instance ID: $INSTANCE_ID"
echo "Project ID: $PROJECT_ID"
echo ""

# For Zitadel v2, we need a Personal Access Token (PAT) to use Management API
# To get a PAT, we typically need to use the console or CLI
# Since we can't access the console, let's try to create a service account first
# or use an alternative method

echo "Since Zitadel v2 requires a PAT for Management API access,"
echo "and we cannot easily get one without the console,"
echo "let's provide you with the exact curl command to run manually:"
echo ""
echo "=========================================="
echo "Manual Creation Steps"
echo "=========================================="
echo ""
echo "1. First, get a Personal Access Token:"
echo "   - You'll need to access the console (fix redirect URI issue first)"
echo "   - Or use Zitadel CLI if available"
echo ""
echo "2. Once you have a PAT, create the OIDC app:"
echo ""
echo "curl -X POST '${ZITADEL_URL}/management/v1/projects/${PROJECT_ID}/applications/oidc' \\"
echo "  -H 'Authorization: Bearer <YOUR_PAT_TOKEN>' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{"
echo "    \"name\": \"thaliumx-backend-local\","
echo "    \"grantTypes\": [\"GRANT_TYPE_PASSWORD\", \"GRANT_TYPE_CLIENT_CREDENTIALS\"],"
echo "    \"responseTypes\": [\"RESPONSE_TYPE_TOKEN\"],"
echo "    \"authMethodType\": \"AUTH_METHOD_TYPE_BASIC\","
echo "    \"accessTokenType\": \"ACCESS_TOKEN_TYPE_BEARER\","
echo "    \"devMode\": true"
echo "  }'"
echo ""
echo "3. After creation, get the client ID and secret from the response"
echo "4. Update backend environment variables"
echo ""
echo "=========================================="
echo ""
echo "Alternative: Try to fix console redirect URI issue first"
echo "Then use the console to create the OIDC app"
echo ""
