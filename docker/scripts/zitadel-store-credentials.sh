#!/usr/bin/env bash
set -euo pipefail

# Stores Zitadel service account credentials in Vault
# Usage: ./zitadel-store-credentials.sh <CLIENT_ID> <CLIENT_SECRET> [PROJECT_ID] [ORG_ID]

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <CLIENT_ID> <CLIENT_SECRET> [PROJECT_ID] [ORG_ID]"
  echo ""
  echo "Example:"
  echo "  $0 '123456789@zitadel' 'your-secret-key' 'project-id' 'org-id'"
  exit 1
fi

CLIENT_ID="$1"
CLIENT_SECRET="$2"
PROJECT_ID="${3:-}"
ORG_ID="${4:-}"

VAULT_ADDR="${VAULT_ADDR:-http://thaliumx-vault:8200}"

echo "Storing Zitadel service account credentials in Vault..."
echo "Client ID: ${CLIENT_ID}"
echo "Project ID: ${PROJECT_ID:-not set}"
echo "Org ID: ${ORG_ID:-not set}"
echo ""

# Check if Vault is accessible
if ! curl -s -f "${VAULT_ADDR}/v1/sys/health" > /dev/null 2>&1; then
  echo "ERROR: Vault is not accessible at ${VAULT_ADDR}"
  echo "Please ensure Vault is running and accessible"
  exit 1
fi

# Get Vault token
VAULT_TOKEN="${VAULT_TOKEN:-}"
if [[ -z "$VAULT_TOKEN" ]]; then
  echo "ERROR: VAULT_TOKEN environment variable is not set"
  echo "Please set VAULT_TOKEN to store credentials in Vault"
  echo ""
  echo "Alternative: Store credentials in environment variables file"
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
  echo "To store in Vault later, run:"
  echo "  export VAULT_TOKEN=your-token"
  echo "  $0 '${CLIENT_ID}' '${CLIENT_SECRET}' '${PROJECT_ID}' '${ORG_ID}'"
  exit 0
fi

# Store in Vault
echo "Storing credentials in Vault..."
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
echo ""
echo "Next steps:"
echo "1. Restart the backend container to load credentials from Vault"
echo "2. Test login flow"
echo ""
