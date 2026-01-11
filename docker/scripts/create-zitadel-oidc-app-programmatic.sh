#!/usr/bin/env bash
set -euo pipefail

# Create OIDC Application in Zitadel Programmatically
# This script creates a service account first, then uses it to create the OIDC app

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

ZITADEL_URL="http://localhost:8080"
ROOT_USERNAME="root@localhost"
ROOT_PASSWORD="$(cat .secrets/generated/zitadel-firstadmin-password)"

# Get instance and project IDs
INSTANCE_ID=$(docker exec thaliumx-zitadel-postgres psql -U root -d zitadel -t -c "SELECT instance_id FROM projections.apps6 LIMIT 1;" 2>/dev/null | tr -d ' \n' || echo "353322233650741272")
PROJECT_ID=$(docker exec thaliumx-zitadel-postgres psql -U root -d zitadel -t -c "SELECT project_id FROM projections.apps6 LIMIT 1;" 2>/dev/null | tr -d ' \n' || echo "353322233650937880")

echo "=========================================="
echo "Creating Zitadel OIDC App Programmatically"
echo "=========================================="
echo "Zitadel URL: $ZITADEL_URL"
echo "Instance ID: $INSTANCE_ID"
echo "Project ID: $PROJECT_ID"
echo ""

# Step 1: Check if we can use an existing service account or need to create one
echo "Step 1: Checking for existing service accounts..."

# Try to find existing service accounts in the database
EXISTING_SERVICE_ACCOUNT=$(docker exec thaliumx-zitadel-postgres psql -U root -d zitadel -t -c "SELECT client_id FROM projections.apps6_oidc_configs WHERE client_id LIKE '%@zitadel' AND client_id != '353322236922298392@zitadel' LIMIT 1;" 2>/dev/null | tr -d ' \n' || echo "")

if [[ -n "$EXISTING_SERVICE_ACCOUNT" ]]; then
  echo "Found existing service account: $EXISTING_SERVICE_ACCOUNT"
  echo "We'll need the client secret to use it."
  echo ""
  echo "For now, let's create a new service account via Management API"
  echo "But first, we need to authenticate..."
  echo ""
fi

# Step 2: Try to authenticate and create a service account
echo "Step 2: Attempting to create service account..."

# For Zitadel v2, we need to use the Management API
# But to use Management API, we need a service account
# This is a chicken-and-egg problem, but we can try to use the root user

# Option 1: Try to create a service account using root user credentials
# This might work if Zitadel allows it via a special endpoint

echo "Trying to authenticate with root user to create service account..."
echo ""

# Try to get a token using root user (might not work, but worth trying)
ROOT_TOKEN_RESPONSE=$(curl -s -X POST "${ZITADEL_URL}/oauth/v2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=353322236855189528@zitadel" \
  -d "username=${ROOT_USERNAME}" \
  -d "password=${ROOT_PASSWORD}" \
  -d "scope=openid profile email urn:zitadel:iam:org:project:id:zitadel:aud" 2>&1 || echo "")

if echo "$ROOT_TOKEN_RESPONSE" | grep -q "access_token"; then
  ROOT_ACCESS_TOKEN=$(echo "$ROOT_TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
  echo "✓ Successfully authenticated with root user"
  echo "Access Token: ${ROOT_ACCESS_TOKEN:0:20}..."
  echo ""
  
  # Step 3: Create service account using root token
  echo "Step 3: Creating service account..."
  
  SERVICE_ACCOUNT_NAME="thaliumx-backend-service-$(date +%s)"
  
  # Create service account via Management API
  # Note: The exact endpoint and payload might vary for Zitadel v2
  SERVICE_ACCOUNT_RESPONSE=$(curl -s -X POST "${ZITADEL_URL}/management/v1/users/machine" \
    -H "Authorization: Bearer ${ROOT_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"userName\": \"${SERVICE_ACCOUNT_NAME}\",
      \"name\": \"ThaliumX Backend Service Account\",
      \"description\": \"Service account for backend API authentication\"
    }" 2>&1 || echo "")
  
  echo "Service account creation response: $SERVICE_ACCOUNT_RESPONSE"
  
  # If service account created, we need to generate client secret
  # This might require additional API calls
  
else
  echo "⚠ Password grant not available for root user"
  echo "Response: $ROOT_TOKEN_RESPONSE"
  echo ""
  echo "Trying alternative approach: Create service account via database or init..."
  echo ""
fi

# Step 4: Alternative - Try to create OIDC app directly if we have any way to authenticate
echo "Step 4: Trying alternative approaches..."
echo ""

# Since we can't easily get a token, let's provide a complete script
# that can be run once we have a service account

cat > /tmp/create-oidc-app-with-service-account.sh <<'SCRIPT'
#!/bin/bash
# Complete script to create OIDC app using a service account

ZITADEL_URL="${1:-http://localhost:8080}"
SERVICE_ACCOUNT_CLIENT_ID="${2:-}"
SERVICE_ACCOUNT_CLIENT_SECRET="${3:-}"
PROJECT_ID="${4:-353322233650937880}"

if [[ -z "$SERVICE_ACCOUNT_CLIENT_ID" || -z "$SERVICE_ACCOUNT_CLIENT_SECRET" ]]; then
  echo "ERROR: Service account credentials required"
  echo "Usage: $0 <zitadel_url> <client_id> <client_secret> [project_id]"
  exit 1
fi

echo "Step 1: Getting access token using service account..."
ACCESS_TOKEN_RESPONSE=$(curl -s -X POST "${ZITADEL_URL}/oauth/v2/token" \
  -u "${SERVICE_ACCOUNT_CLIENT_ID}:${SERVICE_ACCOUNT_CLIENT_SECRET}" \
  -d "grant_type=client_credentials" \
  -d "scope=urn:zitadel:iam:org:project:id:zitadel:management")

ACCESS_TOKEN=$(echo "$ACCESS_TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [[ -z "$ACCESS_TOKEN" ]]; then
  echo "ERROR: Failed to get access token"
  echo "Response: $ACCESS_TOKEN_RESPONSE"
  exit 1
fi

echo "✓ Got access token"
echo ""

echo "Step 2: Creating OIDC application..."
OIDC_APP_RESPONSE=$(curl -s -X POST "${ZITADEL_URL}/management/v1/projects/${PROJECT_ID}/apps/oidc" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "appName": "thaliumx-backend-local",
    "redirectUris": ["http://localhost:3000/callback"],
    "responseTypes": ["TOKEN"],
    "grantTypes": ["PASSWORD", "CLIENT_CREDENTIALS"],
    "authMethodType": "CLIENT_SECRET_BASIC",
    "accessTokenType": "ACCESS_TOKEN_TYPE_BEARER",
    "devMode": true
  }')

echo "OIDC App Creation Response:"
echo "$OIDC_APP_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$OIDC_APP_RESPONSE"

# Extract client ID and secret
CLIENT_ID=$(echo "$OIDC_APP_RESPONSE" | grep -o '"clientId":"[^"]*' | cut -d'"' -f4 || echo "")
CLIENT_SECRET=$(echo "$OIDC_APP_RESPONSE" | grep -o '"clientSecret":"[^"]*' | cut -d'"' -f4 || echo "")

if [[ -n "$CLIENT_ID" && -n "$CLIENT_SECRET" ]]; then
  echo ""
  echo "=========================================="
  echo "✓ OIDC App Created Successfully!"
  echo "=========================================="
  echo "Client ID: $CLIENT_ID"
  echo "Client Secret: $CLIENT_SECRET"
  echo ""
  echo "Update your backend environment:"
  echo "  ZITADEL_SERVICE_ACCOUNT_ID=$CLIENT_ID"
  echo "  ZITADEL_SERVICE_ACCOUNT_KEY=$CLIENT_SECRET"
  echo "  ZITADEL_OIDC_CLIENT_ID=$CLIENT_ID"
  echo "  ZITADEL_OIDC_CLIENT_SECRET=$CLIENT_SECRET"
else
  echo ""
  echo "⚠ Could not extract client credentials from response"
  echo "Please check the response above and extract manually"
fi
SCRIPT

chmod +x /tmp/create-oidc-app-with-service-account.sh

echo "Created helper script: /tmp/create-oidc-app-with-service-account.sh"
echo ""
echo "=========================================="
echo "Next Steps"
echo "=========================================="
echo ""
echo "Since we need a service account first, here are the options:"
echo ""
echo "Option 1: Create service account via Management API (if we can authenticate)"
echo "Option 2: Use Zitadel CLI to create service account"
echo "Option 3: Create service account manually via console (if accessible)"
echo ""
echo "Once you have a service account (client ID + secret), run:"
echo "  /tmp/create-oidc-app-with-service-account.sh \\"
echo "    http://localhost:8080 \\"
echo "    <SERVICE_ACCOUNT_CLIENT_ID> \\"
echo "    <SERVICE_ACCOUNT_CLIENT_SECRET> \\"
echo "    $PROJECT_ID"
echo ""
