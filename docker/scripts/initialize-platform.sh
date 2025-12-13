#!/bin/bash

# ThaliumX Platform Initialization Script
# ======================================
# This script initializes the Keycloak realms and users for the ThaliumX platform
# including the platform realm and default tenant realm.

set -e

# Configuration
KEYCLOAK_URL="http://localhost:8080"
ADMIN_USER="admin"
ADMIN_PASSWORD="ThaliumX2025"
PLATFORM_REALM="thaliumx-platform"
DEFAULT_TENANT_REALM="thaliumx-default-tenant"
PLATFORM_DOMAIN="thaliumx.com"
DEFAULT_TENANT_DOMAIN="tenant.thaliumx.com"

echo "🚀 Initializing ThaliumX Platform..."

# Function to get admin token
get_admin_token() {
    local token=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "username=${ADMIN_USER}&password=${ADMIN_PASSWORD}&grant_type=password&client_id=admin-cli" \
        | jq -r '.access_token')

    if [ "$token" = "null" ] || [ -z "$token" ]; then
        echo "❌ Failed to get admin token"
        return 1
    fi

    echo "$token"
}

# Function to create realm
create_realm() {
    local realm_name=$1
    local display_name=$2
    local token=$3

    echo "Creating realm: $realm_name"

    curl -s -X POST "${KEYCLOAK_URL}/admin/realms" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "{
            \"realm\": \"$realm_name\",
            \"displayName\": \"$display_name\",
            \"enabled\": true,
            \"accessTokenLifespan\": 300,
            \"ssoSessionIdleTimeout\": 1800,
            \"ssoSessionMaxLifespan\": 36000,
            \"internationalizationEnabled\": true,
            \"supportedLocales\": [\"en\", \"es\", \"fr\", \"de\", \"zh\", \"ja\"],
            \"defaultLocale\": \"en\",
            \"passwordPolicy\": \"length(8) and digits(2) and lowerCase(2) and upperCase(2) and specialChars(1)\",
            \"attributes\": {
                \"platform.realm\": [\"true\"],
                \"platform.version\": [\"1.0.0\"]
            }
        }" || echo "Realm $realm_name may already exist"
}

# Function to create client
create_client() {
    local realm_name=$1
    local client_id=$2
    local client_name=$3
    local domain=$4
    local token=$5

    echo "Creating client: $client_id in realm $realm_name"

    curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${realm_name}/clients" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "{
            \"clientId\": \"$client_id\",
            \"name\": \"$client_name\",
            \"enabled\": true,
            \"clientAuthenticatorType\": \"client-secret\",
            \"secret\": \"$(openssl rand -base64 32)\",
            \"redirectUris\": [
                \"https://${domain}/*\",
                \"http://localhost:3000/*\",
                \"http://localhost:3001/*\"
            ],
            \"webOrigins\": [
                \"https://${domain}\",
                \"http://localhost:3000\",
                \"http://localhost:3001\"
            ],
            \"protocol\": \"openid-connect\",
            \"standardFlowEnabled\": true,
            \"directAccessGrantsEnabled\": true,
            \"serviceAccountsEnabled\": true,
            \"publicClient\": false,
            \"frontchannelLogout\": true
        }" || echo "Client $client_id may already exist"
}

# Function to create roles
create_roles() {
    local realm_name=$1
    local token=$2

    echo "Creating roles in realm: $realm_name"

    # Platform Admin Role
    curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${realm_name}/roles" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"platform-admin\",
            \"description\": \"Platform administrator with full access\",
            \"composite\": false,
            \"clientRole\": false
        }"

    # Broker Admin Role
    curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${realm_name}/roles" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"broker-admin\",
            \"description\": \"Broker administrator\",
            \"composite\": false,
            \"clientRole\": false
        }"

    # User Role
    curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${realm_name}/roles" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"user\",
            \"description\": \"Standard user\",
            \"composite\": false,
            \"clientRole\": false
        }"
}

# Function to create admin user
create_admin_user() {
    local realm_name=$1
    local username=$2
    local email=$3
    local first_name=$4
    local last_name=$5
    local token=$6

    echo "Creating admin user: $username in realm $realm_name"

    # Create user
    local user_response=$(curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${realm_name}/users" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "{
            \"username\": \"$username\",
            \"email\": \"$email\",
            \"firstName\": \"$first_name\",
            \"lastName\": \"$last_name\",
            \"enabled\": true,
            \"emailVerified\": true,
            \"attributes\": {
                \"tenantId\": [\"platform\"],
                \"kycLevel\": [\"ENTERPRISE\"],
                \"kycStatus\": [\"APPROVED\"]
            },
            \"credentials\": [{
                \"type\": \"password\",
                \"value\": \"AdminPass123!\",
                \"temporary\": false
            }]
        }")

    # Get user ID (this is a simplified approach - in production you'd parse the response)
    echo "Admin user created: $username"
}

# Wait for Keycloak to be ready
echo "⏳ Waiting for Keycloak to be ready..."
for i in {1..30}; do
    if curl -s "${KEYCLOAK_URL}/realms/master" > /dev/null; then
        echo "✅ Keycloak is ready"
        break
    fi
    echo "Waiting... ($i/30)"
    sleep 2
done

# Get admin token
echo "🔑 Getting admin token..."
ADMIN_TOKEN=$(get_admin_token)
if [ $? -ne 0 ]; then
    echo "❌ Failed to get admin token. Please check Keycloak configuration."
    exit 1
fi

echo "✅ Admin token obtained"

# Create Platform Realm
echo "🏗️ Creating Platform Realm..."
create_realm "$PLATFORM_REALM" "ThaliumX Platform" "$ADMIN_TOKEN"

# Create Platform Client
create_client "$PLATFORM_REALM" "thaliumx-platform-client" "ThaliumX Platform Client" "$PLATFORM_DOMAIN" "$ADMIN_TOKEN"

# Create Platform Roles
create_roles "$PLATFORM_REALM" "$ADMIN_TOKEN"

# Create Platform Admin User
create_admin_user "$PLATFORM_REALM" "platform-admin" "admin@thaliumx.com" "Platform" "Administrator" "$ADMIN_TOKEN"

# Create Default Tenant Realm
echo "🏗️ Creating Default Tenant Realm..."
create_realm "$DEFAULT_TENANT_REALM" "ThaliumX Default Tenant" "$ADMIN_TOKEN"

# Create Default Tenant Client
create_client "$DEFAULT_TENANT_REALM" "thaliumx-tenant-client" "ThaliumX Tenant Client" "$DEFAULT_TENANT_DOMAIN" "$ADMIN_TOKEN"

# Create Default Tenant Roles
create_roles "$DEFAULT_TENANT_REALM" "$ADMIN_TOKEN"

# Create Tenant Admin User
create_admin_user "$DEFAULT_TENANT_REALM" "tenant-admin" "admin@tenant.thaliumx.com" "Tenant" "Administrator" "$ADMIN_TOKEN"

echo "🎉 Platform initialization completed!"
echo ""
echo "📋 Summary:"
echo "   Platform Realm: $PLATFORM_REALM"
echo "   Default Tenant Realm: $DEFAULT_TENANT_REALM"
echo "   Platform Domain: $PLATFORM_DOMAIN"
echo "   Default Tenant Domain: $DEFAULT_TENANT_DOMAIN"
echo ""
echo "🔐 Admin Credentials:"
echo "   Platform Admin: platform-admin / AdminPass123!"
echo "   Tenant Admin: tenant-admin / AdminPass123!"
echo ""
echo "🌐 Access URLs:"
echo "   Platform Admin Console: ${KEYCLOAK_URL}/admin/${PLATFORM_REALM}/console"
echo "   Tenant Admin Console: ${KEYCLOAK_URL}/admin/${DEFAULT_TENANT_REALM}/console"