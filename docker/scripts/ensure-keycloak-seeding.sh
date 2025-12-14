#!/bin/bash
# =============================================================================
# Keycloak Seeding Verification Script
# =============================================================================
# This script verifies that Keycloak realms and users are properly seeded
# It can be run manually or as part of startup to ensure persistence
# =============================================================================

set -e

KEYCLOAK_URL="${KEYCLOAK_URL:-http://thaliumx-keycloak:8080}"
KEYCLOAK_ADMIN="${KEYCLOAK_ADMIN:-admin}"
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-sAV9qJNRKCOIR7Mbhhoc4SZ9}"

echo "=== Keycloak Seeding Verification ==="
echo "Keycloak URL: $KEYCLOAK_URL"
echo ""

# Wait for Keycloak to be ready
echo "Waiting for Keycloak to be ready..."
max_attempts=60
attempt=0

while [ $attempt -lt $max_attempts ]; do
  if curl -s -f "$KEYCLOAK_URL/health/ready" > /dev/null 2>&1; then
    echo "Keycloak is ready"
    break
  fi
  attempt=$((attempt + 1))
  echo "Attempt $attempt/$max_attempts: Waiting for Keycloak..."
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo "Error: Keycloak did not become ready in time"
  exit 1
fi

# Get admin token
echo "Authenticating with Keycloak..."
TOKEN=$(curl -s -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$KEYCLOAK_ADMIN" \
  -d "password=$KEYCLOAK_ADMIN_PASSWORD" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" | jq -r '.access_token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Error: Failed to authenticate with Keycloak"
  exit 1
fi

echo "✅ Authenticated successfully"
echo ""

# Check platform realm
echo "Checking platform realm..."
PLATFORM_REALM=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/platform" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq -r '.realm // empty')

if [ -z "$PLATFORM_REALM" ]; then
  echo "⚠️  Platform realm not found - backend will create it on startup"
else
  echo "✅ Platform realm exists"
  
  # Check platform users
  PLATFORM_USERS=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/platform/users" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" | jq '. | length')
  
  echo "  Platform users: $PLATFORM_USERS"
fi

echo ""

# Check platform-default-tenant realm
echo "Checking platform-default-tenant realm..."
TENANT_REALM=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/platform-default-tenant" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq -r '.realm // empty')

if [ -z "$TENANT_REALM" ]; then
  echo "⚠️  Platform-default-tenant realm not found - backend will create it on startup"
else
  echo "✅ Platform-default-tenant realm exists"
  
  # Check tenant users
  TENANT_USERS=$(curl -s -X GET "$KEYCLOAK_URL/admin/realms/platform-default-tenant/users" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" | jq '. | length')
  
  echo "  Tenant users: $TENANT_USERS"
fi

echo ""
echo "=== Verification Complete ==="
echo ""
echo "Note: If realms or users are missing, the backend service will automatically"
echo "      create and seed them on startup. This script is for verification only."

