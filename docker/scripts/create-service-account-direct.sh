#!/usr/bin/env bash
set -euo pipefail

# Create service account directly using Management API
# This script tries to create a service account without CLI

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

ZITADEL_URL="http://localhost:8080"
PROJECT_ID="353322233650937880"

echo "Creating service account via Management API..."
echo ""

# Since we can't easily authenticate without a service account or PAT,
# let's try to use the root user with a different approach
# Or create the OIDC app directly if we can find a way

# Actually, let's try to create a service account using the event store
# or see if we can use a default service account

echo "Trying alternative approach: Create OIDC app directly..."
echo ""

# Check if there's a default service account we can use
echo "Checking for existing service accounts or default clients..."

# Try to find any OIDC clients that might work
EXISTING_CLIENTS=$(docker exec thaliumx-zitadel-postgres psql -U root -d zitadel -t -c "SELECT client_id FROM projections.apps6_oidc_configs LIMIT 5;" 2>/dev/null | tr -d ' \n' || echo "")

if [[ -n "$EXISTING_CLIENTS" ]]; then
  echo "Found existing clients, but we need a service account with management permissions"
  echo ""
fi

echo "Since we need authentication to create a service account,"
echo "and we can't easily get it programmatically,"
echo "let's try using the Management API with a workaround..."
echo ""

# Try to create service account using root user if possible
# This might not work, but worth trying

ROOT_PASSWORD=$(cat .secrets/generated/zitadel-firstadmin-password)

# Try different authentication methods
echo "Attempting to authenticate and create service account..."
echo ""

# Since direct API calls require authentication, and we can't get it easily,
# let's provide a script that can be run once we have credentials

cat > /tmp/create-service-account-with-auth.sh <<'SCRIPT'
#!/bin/bash
# Create service account using provided authentication

ZITADEL_URL="${1:-http://localhost:8080}"
AUTH_TOKEN="${2:-}"

if [[ -z "$AUTH_TOKEN" ]]; then
  echo "ERROR: Authentication token required"
  echo "Usage: $0 <zitadel_url> <auth_token>"
  exit 1
fi

echo "Creating service account..."
SERVICE_ACCOUNT_RESPONSE=$(curl -s -X POST "${ZITADEL_URL}/management/v1/users/machine" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "userName": "thaliumx-backend-service",
    "name": "ThaliumX Backend Service Account",
    "description": "Service account for backend API authentication"
  }')

echo "$SERVICE_ACCOUNT_RESPONSE" | python3 -m json.tool

USER_ID=$(echo "$SERVICE_ACCOUNT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('userId', ''))" 2>/dev/null || echo "")

if [[ -n "$USER_ID" ]]; then
  echo ""
  echo "Service account created! User ID: $USER_ID"
  echo ""
  echo "Now generate client secret:"
  echo "curl -X POST '${ZITADEL_URL}/management/v1/users/machine/${USER_ID}/secret' \\"
  echo "  -H 'Authorization: Bearer ${AUTH_TOKEN}' \\"
  echo "  -H 'Content-Type: application/json' \\"
  echo "  -d '{\"expirationDate\": \"2099-12-31T23:59:59Z\"}'"
fi
SCRIPT

chmod +x /tmp/create-service-account-with-auth.sh

echo "Created helper script: /tmp/create-service-account-with-auth.sh"
echo ""
echo "For now, the best approach is to:"
echo "1. Use Zitadel CLI (if we can get it working)"
echo "2. Or access the console and create service account manually"
echo "3. Or use the Management API with a PAT"
echo ""
