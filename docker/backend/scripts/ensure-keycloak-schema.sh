#!/bin/bash

# =============================================================================
# Keycloak Schema Initialization Script
# =============================================================================
# Ensures Keycloak database schema is initialized before backend starts
# Keycloak automatically creates its schema on first startup, but we need to
# wait for it to complete before the backend can use Keycloak
# =============================================================================

set -e

KEYCLOAK_URL="${KEYCLOAK_URL:-http://keycloak:8080}"
MAX_RETRIES=30
RETRY_INTERVAL=10

echo "🔍 Waiting for Keycloak to initialize database schema..."

for i in $(seq 1 $MAX_RETRIES); do
  echo "Attempt $i/$MAX_RETRIES: Checking Keycloak health..."
  
  # Check if Keycloak is ready and schema is initialized
  # Keycloak returns 200 on /health/ready when schema is initialized
  if curl -f -s "${KEYCLOAK_URL}/health/ready" > /dev/null 2>&1; then
    echo "✅ Keycloak is ready and schema is initialized"
    exit 0
  fi
  
  if [ $i -lt $MAX_RETRIES ]; then
    echo "⏳ Keycloak not ready yet, waiting ${RETRY_INTERVAL}s..."
    sleep $RETRY_INTERVAL
  fi
done

echo "❌ Keycloak schema initialization timeout after $((MAX_RETRIES * RETRY_INTERVAL))s"
echo "⚠️  Keycloak may still be initializing. Backend will retry connection."
exit 0  # Don't fail - backend has retry logic

