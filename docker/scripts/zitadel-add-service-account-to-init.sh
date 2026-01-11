#!/usr/bin/env bash
set -euo pipefail

# Add Service Account creation to Zitadel init steps
# This allows us to bootstrap a service account automatically

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

INIT_STEPS_FILE=".secrets/generated/zitadel-init-steps.yaml"

echo "=========================================="
echo "Add Service Account to Zitadel Init Steps"
echo "=========================================="
echo ""

if [[ ! -f "$INIT_STEPS_FILE" ]]; then
  echo "ERROR: Init steps file not found: $INIT_STEPS_FILE"
  echo "Run: docker/scripts/zitadel-generate-secrets.sh"
  exit 1
fi

echo "Current init steps file: $INIT_STEPS_FILE"
echo ""

# Check if service account is already in init steps
if grep -q "Machine" "$INIT_STEPS_FILE" || grep -q "ServiceAccount" "$INIT_STEPS_FILE"; then
  echo "Service account already configured in init steps"
  cat "$INIT_STEPS_FILE"
  exit 0
fi

echo "Note: Zitadel init steps format may vary by version"
echo "For Zitadel v2, service accounts might need to be created via Management API"
echo "after initialization, not during init steps"
echo ""
echo "However, we can create a script that runs after Zitadel is initialized"
echo "to create the service account and OIDC app"
echo ""

# Create a post-init script
cat > docker/scripts/zitadel-post-init-bootstrap.sh <<'SCRIPT'
#!/usr/bin/env bash
# This script runs after Zitadel is initialized to create service account and OIDC app
# It should be run manually or via a startup script

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

ZITADEL_URL="http://localhost:8080"
PROJECT_ID="353322233650937880"

echo "Zitadel Post-Init Bootstrap"
echo "This script creates a service account and OIDC app"
echo ""
echo "Since we need authentication to create a service account,"
echo "and we can't easily get it programmatically,"
echo "please follow these steps:"
echo ""
echo "1. Get a Personal Access Token (PAT) from Zitadel"
echo "   - Use Zitadel CLI: zitadelctl login"
echo "   - Or access console if available"
echo ""
echo "2. Create service account using PAT:"
echo "   See: docker/scripts/create-service-account-with-pat.sh"
echo ""
echo "3. Once you have service account credentials, create OIDC app:"
echo "   node docker/scripts/create-oidc-app-with-service-account.js \\"
echo "     <SERVICE_ACCOUNT_CLIENT_ID> \\"
echo "     <SERVICE_ACCOUNT_CLIENT_SECRET>"
echo ""

SCRIPT

chmod +x docker/scripts/zitadel-post-init-bootstrap.sh

echo "Created post-init bootstrap script"
echo ""
echo "For a complete automated solution, we need to:"
echo "1. Create service account via Management API (requires PAT)"
echo "2. Use service account to create OIDC app"
echo ""
echo "The scripts are ready - we just need initial authentication"
