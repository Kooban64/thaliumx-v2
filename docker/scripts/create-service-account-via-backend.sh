#!/usr/bin/env bash
set -euo pipefail

# Create Zitadel service account using backend container
# This bypasses localhost/APISIX access issues

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

ZITADEL_URL="http://thaliumx-zitadel:8080"
PROJECT_ID="353322233650937880"
ROOT_USERNAME="root@localhost"
ROOT_PASSWORD="Aa1!30ad3716f234d05666ef744b178e"

echo "=========================================="
echo "Create Service Account via Backend Container"
echo "=========================================="
echo ""
echo "Since you can't access Zitadel from localhost/APISIX,"
echo "we'll use the backend container to access it directly."
echo ""

# Use backend container to access Zitadel Management API
echo "Step 1: Attempting to authenticate with root user..."
echo ""

# Try to get token using backend container
TOKEN_RESPONSE=$(docker exec thaliumx-backend curl -s -X POST "${ZITADEL_URL}/oauth/v2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=353322236855189528@zitadel" \
  -d "username=${ROOT_USERNAME}" \
  -d "password=${ROOT_PASSWORD}" \
  -d "scope=openid profile email urn:zitadel:iam:org:project:id:zitadel:aud" 2>&1)

if echo "$TOKEN_RESPONSE" | grep -q "access_token"; then
  ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)
  echo "✓ Successfully authenticated!"
  echo ""
  
  echo "Step 2: Creating service account..."
  SERVICE_ACCOUNT_RESPONSE=$(docker exec thaliumx-backend curl -s -X POST "${ZITADEL_URL}/management/v1/users/machine" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
      "userName": "thaliumx-backend-service",
      "name": "ThaliumX Backend Service Account",
      "description": "Service account for backend API authentication"
    }' 2>&1)
  
  if echo "$SERVICE_ACCOUNT_RESPONSE" | grep -q "userId"; then
    USER_ID=$(echo "$SERVICE_ACCOUNT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['userId'])" 2>/dev/null)
    echo "✓ Service account created! User ID: $USER_ID"
    echo ""
    
    echo "Step 3: Generating client secret..."
    SECRET_RESPONSE=$(docker exec thaliumx-backend curl -s -X POST "${ZITADEL_URL}/management/v1/users/machine/${USER_ID}/secret" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{"expirationDate": "2099-12-31T23:59:59Z"}' 2>&1)
    
    if echo "$SECRET_RESPONSE" | grep -q "clientId"; then
      CLIENT_ID=$(echo "$SECRET_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['clientId'])" 2>/dev/null)
      CLIENT_SECRET=$(echo "$SECRET_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['clientSecret'])" 2>/dev/null)
      
      echo "=========================================="
      echo "✓ Service Account Created Successfully!"
      echo "=========================================="
      echo "Client ID: $CLIENT_ID"
      echo "Client Secret: $CLIENT_SECRET"
      echo ""
      echo "Now creating OIDC app..."
      echo ""
      
      # Step 4: Create OIDC app
      docker exec thaliumx-backend python3 /app/docker/scripts/zitadel-bootstrap-complete.py \
        "$CLIENT_ID" \
        "$CLIENT_SECRET" \
        "$PROJECT_ID" 2>&1 || \
      docker exec thaliumx-backend node /app/docker/scripts/create-oidc-app-with-service-account.js \
        "$CLIENT_ID" \
        "$CLIENT_SECRET" \
        "$PROJECT_ID" 2>&1
      
    else
      echo "✗ Failed to generate client secret"
      echo "Response: $SECRET_RESPONSE"
    fi
  else
    echo "✗ Failed to create service account"
    echo "Response: $SERVICE_ACCOUNT_RESPONSE"
  fi
else
  echo "✗ Password grant not available"
  echo "Response: $TOKEN_RESPONSE"
  echo ""
  echo "Trying alternative: Use Python script from backend container..."
  echo ""
  
  # Try using Python script from backend
  docker exec thaliumx-backend python3 << 'PYTHON'
import requests
import sys

ZITADEL_URL = "http://thaliumx-zitadel:8080"
PROJECT_ID = "353322233650937880"

# Since password grant doesn't work, we need another method
# Let's provide instructions
print("=" * 60)
print("Alternative Solution")
print("=" * 60)
print()
print("Since password grant is not available, you have options:")
print()
print("1. Access Zitadel console via backend container port forwarding")
print("2. Use the backend container to create service account via API")
print("3. Create service account directly in database (advanced)")
print()
print("Let's try option 2: Create via Management API from backend...")
print()

# Check if we can access Management API
response = requests.get(f"{ZITADEL_URL}/management/v1/projects")
print(f"Management API access: {response.status_code}")
if response.status_code == 401:
    print("  Requires authentication")
    print()
    print("Since we can't authenticate programmatically,")
    print("we need to create the service account manually.")
    print()
    print("You can:")
    print("1. SSH into the server and access http://localhost:8080")
    print("2. Use port forwarding: ssh -L 8080:localhost:8080 user@server")
    print("3. Access via backend container's network")
PYTHON

fi
