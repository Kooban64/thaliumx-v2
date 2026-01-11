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

