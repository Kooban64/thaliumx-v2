#!/bin/bash
# =============================================================================
# Authentik Initialization Script for ThaliumX
# =============================================================================
# This script initializes Authentik with the required configuration:
#   - Creates admin user
#   - Creates Outpost "ThaliumX"
#   - Creates Applications: thaliumx-backend, thaliumx-frontend, 
#     thaliumx-workflows, thaliumx-backoffice, thaliumx-apisix
#   - Creates Property Mappings for user_id, roles, tenant_id
#   - Generates client secrets
#
# Usage:
#   ./init-authentik.sh [--wait-for-api] [--create-admin] [--create-applications]
#                       [--create-property-mappings] [--create-outpost]
#                       [--all]
#
# Environment Variables:
#   AUTHENTIK_URL        - Authentik API URL (default: http://localhost:9000)
#   AUTHENTIK_TOKEN      - Authentik API token with admin privileges
#   ADMIN_EMAIL          - Admin email (default: admin@thaliumx.com)
#   ADMIN_PASSWORD       - Admin password (default: from secrets file or generated)
#   THALIUMX_DOMAIN      - ThaliumX domain (default: thaliumx.com)
#   INITIAL_ADMIN_PASSWORD_FILE - Path to file containing initial admin password

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================
AUTHENTIK_URL="${AUTHENTIK_URL:-http://localhost:9000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@thaliumx.com}"
THALIUMX_DOMAIN="${THALIUMX_DOMAIN:-thaliumx.com}"
THALIUMX_BACKEND_URL="https://api.${THALIUMX_DOMAIN}"
THALIUMX_FRONTEND_URL="https://app.${THALIUMX_DOMAIN}"
THALIUMX_WORKFLOWS_URL="https://workflows.${THALIUMX_DOMAIN}"
THALIUMX_BACKOFFICE_URL="https://backoffice.${THALIUMX_DOMAIN}"
THALIUMX_APISIX_URL="https://gateway.${THALIUMX_DOMAIN}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# =============================================================================
# Helper Functions
# =============================================================================
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required environment variables are set
check_environment() {
    if [[ -z "${AUTHENTIK_TOKEN:-}" ]]; then
        # Try to read from file if not set
        if [[ -f "/run/secrets/authentik-api-token" ]]; then
            export AUTHENTIK_TOKEN=$(cat /run/secrets/authentik-api-token)
        elif [[ -f "./secrets/authentik-api-token.txt" ]]; then
            export AUTHENTIK_TOKEN=$(cat ./secrets/authentik-api-token.txt)
        else
            log_error "AUTHENTIK_TOKEN environment variable is not set"
            return 1
        fi
    fi
    
    # Get initial admin password if specified
    if [[ -n "${INITIAL_ADMIN_PASSWORD_FILE:-}" ]]; then
        if [[ -f "$INITIAL_ADMIN_PASSWORD_FILE" ]]; then
            export INITIAL_ADMIN_PASSWORD=$(cat "$INITIAL_ADMIN_PASSWORD_FILE")
        fi
    fi
    
    # Fall back to environment variable or generate one
    if [[ -z "${INITIAL_ADMIN_PASSWORD:-}" ]]; then
        if [[ -f "./secrets/authentik-initial-admin-password.txt" ]]; then
            export INITIAL_ADMIN_PASSWORD=$(cat ./secrets/authentik-initial-admin-password.txt)
        fi
    fi
}

# Wait for Authentik API to be ready
wait_for_api() {
    local max_attempts=${1:-60}
    local attempt=1
    
    log_info "Waiting for Authentik API to be ready..."
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -s -o /dev/null -w "%{http_code}" \
            -H "Authorization: Bearer ${AUTHENTIK_TOKEN}" \
            "${AUTHENTIK_URL}/api/v1/core/user/" 2>/dev/null | grep -q "200\|401"; then
            log_info "Authentik API is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    log_error "Authentik API did not become ready in time"
    return 1
}

# Make authenticated API request
authentik_api_request() {
    local method="${1:-GET}"
    local endpoint="$2"
    local data="${3:-}"
    
    local curl_args=(
        -s -w "\n%{http_code}"
        -X "$method"
        -H "Authorization: Bearer ${AUTHENTIK_TOKEN}"
        -H "Content-Type: application/json"
        -H "Accept: application/json"
    )
    
    if [[ -n "$data" ]]; then
        curl_args+=(-d "$data")
    fi
    
    curl "${curl_args[@]}" "${AUTHENTIK_URL}${endpoint}"
}

# Check if resource exists
resource_exists() {
    local endpoint="$1"
    local response=$(authentik_api_request GET "$endpoint" 2>/dev/null)
    local http_code=$(echo "$response" | tail -n1)
    
    [[ "$http_code" == "200" ]]
}

# Generate a secure random string
generate_secret() {
    openssl rand -hex 32
}

# =============================================================================
# Create Admin User / Bootstrap Initial Admin
# =============================================================================
create_admin_user() {
    log_info "Checking for admin user..."
    
    # First, try to get current users to see if admin exists
    local response=$(authentik_api_request GET "/api/v1/core/users/")
    local http_code=$(echo "$response" | tail -n1)
    
    if [[ "$http_code" == "200" ]]; then
        if echo "$response" | grep -q '"username":"admin"'; then
            log_info "Admin user already exists"
            return 0
        fi
    fi
    
    # If admin doesn't exist and we have initial password, bootstrap it
    if [[ -n "${INITIAL_ADMIN_PASSWORD:-}" ]]; then
        log_info "Bootstrapping initial admin user..."
        
        local bootstrap_data=$(cat <<EOF
{
    "username": "admin",
    "email": "${ADMIN_EMAIL}",
    "password": "${INITIAL_ADMIN_PASSWORD}",
    "name": "ThaliumX Administrator",
    "is_active": true,
    "is_superuser": true
}
EOF)
        
        local response=$(authentik_api_request POST "/api/v1/core/users/" "$bootstrap_data")
        local http_code=$(echo "$response" | tail -n1)
        
        if [[ "$http_code" == "201" ]]; then
            log_info "Admin user created successfully"
        else
            log_warn "Admin user creation response: $response"
        fi
    else
        log_warn "INITIAL_ADMIN_PASSWORD not set - skipping admin creation"
        log_info "Use the Authentik UI to create the initial admin user"
    fi
}

# =============================================================================
# Create ThaliumX Group (Realm)
# =============================================================================
create_thaliumx_group() {
    log_info "Creating ThaliumX group (realm)..."
    
    local group_name="ThaliumX"
    
    # Check if group already exists
    if resource_exists "/api/v1/core/groups/?name=${group_name}"; then
        log_info "Group '${group_name}' already exists"
        return 0
    fi
    
    local group_data=$(cat <<EOF
{
    "name": "${group_name}",
    "slug": "thaliumx",
    "description": "ThaliumX Platform Users - Primary realm for all ThaliumX services",
    "is_superuser": false,
    "parent": null
}
EOF)
    
    local response=$(authentik_api_request POST "/api/v1/core/groups/" "$group_data")
    local http_code=$(echo "$response" | tail -n1)
    
    if [[ "$http_code" == "201" ]]; then
        log_info "Created group (realm): ${group_name}"
        
        # Create sub-groups for different roles
        local subgroups=("Admins" "Operators" "Developers" "Auditors" "Traders")
        for subgroup in "${subgroups[@]}"; do
            create_subgroup "$group_name" "$subgroup"
        done
    else
        log_warn "Failed to create group '${group_name}': $response"
    fi
}

# Create a subgroup under ThaliumX
create_subgroup() {
    local parent_name="$1"
    local subgroup_name="$2"
    local slug=$(echo "$subgroup_name" | tr '[:upper:]' '[:lower:]')
    
    # Get parent group pk
    local parent_response=$(authentik_api_request GET "/api/v1/core/groups/?name=${parent_name}")
    local parent_pk=$(echo "$parent_response" | grep -oP '"pk":\s*"\K[^"]+' | head -1)
    
    if [[ -z "$parent_pk" ]]; then
        log_warn "Could not find parent group: ${parent_name}"
        return 1
    fi
    
    # Check if subgroup already exists
    if resource_exists "/api/v1/core/groups/?name=${subgroup_name}"; then
        log_info "Subgroup '${subgroup_name}' already exists"
        return 0
    fi
    
    local subgroup_data=$(cat <<EOF
{
    "name": "${subgroup_name}",
    "slug": "${slug}",
    "description": "${subgroup_name} group under ${parent_name}",
    "is_superuser": false,
    "parent": "${parent_pk}"
}
EOF)
    
    local response=$(authentik_api_request POST "/api/v1/core/groups/" "$subgroup_data")
    local http_code=$(echo "$response" | tail -n1)
    
    if [[ "$http_code" == "201" ]]; then
        log_info "Created subgroup: ${subgroup_name} under ${parent_name}"
    else
        log_warn "Failed to create subgroup '${subgroup_name}': $response"
    fi
}

# =============================================================================
# Create Property Mappings
# =============================================================================
create_property_mappings() {
    log_info "Creating property mappings..."
    
    local mappings=(
        # User ID mapping
        '{
            "name": "ThaliumX: User ID",
            "expression": "return str(user.pk)",
            "mapping_type": "property-mapping"
        }'
        
        # Roles mapping
        '{
            "name": "ThaliumX: Roles",
            "expression": "import json\n\n# Get user groups\ngroups = list(user.group.all().values_list('name', flat=True))\n\n# Build roles list\nroles = []\nfor group in groups:\n    roles.append(group)\n\n# Add superuser role if applicable\nif user.is_superuser:\n    roles.append(\"admin\")\n    roles.append(\"superuser\")\n\nreturn json.dumps(roles)",
            "mapping_type": "property-mapping"
        }'
        
        # Tenant ID mapping (custom attribute)
        '{
            "name": "ThaliumX: Tenant ID",
            "expression": "return user.attributes.get(\"tenant_id\", \"default\")",
            "mapping_type": "property-mapping"
        }'
        
        # Email mapping
        '{
            "name": "ThaliumX: Email",
            "expression": "return user.email",
            "mapping_type": "property-mapping"
        }'
        
        # Username mapping
        '{
            "name": "ThaliumX: Username",
            "expression": "return user.username",
            "mapping_type": "property-mapping"
        }'
    )
    
    local mappings_created=0
    
    for mapping_json in "${mappings[@]}"; do
        local name=$(echo "$mapping_json" | grep -o '"name": "[^"]*"' | head -1 | cut -d'"' -f4)
        
        # Check if mapping already exists
        if resource_exists "/api/v1/core/property-mappings/?search=${name}"; then
            log_info "Property mapping '${name}' already exists"
            continue
        fi
        
        local response=$(authentik_api_request POST "/api/v1/core/property-mappings/" "$mapping_json")
        local http_code=$(echo "$response" | tail -n1)
        
        if [[ "$http_code" == "201" ]]; then
            log_info "Created property mapping: ${name}"
            mappings_created=$((mappings_created + 1))
        else
            log_warn "Failed to create property mapping '${name}': $response"
        fi
    done
    
    log_info "Created ${mappings_created} property mappings"
}

# Get property mapping by name
get_property_mapping_pk() {
    local name="$1"
    local response=$(authentik_api_request GET "/api/v1/core/property-mappings/?search=${name}")
    
    echo "$response" | grep -oP '"pk":\s*"\K[^"]+' | head -1
}

# =============================================================================
# Create OAuth2 Provider and Applications
# =============================================================================
create_applications() {
    log_info "Creating applications..."
    
    local applications=(
        # thaliumx-backend
        '{
            "name": "ThaliumX Backend API",
            "slug": "thaliumx-backend",
            "description": "ThaliumX Backend API - Core trading and ledger services",
            "provider": "oauth2",
            "launch_url": "'${THALIUMX_BACKEND_URL}'",
            "policyengine_mode": "all"
        }'
        
        # thaliumx-frontend
        '{
            "name": "ThaliumX Frontend",
            "slug": "thaliumx-frontend",
            "description": "ThaliumX Frontend Web Application",
            "provider": "oauth2",
            "launch_url": "'${THALIUMX_FRONTEND_URL}'",
            "policyengine_mode": "all"
        }'
        
        # thaliumx-workflows
        '{
            "name": "ThaliumX Workflows",
            "slug": "thaliumx-workflows",
            "description": "ThaliumX Workflow Engine",
            "provider": "oauth2",
            "launch_url": "'${THALIUMX_WORKFLOWS_URL}'",
            "policyengine_mode": "all"
        }'
        
        # thaliumx-backoffice
        '{
            "name": "ThaliumX Backoffice",
            "slug": "thaliumx-backoffice",
            "description": "ThaliumX Backoffice Administration",
            "provider": "oauth2",
            "launch_url": "'${THALIUMX_BACKOFFICE_URL}'",
            "policyengine_mode": "all"
        }'
        
        # thaliumx-apisix
        '{
            "name": "ThaliumX API Gateway",
            "slug": "thaliumx-apisix",
            "description": "ThaliumX API Gateway (APISIX)",
            "provider": "oauth2",
            "launch_url": "'${THALIUMX_APISIX_URL}'",
            "policyengine_mode": "all"
        }'
    )
    
    local apps_created=0
    
    for app_json in "${applications[@]}"; do
        local slug=$(echo "$app_json" | grep -o '"slug": "[^"]*"' | head -1 | cut -d'"' -f4)
        
        # Check if application already exists
        if resource_exists "/api/v1/core/applications/?slug=${slug}"; then
            log_info "Application '${slug}' already exists, creating provider..."
            create_oauth2_provider "$slug"
            continue
        fi
        
        # Create the application first
        local response=$(authentik_api_request POST "/api/v1/core/applications/" "$app_json")
        local http_code=$(echo "$response" | tail -n1)
        
        if [[ "$http_code" == "201" ]]; then
            log_info "Created application: ${slug}"
            apps_created=$((apps_created + 1))
            
            # Now create the OAuth2 provider for this application
            create_oauth2_provider "$slug"
        else
            log_warn "Failed to create application '${slug}': $response"
        fi
    done
    
    log_info "Created ${apps_created} applications"
}

# Create OAuth2 Provider for an application
create_oauth2_provider() {
    local app_slug="$1"
    local client_secret=$(generate_secret)
    
    # Get the application pk
    local app_response=$(authentik_api_request GET "/api/v1/core/applications/?slug=${app_slug}")
    local app_pk=$(echo "$app_response" | grep -oP '"pk":\s*"\K[^"]+' | head -1)
    
    if [[ -z "$app_pk" ]]; then
        log_warn "Could not find application: ${app_slug}"
        return 1
    fi
    
    # Check if provider already exists
    if resource_exists "/api/v1/provider/oauth2/?application=${app_pk}"; then
        log_info "OAuth2 provider for '${app_slug}' already exists"
        return 0
    fi
    
    local redirect_uris=""
    case "$app_slug" in
        "thaliumx-backend")
            redirect_uris="${THALIUMX_BACKEND_URL}/auth/callback,${THALIUMX_BACKEND_URL}/oauth/callback"
            ;;
        "thaliumx-frontend")
            redirect_uris="${THALIUMX_FRONTEND_URL}/callback,${THALIUMX_FRONTEND_URL}/auth/callback,http://localhost:3000/callback"
            ;;
        "thaliumx-workflows")
            redirect_uris="${THALIUMX_WORKFLOWS_URL}/callback,http://localhost:8081/callback"
            ;;
        "thaliumx-backoffice")
            redirect_uris="${THALIUMX_BACKOFFICE_URL}/callback,http://localhost:3001/callback"
            ;;
        "thaliumx-apisix")
            redirect_uris="${THALIUMX_APISIX_URL}/oauth/callback,${THALIUMX_APISIX_URL}/_oauth/callback"
            ;;
    esac
    
    # Get property mapping pks
    local user_id_mapping=$(get_property_mapping_pk "ThaliumX: User ID")
    local roles_mapping=$(get_property_mapping_pk "ThaliumX: Roles")
    local tenant_id_mapping=$(get_property_mapping_pk "ThaliumX: Tenant ID")
    
    local property_mappings="[]"
    if [[ -n "$user_id_mapping" ]] || [[ -n "$roles_mapping" ]] || [[ -n "$tenant_id_mapping" ]]; then
        property_mappings="["
        [[ -n "$user_id_mapping" ]] && property_mappings+="\"${user_id_mapping}\""
        [[ -n "$roles_mapping" ]] && [[ -n "$user_id_mapping" ]] && property_mappings+=","
        [[ -n "$roles_mapping" ]] && property_mappings+="\"${roles_mapping}\""
        [[ -n "$tenant_id_mapping" ]] && [[ -n "$roles_mapping" || -n "$user_id_mapping" ]] && property_mappings+=","
        [[ -n "$tenant_id_mapping" ]] && property_mappings+="\"${tenant_id_mapping}\""
        property_mappings+="]"
    fi
    
    local provider_data=$(cat <<EOF
{
    "name": "ThaliumX ${app_slug} OAuth2 Provider",
    "application": "${app_pk}",
    "client_id": "${app_slug}",
    "client_secret": "${client_secret}",
    "client_type": "confidential",
    "redirect_uris": "${redirect_uris}",
    "grant_types": ["authorization_code", "refresh_token", "client_credentials"],
    "response_types": ["code"],
    "signing_key": null,
    "property_mappings": ${property_mappings},
    "token_endpoint_auth_method": "client_secret_basic",
    "access_token_validity": 3600,
    "refresh_token_validity": 604800,
    "include_claims_in_id_token": true,
    "verify_audiences": false
}
EOF)
    
    local response=$(authentik_api_request POST "/api/v1/provider/oauth2/" "$provider_data")
    local http_code=$(echo "$response" | tail -n1)
    
    if [[ "$http_code" == "201" ]]; then
        log_info "Created OAuth2 provider for: ${app_slug}"
        
        # Save client secret to file
        local secret_file="./secrets/${app_slug}-client-secret.txt"
        mkdir -p ./secrets
        echo "$client_secret" > "$secret_file"
        log_info "Client secret saved to: ${secret_file}"
        
        # Also output for Vault
        echo ""
        echo "=============================================="
        echo "CLIENT SECRET FOR ${app_slug}"
        echo "=============================================="
        echo "$client_secret"
        echo "=============================================="
    else
        log_warn "Failed to create OAuth2 provider for '${app_slug}': $response"
    fi
}

# =============================================================================
# Create Outpost
# =============================================================================
create_outpost() {
    log_info "Creating ThaliumX Outpost..."
    
    local outpost_name="ThaliumX"
    
    # Check if outpost already exists
    if resource_exists "/api/v1/outposts/instances/?name=${outpost_name}"; then
        log_info "Outpost '${outpost_name}' already exists"
        return 0
    fi
    
    # Get default authentik provider pk (for embedded outpost)
    local provider_response=$(authentik_api_request GET "/api/v1/provider/oauth2/?limit=1")
    local provider_pk=$(echo "$provider_response" | grep -oP '"pk":\s*"\K[^"]+' | head -1)
    
    local outpost_data=$(cat <<EOF
{
    "name": "${outpost_name}",
    "type": "proxy",
    "fk": "${provider_pk:-}",
    "config": {
        "auth": "authentik",
        "authentik_host": "${AUTHENTIK_URL}",
        "ssl_verification": true
    },
    "managed": "none"
}
EOF)
    
    local response=$(authentik_api_request POST "/api/v1/outposts/instances/" "$outpost_data")
    local http_code=$(echo "$response" | tail -n1)
    
    if [[ "$http_code" == "201" ]]; then
        log_info "Created outpost: ${outpost_name}"
    else
        log_warn "Failed to create outpost: $response"
    fi
}

# =============================================================================
# Create Flow for Authentication
# ============================================================================="
create_authentication_flow() {
    log_info "Setting up authentication flow..."
    
    local flow_slug="thaliumx-authentication"
    
    # Check if flow already exists
    if resource_exists "/api/v1/flow/instances/?slug=${flow_slug}"; then
        log_info "Authentication flow already exists"
        return 0
    fi
    
    local flow_data=$(cat <<EOF
{
    "name": "ThaliumX Authentication",
    "slug": "${flow_slug}",
    "title": "ThaliumX Authentication",
    "designation": "authentication",
    "layout": "stacked",
    "stages": []
}
EOF)
    
    local response=$(authentik_api_request POST "/api/v1/flow/instances/" "$flow_data")
    local http_code=$(echo "$response" | tail -n1)
    
    if [[ "$http_code" == "201" ]]; then
        log_info "Created authentication flow: ${flow_slug}"
    else
        log_warn "Failed to create authentication flow: $response"
    fi
}

# =============================================================================
# Main Function
# =============================================================================
main() {
    local do_wait=false
    local do_create_admin=false
    local do_create_mappings=false
    local do_create_apps=false
    local do_create_outpost=false
    local do_create_group=false
    local do_all=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --wait-for-api)
                do_wait=true
                shift
                ;;
            --create-admin)
                do_create_admin=true
                shift
                ;;
            --create-property-mappings)
                do_create_mappings=true
                shift
                ;;
            --create-applications)
                do_create_apps=true
                shift
                ;;
            --create-outpost)
                do_create_outpost=true
                shift
                ;;
            --create-group)
                do_create_group=true
                shift
                ;;
            --all)
                do_all=true
                shift
                ;;
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 [--wait-for-api] [--create-admin] [--create-applications] [--create-property-mappings] [--create-outpost] [--create-group] [--all]"
                exit 1
                ;;
        esac
    done
    
    # If --all is specified, enable all options
    if [[ "$do_all" == true ]]; then
        do_wait=true
        do_create_admin=true
        do_create_mappings=true
        do_create_apps=true
        do_create_outpost=true
        do_create_group=true
    fi
    
    # Default: do everything if no options specified
    if [[ "$do_wait" == false ]] && [[ "$do_create_admin" == false ]] && \
       [[ "$do_create_mappings" == false ]] && [[ "$do_create_apps" == false ]] && \
       [[ "$do_create_outpost" == false ]] && [[ "$do_create_group" == false ]]; then
        do_wait=true
        do_create_admin=true
        do_create_mappings=true
        do_create_apps=true
        do_create_outpost=true
        do_create_group=true
    fi
    
    # Check environment
    check_environment
    
    # Wait for API if requested
    if [[ "$do_wait" == true ]]; then
        wait_for_api || exit 1
    fi
    
    # Execute requested operations
    if [[ "$do_create_group" == true ]]; then
        create_thaliumx_group
    fi
    
    if [[ "$do_create_admin" == true ]]; then
        create_admin_user
    fi
    
    if [[ "$do_create_mappings" == true ]]; then
        create_property_mappings
    fi
    
    if [[ "$do_create_apps" == true ]]; then
        create_applications
    fi
    
    if [[ "$do_create_outpost" == true ]]; then
        create_outpost
    fi
    
    log_info "Authentik initialization complete!"
}

# Run main function
main "$@"
