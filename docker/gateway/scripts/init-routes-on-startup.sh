#!/bin/bash
# =============================================================================
# APISIX Route Initialization - Startup Script
# =============================================================================
# This script runs after APISIX container starts to ensure routes are configured
# It can be called manually or via a cron job / systemd timer
# =============================================================================

set -e

# No insecure defaults; require admin key to be provided via env/secret manager.
APISIX_ADMIN_KEY="${APISIX_ADMIN_KEY:?APISIX_ADMIN_KEY is required}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INIT_SCRIPT="$SCRIPT_DIR/init-apisix-routes.sh"

# Wait for APISIX container to be ready
echo "Waiting for APISIX container to be ready..."
max_attempts=60
attempt=0

while [ $attempt -lt $max_attempts ]; do
  if docker exec thaliumx-apisix curl -s -f http://localhost:9180/apisix/admin/routes -H "X-API-KEY: ${APISIX_ADMIN_KEY}" > /dev/null 2>&1; then
    echo "APISIX is ready"
    break
  fi
  attempt=$((attempt + 1))
  echo "Attempt $attempt/$max_attempts: Waiting for APISIX..."
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo "Error: APISIX did not become ready in time"
  exit 1
fi

# Run the initialization script inside the container
echo "Initializing APISIX routes..."
docker exec thaliumx-apisix /usr/local/bin/init-apisix-routes.sh

echo "APISIX routes initialized successfully"
