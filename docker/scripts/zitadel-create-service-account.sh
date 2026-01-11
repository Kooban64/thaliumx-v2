#!/usr/bin/env bash
set -euo pipefail

# Creates a Zitadel service account (API application) for backend authentication
# Uses root user credentials to authenticate and create the service account
# Stores credentials in Vault

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

# Load root user password
FIRSTADMIN_PW_FILE=".secrets/generated/zitadel-firstadmin-password"
if [[ ! -f "$FIRSTADMIN_PW_FILE" ]]; then
  echo "ERROR: Root user password file not found: $FIRSTADMIN_PW_FILE"
  exit 1
fi
ROOT_PASSWORD="$(cat "$FIRSTADMIN_PW_FILE")"

# Zitadel configuration
ZITADEL_ISSUER="${ZITADEL_ISSUER:-https://auth.thaliumx.com}"
ZITADEL_INTERNAL_URL="http://thaliumx-zitadel:8080"
ROOT_USERNAME="root@${ZITADEL_ISSUER#https://}"

echo "Creating Zitadel service account..."
echo "Issuer: $ZITADEL_ISSUER"
echo "Root user: $ROOT_USERNAME"

# Step 1: Authenticate root user and get access token
echo "Step 1: Authenticating root user..."
ROOT_TOKEN_RESPONSE=$(curl -s -X POST "${ZITADEL_INTERNAL_URL}/oauth/v2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Host: ${ZITADEL_ISSUER#https://}" \
  -d "grant_type=password" \
  -d "client_id=353322236855189528@zitadel" \
  -d "username=${ROOT_USERNAME}" \
  -d "password=${ROOT_PASSWORD}" \
  -d "scope=openid profile email urn:zitadel:iam:org:project:id:zitadel:aud" || echo "")

if [[ -z "$ROOT_TOKEN_RESPONSE" ]] || echo "$ROOT_TOKEN_RESPONSE" | grep -q "error"; then
  echo "ERROR: Failed to authenticate root user"
  echo "Response: $ROOT_TOKEN_RESPONSE"
  exit 1
fi

ROOT_ACCESS_TOKEN=$(echo "$ROOT_TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
if [[ -z "$ROOT_ACCESS_TOKEN" ]]; then
  echo "ERROR: Could not extract access token from response"
  echo "Response: $ROOT_TOKEN_RESPONSE"
  exit 1
fi

echo "✓ Root user authenticated"

# Step 2: Get organization ID (needed for creating service user)
echo "Step 2: Getting organization ID..."
ORG_RESPONSE=$(curl -s -X GET "${ZITADEL_INTERNAL_URL}/management/v1/orgs/_search" \
  -H "Authorization: Bearer ${ROOT_ACCESS_TOKEN}" \
  -H "Host: ${ZITADEL_ISSUER#https://}" \
  -H "Content-Type: application/json" || echo "")

ORG_ID=$(echo "$ORG_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
if [[ -z "$ORG_ID" ]]; then
  echo "WARNING: Could not extract org ID, trying default..."
  # Try to get from instance
  INSTANCE_RESPONSE=$(curl -s -X GET "${ZITADEL_INTERNAL_URL}/management/v1/instances/_search" \
    -H "Authorization: Bearer ${ROOT_ACCESS_TOKEN}" \
    -H "Host: ${ZITADEL_ISSUER#https://}" \
    -H "Content-Type: application/json" || echo "")
  
  # For now, we'll proceed without org_id - Zitadel may use default org
  ORG_ID=""
fi

echo "✓ Organization ID: ${ORG_ID:-default}"

# Step 3: Get or create project
echo "Step 3: Getting or creating project..."
PROJECT_RESPONSE=$(curl -s -X GET "${ZITADEL_INTERNAL_URL}/management/v1/projects/_search" \
  -H "Authorization: Bearer ${ROOT_ACCESS_TOKEN}" \
  -H "Host: ${ZITADEL_ISSUER#https://}" \
  -H "Content-Type: application/json" || echo "")

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [[ -z "$PROJECT_ID" ]]; then
  echo "Creating new project..."
  PROJECT_CREATE_RESPONSE=$(curl -s -X POST "${ZITADEL_INTERNAL_URL}/management/v1/projects" \
    -H "Authorization: Bearer ${ROOT_ACCESS_TOKEN}" \
    -H "Host: ${ZITADEL_ISSUER#https://}" \
    -H "Content-Type: application/json" \
    -d '{"name":"ThaliumX Backend Service Account"}' || echo "")
  
  PROJECT_ID=$(echo "$PROJECT_CREATE_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
  
  if [[ -z "$PROJECT_ID" ]]; then
    echo "ERROR: Failed to create project"
    echo "Response: $PROJECT_CREATE_RESPONSE"
    exit 1
  fi
fi

echo "✓ Project ID: $PROJECT_ID"

# Step 4: Create service user
echo "Step 4: Creating service user..."
SERVICE_USER_NAME="thaliumx-backend-service"
SERVICE_USER_RESPONSE=$(curl -s -X POST "${ZITADEL_INTERNAL_URL}/management/v1/users/machine" \
  -H "Authorization: Bearer ${ROOT_ACCESS_TOKEN}" \
  -H "Host: ${ZITADEL_ISSUER#https://}" \
  -H "Content-Type: application/json" \
  -d "{\"userName\":\"${SERVICE_USER_NAME}\",\"name\":\"ThaliumX Backend Service Account\",\"description\":\"Service account for backend API authentication\"}" || echo "")

SERVICE_USER_ID=$(echo "$SERVICE_USER_RESPONSE" | grep -o '"userId":"[^"]*' | head -1 | cut -d'"' -f4)

if [[ -z "$SERVICE_USER_ID" ]]; then
  # Check if user already exists
  if echo "$SERVICE_USER_RESPONSE" | grep -q "already exists\|duplicate"; then
    echo "Service user already exists, searching for it..."
    USER_SEARCH_RESPONSE=$(curl -s -X GET "${ZITADEL_INTERNAL_URL}/management/v1/users/_search?queries=%5B%7B%22userNameQuery%22%3A%7B%22userName%22%3A%22${SERVICE_USER_NAME}%22%7D%7D%5D" \
      -H "Authorization: Bearer ${ROOT_ACCESS_TOKEN}" \
      -H "Host: ${ZITADEL_ISSUER#https://}" \
      -H "Content-Type: application/json" || echo "")
    
    SERVICE_USER_ID=$(echo "$USER_SEARCH_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
  fi
  
  if [[ -z "$SERVICE_USER_ID" ]]; then
    echo "ERROR: Failed to create or find service user"
    echo "Response: $SERVICE_USER_RESPONSE"
    exit 1
  fi
fi

echo "✓ Service user ID: $SERVICE_USER_ID"

# Step 5: Create API application (OAuth client) for the service user
echo "Step 5: Creating API application..."
APP_RESPONSE=$(curl -s -X POST "${ZITADEL_INTERNAL_URL}/management/v1/projects/${PROJECT_ID}/applications" \
  -H "Authorization: Bearer ${ROOT_ACCESS_TOKEN}" \
  -H "Host: ${ZITADEL_ISSUER#https://}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"${SERVICE_USER_NAME}\",\"appType\":\"API\"}" || echo "")

APP_ID=$(echo "$APP_RESPONSE" | grep -o '"appId":"[^"]*' | head -1 | cut -d'"' -f4)
CLIENT_ID=$(echo "$APP_RESPONSE" | grep -o '"clientId":"[^"]*' | head -1 | cut -d'"' -f4)

if [[ -z "$APP_ID" ]]; then
  # Check if app already exists
  if echo "$APP_RESPONSE" | grep -q "already exists\|duplicate"; then
    echo "API application already exists, searching for it..."
    APP_SEARCH_RESPONSE=$(curl -s -X GET "${ZITADEL_INTERNAL_URL}/management/v1/projects/${PROJECT_ID}/applications/_search" \
      -H "Authorization: Bearer ${ROOT_ACCESS_TOKEN}" \
      -H "Host: ${ZITADEL_ISSUER#https://}" \
      -H "Content-Type: application/json" || echo "")
    
    APP_ID=$(echo "$APP_SEARCH_RESPONSE" | grep -o '"appId":"[^"]*' | head -1 | cut -d'"' -f4)
    CLIENT_ID=$(echo "$APP_SEARCH_RESPONSE" | grep -o '"clientId":"[^"]*' | head -1 | cut -d'"' -f4)
  fi
  
  if [[ -z "$APP_ID" ]]; then
    echo "ERROR: Failed to create or find API application"
    echo "Response: $APP_RESPONSE"
    exit 1
  fi
fi

echo "✓ API application ID: $APP_ID"
echo "✓ Client ID: $CLIENT_ID"

# Step 6: Generate client secret
echo "Step 6: Generating client secret..."
SECRET_RESPONSE=$(curl -s -X POST "${ZITADEL_INTERNAL_URL}/management/v1/projects/${PROJECT_ID}/applications/${APP_ID}/secrets" \
  -H "Authorization: Bearer ${ROOT_ACCESS_TOKEN}" \
  -H "Host: ${ZITADEL_ISSUER#https://}" \
  -H "Content-Type: application/json" \
  -d '{"expirationDate":"2099-12-31T23:59:59Z"}' || echo "")

CLIENT_SECRET=$(echo "$SECRET_RESPONSE" | grep -o '"clientSecret":"[^"]*' | head -1 | cut -d'"' -f4)

if [[ -z "$CLIENT_SECRET" ]]; then
  echo "ERROR: Failed to generate client secret"
  echo "Response: $SECRET_RESPONSE"
  exit 1
fi

echo "✓ Client secret generated"

# Step 7: Grant manager role to service user (if org_id is available)
if [[ -n "$ORG_ID" ]]; then
  echo "Step 7: Granting manager role to service user..."
  GRANT_RESPONSE=$(curl -s -X POST "${ZITADEL_INTERNAL_URL}/management/v1/orgs/${ORG_ID}/members" \
    -H "Authorization: Bearer ${ROOT_ACCESS_TOKEN}" \
    -H "Host: ${ZITADEL_ISSUER#https://}" \
    -H "Content-Type: application/json" \
    -d "{\"userId\":\"${SERVICE_USER_ID}\",\"roles\":[\"ORG_OWNER\"]}" || echo "")
  
  if echo "$GRANT_RESPONSE" | grep -q "error\|already"; then
    echo "Note: Role grant response: $GRANT_RESPONSE"
  else
    echo "✓ Manager role granted"
  fi
fi

# Step 8: Store credentials in Vault
echo "Step 8: Storing credentials in Vault..."
VAULT_ADDR="${VAULT_ADDR:-http://thaliumx-vault:8200}"

# Check if Vault is accessible
if ! curl -s -f "${VAULT_ADDR}/v1/sys/health" > /dev/null 2>&1; then
  echo "WARNING: Vault is not accessible at ${VAULT_ADDR}"
  echo "Credentials will be stored in environment variables file instead"
  
  # Store in .env file for manual configuration
  ENV_FILE=".secrets/generated/zitadel-service-account.env"
  cat > "$ENV_FILE" <<EOF
# Zitadel Service Account Credentials (generated)
# Store these in Vault at: secret/thaliumx/zitadel
ZITADEL_SERVICE_ACCOUNT_ID=${CLIENT_ID}
ZITADEL_SERVICE_ACCOUNT_KEY=${CLIENT_SECRET}
ZITADEL_PROJECT_ID=${PROJECT_ID}
ZITADEL_ORG_ID=${ORG_ID}
EOF
  chmod 600 "$ENV_FILE"
  echo "✓ Credentials saved to: $ENV_FILE"
  echo ""
  echo "IMPORTANT: Store these credentials in Vault:"
  echo "  vault kv put secret/thaliumx/zitadel \\"
  echo "    service_account_id=\"${CLIENT_ID}\" \\"
  echo "    service_account_key=\"${CLIENT_SECRET}\" \\"
  echo "    project_id=\"${PROJECT_ID}\" \\"
  echo "    org_id=\"${ORG_ID}\""
else
  # Get Vault token from environment or use root token
  VAULT_TOKEN="${VAULT_TOKEN:-}"
  
  if [[ -z "$VAULT_TOKEN" ]]; then
    echo "WARNING: VAULT_TOKEN not set, cannot store in Vault"
    echo "Set VAULT_TOKEN environment variable to store credentials automatically"
    exit 0
  fi
  
  # Store in Vault
  VAULT_PAYLOAD=$(cat <<EOF
{
  "data": {
    "service_account_id": "${CLIENT_ID}",
    "service_account_key": "${CLIENT_SECRET}",
    "project_id": "${PROJECT_ID}",
    "org_id": "${ORG_ID}"
  }
}
EOF
)
  
  VAULT_RESPONSE=$(curl -s -X POST "${VAULT_ADDR}/v1/secret/data/thaliumx/zitadel" \
    -H "X-Vault-Token: ${VAULT_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$VAULT_PAYLOAD" || echo "")
  
  if echo "$VAULT_RESPONSE" | grep -q "errors"; then
    echo "ERROR: Failed to store credentials in Vault"
    echo "Response: $VAULT_RESPONSE"
    exit 1
  fi
  
  echo "✓ Credentials stored in Vault at: secret/thaliumx/zitadel"
fi

echo ""
echo "=========================================="
echo "Service Account Setup Complete!"
echo "=========================================="
echo "Client ID: ${CLIENT_ID}"
echo "Client Secret: ${CLIENT_SECRET:0:20}... (truncated)"
echo "Project ID: ${PROJECT_ID}"
echo "Org ID: ${ORG_ID:-default}"
echo ""
echo "Next steps:"
echo "1. Restart the backend container to load credentials from Vault"
echo "2. Test login flow"
echo "=========================================="
