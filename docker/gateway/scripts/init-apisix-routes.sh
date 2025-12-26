#!/bin/bash
# =============================================================================
# APISIX Route Initialization Script
# =============================================================================
# This script ensures APISIX routes are configured for:
# - thaliumx.com (52.54.125.124) - Main landing page
# - thal.thaliumx.com (52.54.125.124) - Token presale page (direct to /token-presale)
# 
# This script runs on container startup to ensure persistence across rebuilds/restarts
# =============================================================================

set -e

APISIX_ADMIN_URL="${APISIX_ADMIN_URL:-http://localhost:9180/apisix/admin}"
# NOTE: No insecure defaults. Provide via environment (or CI secret) at deploy time.
APISIX_ADMIN_KEY="${APISIX_ADMIN_KEY:?APISIX_ADMIN_KEY is required}"
FRONTEND_UPSTREAM="${FRONTEND_UPSTREAM:-thaliumx-frontend:3000}"
BACKEND_UPSTREAM="${BACKEND_UPSTREAM:-thaliumx-backend:3002}"
KEYCLOAK_UPSTREAM="${KEYCLOAK_UPSTREAM:-thaliumx-keycloak:8443}"

# Keycloak OIDC (Keycloak-authoritative auth enforced at APISIX)
KEYCLOAK_REALM="${KEYCLOAK_REALM:-thaliumx-default-tenant}"
OIDC_CLIENT_ID="${OIDC_CLIENT_ID:-thaliumx-frontend}"
OIDC_DISCOVERY="${OIDC_DISCOVERY:-https://${KEYCLOAK_UPSTREAM}/auth/realms/${KEYCLOAK_REALM}/.well-known/openid-configuration}"
# NOTE: set to true once APISIX trusts the internal CA for Keycloak.
OIDC_SSL_VERIFY="${OIDC_SSL_VERIFY:-false}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== APISIX Route Initialization ===${NC}"
echo "Admin URL: $APISIX_ADMIN_URL"
echo "Frontend: $FRONTEND_UPSTREAM"
echo "Backend: $BACKEND_UPSTREAM"
echo "Keycloak: $KEYCLOAK_UPSTREAM"
echo "OIDC Discovery: $OIDC_DISCOVERY"
echo ""

# Wait for APISIX to be ready
echo -e "${YELLOW}Waiting for APISIX to be ready...${NC}"
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
  if curl -s -f "$APISIX_ADMIN_URL/routes" -H "X-API-KEY: $APISIX_ADMIN_KEY" > /dev/null 2>&1; then
    echo -e "${GREEN}APISIX is ready${NC}"
    break
  fi
  attempt=$((attempt + 1))
  echo "Attempt $attempt/$max_attempts: Waiting for APISIX..."
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo -e "${RED}Error: APISIX did not become ready in time${NC}"
  exit 1
fi

# Function to create or update an SSL object (SNI certificate)
create_ssl() {
    local ssl_id=$1
    local ssl_data=$2

    echo -e "${YELLOW}Creating/Updating SSL $ssl_id...${NC}"

    response=$(curl -s -w "\n%{http_code}" -X PUT "$APISIX_ADMIN_URL/ssl/$ssl_id" \
        -H "X-API-KEY: $APISIX_ADMIN_KEY" \
        -H "Content-Type: application/json" \
        -d "$ssl_data")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}  ✅ SSL $ssl_id configured successfully${NC}"
    else
        echo -e "${RED}  ❌ Failed to configure SSL $ssl_id (HTTP $http_code)${NC}"
        echo "  Response: $body"
        return 1
    fi
}

# Function to create or update a route
create_route() {
    local route_id=$1
    local route_data=$2
    
    echo -e "${YELLOW}Creating/Updating route $route_id...${NC}"
    
    response=$(curl -s -w "\n%{http_code}" -X PUT "$APISIX_ADMIN_URL/routes/$route_id" \
        -H "X-API-KEY: $APISIX_ADMIN_KEY" \
        -H "Content-Type: application/json" \
        -d "$route_data")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}  ✅ Route $route_id configured successfully${NC}"
    else
        echo -e "${RED}  ❌ Failed to configure route $route_id (HTTP $http_code)${NC}"
        echo "  Response: $body"
        return 1
    fi
}

# Function to create or update an upstream
create_upstream() {
    local upstream_id=$1
    local upstream_data=$2
    
    echo -e "${YELLOW}Creating/Updating upstream $upstream_id...${NC}"
    
    response=$(curl -s -w "\n%{http_code}" -X PUT "$APISIX_ADMIN_URL/upstreams/$upstream_id" \
        -H "X-API-KEY: $APISIX_ADMIN_KEY" \
        -H "Content-Type: application/json" \
        -d "$upstream_data")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}  ✅ Upstream $upstream_id configured successfully${NC}"
    else
        echo -e "${RED}  ❌ Failed to configure upstream $upstream_id (HTTP $http_code)${NC}"
        echo "  Response: $body"
        return 1
    fi
}

echo ""
echo -e "${YELLOW}Step 1: Configuring TLS (SNI certificate)${NC}"
echo "--------------------------------------------"

# Create an SSL object so APISIX can terminate TLS by SNI.
# Without this, clients can get TLS handshake errors like "failed to match any SSL certificate by SNI".
CERT_FILE="/certs/apisix/server.crt"
KEY_FILE="/certs/apisix/server.key"

if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
  CERT_CONTENT=$(cat "$CERT_FILE" | sed 's/$/\\n/' | tr -d '\n')
  KEY_CONTENT=$(cat "$KEY_FILE" | sed 's/$/\\n/' | tr -d '\n')

  # Include localhost for local curl testing (SNI = localhost).
  create_ssl "1" "{
    \"id\": \"1\",
    \"snis\": [\"thaliumx.com\", \"*.thaliumx.com\", \"auth.thaliumx.com\", \"thal.thaliumx.com\", \"localhost\"],
    \"cert\": \"$CERT_CONTENT\",
    \"key\": \"$KEY_CONTENT\"
  }"
else
  echo -e "${YELLOW}WARN: TLS certificate files not found at $CERT_FILE / $KEY_FILE; skipping SSL object creation${NC}"
fi

echo ""
echo -e "${YELLOW}Step 2: Configuring Upstreams${NC}"
echo "--------------------------------------------"

# Upstream 1: Frontend (Next.js)
create_upstream "1" "{
    \"id\": \"1\",
    \"name\": \"frontend-upstream\",
    \"type\": \"roundrobin\",
    \"scheme\": \"http\",
    \"nodes\": {
        \"$FRONTEND_UPSTREAM\": 1
    },
    \"timeout\": {
        \"connect\": 6,
        \"send\": 6,
        \"read\": 6
    },
    \"retries\": 2,
    \"pass_host\": \"pass\"
}"

# Upstream 2: Backend (Express API)
create_upstream "2" "{
    \"id\": \"2\",
    \"name\": \"backend-upstream\",
    \"type\": \"roundrobin\",
    \"scheme\": \"http\",
    \"nodes\": {
        \"$BACKEND_UPSTREAM\": 1
    },
    \"timeout\": {
        \"connect\": 6,
        \"send\": 6,
        \"read\": 6
    },
    \"retries\": 2,
    \"pass_host\": \"pass\"
}"

# Upstream 3: Keycloak (HTTPS, runs under /auth)
create_upstream "3" "{
    \"id\": \"3\",
    \"name\": \"keycloak-upstream\",
    \"type\": \"roundrobin\",
    \"scheme\": \"https\",
    \"nodes\": {
        \"$KEYCLOAK_UPSTREAM\": 1
    },
    \"timeout\": {
        \"connect\": 10,
        \"send\": 10,
        \"read\": 30
    },
    \"retries\": 2,
    \"pass_host\": \"pass\",
    \"tls\": {
        \"verify\": false
    }
}"

echo ""
echo -e "${YELLOW}Step 3: Configuring Routes${NC}"
echo "--------------------------------------------"

# Route 1: Main landing page - thaliumx.com (52.54.125.124)
create_route "1" "{
    \"id\": \"1\",
    \"name\": \"thaliumx-main\",
    \"desc\": \"Main landing page - thaliumx.com (52.54.125.124)\",
    \"host\": \"thaliumx.com\",
    \"uri\": \"/*\",
    \"priority\": 10,
    \"status\": 1,
    \"upstream_id\": \"1\",
    \"plugins\": {
        \"redirect\": {
            \"http_to_https\": true,
            \"ret_code\": 302
        }
    }
}"

# Route 2: WWW redirect - www.thaliumx.com
create_route "2" "{
    \"id\": \"2\",
    \"name\": \"thaliumx-www-redirect\",
    \"desc\": \"Redirect www to non-www\",
    \"host\": \"www.thaliumx.com\",
    \"uri\": \"/*\",
    \"priority\": 10,
    \"status\": 1,
    \"plugins\": {
        \"redirect\": {
            \"uri\": \"https://thaliumx.com\$request_uri\",
            \"ret_code\": 301
        }
    }
}"

# Route 3: Token presale page - thal.thaliumx.com (52.54.125.124) - Direct to /token-presale
# IMPORTANT: do not blindly rewrite all paths, otherwise internal navigation breaks.
# - / (root) -> /token-presale
# - /* (everything else) -> frontend as-is

# Route 3: thal.thaliumx.com root -> /token-presale
create_route "3" "{
    \"id\": \"3\",
    \"name\": \"thaliumx-presale-root\",
    \"desc\": \"Token presale landing - thal.thaliumx.com (root -> /token-presale)\",
    \"host\": \"thal.thaliumx.com\",
    \"uri\": \"/\",
    \"priority\": 30,
    \"status\": 1,
    \"upstream_id\": \"1\",
    \"plugins\": {
        \"redirect\": {
            \"http_to_https\": true,
            \"ret_code\": 302
        },
        \"proxy-rewrite\": {
            \"uri\": \"/token-presale\"
        }
    }
}"

# Route 3b: thal.thaliumx.com all other paths -> frontend (no rewrite)
create_route "30" "{
    \"id\": \"30\",
    \"name\": \"thaliumx-presale-site\",
    \"desc\": \"Token presale site - thal.thaliumx.com (all paths)\",
    \"host\": \"thal.thaliumx.com\",
    \"uri\": \"/*\",
    \"priority\": 10,
    \"status\": 1,
    \"upstream_id\": \"1\",
    \"plugins\": {
        \"redirect\": {
            \"http_to_https\": true,
            \"ret_code\": 302
        }
    }
}"

# Route 4: API endpoints (with rate limiting)
create_route "4" "{
    \"id\": \"4\",
    \"name\": \"thaliumx-api\",
    \"desc\": \"API endpoints with rate limiting\",
    \"hosts\": [\"thaliumx.com\", \"thal.thaliumx.com\", \"api.thaliumx.com\"],
    \"uri\": \"/api/*\",
    \"priority\": 20,
    \"status\": 1,
    \"upstream_id\": \"2\",
    \"plugins\": {
        \"openid-connect\": {
            \"discovery\": \"$OIDC_DISCOVERY\",
            \"client_id\": \"$OIDC_CLIENT_ID\",
            \"bearer_only\": true,
            \"ssl_verify\": $OIDC_SSL_VERIFY
        },
        \"proxy-rewrite\": {
            \"headers\": {
                \"X-Tenant-ID\": \"10000000-0000-0000-0000-000000000000\",
                \"X-Tenant-Slug\": \"thaliumx-platform\"
            }
        },
        \"redirect\": {
            \"http_to_https\": true,
            \"ret_code\": 302
        },
        \"cors\": {
            \"allow_origins\": \"https://thaliumx.com,https://thal.thaliumx.com,https://api.thaliumx.com\",
            \"allow_methods\": \"GET,POST,PUT,DELETE,OPTIONS,PATCH\",
            \"allow_headers\": \"Content-Type,Authorization,X-Requested-With,X-API-Key,X-Tenant-ID,X-Broker-ID,X-CSRF-Token\",
            \"expose_headers\": \"X-Rate-Limit-Remaining,X-Rate-Limit-Reset,X-Request-ID\",
            \"max_age\": 3600,
            \"allow_credential\": true
        },
        \"request-id\": {
            \"include_in_response\": true
        },
        \"limit-req\": {
            \"rate\": 60,
            \"burst\": 30,
            \"key\": \"remote_addr\",
            \"rejected_code\": 429,
            \"rejected_msg\": \"Too many requests. Please try again later.\"
        },
        \"limit-count\": {
            \"count\": 1000,
            \"time_window\": 60,
            \"key\": \"remote_addr\",
            \"rejected_code\": 429,
            \"rejected_msg\": \"Rate limit exceeded. Please try again later.\"
        }
    }
}"

# Route 8: auth.thaliumx.com -> Keycloak (runs under /auth)
# 8a) / -> redirect to /auth
create_route "8" "{
    \"id\": \"8\",
    \"name\": \"thaliumx-auth-root\",
    \"desc\": \"Keycloak root redirect - auth.thaliumx.com/ -> /auth\",
    \"host\": \"auth.thaliumx.com\",
    \"uri\": \"/\",
    \"priority\": 50,
    \"status\": 1,
    \"plugins\": {
        \"redirect\": {
            \"uri\": \"/auth\",
            \"ret_code\": 302
        }
    }
}"

# 8b) /auth/* -> upstream keycloak
create_route "9" "{
    \"id\": \"9\",
    \"name\": \"thaliumx-auth\",
    \"desc\": \"Keycloak proxy - auth.thaliumx.com/auth/*\",
    \"host\": \"auth.thaliumx.com\",
    \"uri\": \"/auth/*\",
    \"priority\": 60,
    \"status\": 1,
    \"upstream_id\": \"3\",
    \"plugins\": {
        \"request-id\": {
            \"include_in_response\": true
        }
    }
}"

# Route 5: Health check endpoint (no rate limiting)
create_route "5" "{
    \"id\": \"5\",
    \"name\": \"thaliumx-health\",
    \"desc\": \"Health check endpoint\",
    \"uri\": \"/health\",
    \"priority\": 30,
    \"status\": 1,
    \"upstream_id\": \"2\",
    \"plugins\": {}
}"

# Route 6: Auth endpoints (very strict rate limiting)
create_route "6" "{
    \"id\": \"6\",
    \"name\": \"thaliumx-auth\",
    \"desc\": \"Authentication endpoints with strict rate limiting\",
    \"uri\": \"/api/auth/*\",
    \"priority\": 25,
    \"status\": 1,
    \"upstream_id\": \"2\",
    \"plugins\": {
        \"openid-connect\": {
            \"discovery\": \"$OIDC_DISCOVERY\",
            \"client_id\": \"$OIDC_CLIENT_ID\",
            \"bearer_only\": true,
            \"ssl_verify\": $OIDC_SSL_VERIFY
        },
        \"redirect\": {
            \"http_to_https\": true,
            \"ret_code\": 302
        },
        \"cors\": {
            \"allow_origins\": \"https://thaliumx.com,https://thal.thaliumx.com\",
            \"allow_methods\": \"GET,POST,PUT,DELETE,OPTIONS\",
            \"allow_headers\": \"Content-Type,Authorization,X-Requested-With,X-CSRF-Token\",
            \"expose_headers\": \"X-Rate-Limit-Remaining,X-Rate-Limit-Reset\",
            \"max_age\": 3600,
            \"allow_credential\": true
        },
        \"limit-req\": {
            \"rate\": 10,
            \"burst\": 5,
            \"key\": \"remote_addr\",
            \"rejected_code\": 429,
            \"rejected_msg\": \"Too many authentication attempts. Please try again later.\"
        },
        \"limit-count\": {
            \"count\": 20,
            \"time_window\": 60,
            \"key\": \"remote_addr\",
            \"rejected_code\": 429,
            \"rejected_msg\": \"Authentication rate limit exceeded.\"
        }
    }
}"

# Route 7: Financial endpoints (strict rate limiting)
create_route "7" "{
    \"id\": \"7\",
    \"name\": \"thaliumx-financial\",
    \"desc\": \"Financial endpoints with strict rate limiting\",
    \"uri\": \"/api/financial/*\",
    \"priority\": 25,
    \"status\": 1,
    \"upstream_id\": \"2\",
    \"plugins\": {
        \"openid-connect\": {
            \"discovery\": \"$OIDC_DISCOVERY\",
            \"client_id\": \"$OIDC_CLIENT_ID\",
            \"bearer_only\": true,
            \"ssl_verify\": $OIDC_SSL_VERIFY
        },
        \"redirect\": {
            \"http_to_https\": true,
            \"ret_code\": 302
        },
        \"cors\": {
            \"allow_origins\": \"https://thaliumx.com,https://thal.thaliumx.com\",
            \"allow_methods\": \"GET,POST,PUT,DELETE,OPTIONS\",
            \"allow_headers\": \"Content-Type,Authorization,X-Requested-With,X-CSRF-Token,X-Tenant-ID\",
            \"expose_headers\": \"X-Rate-Limit-Remaining,X-Rate-Limit-Reset\",
            \"max_age\": 3600,
            \"allow_credential\": true
        },
        \"limit-req\": {
            \"rate\": 30,
            \"burst\": 15,
            \"key\": \"remote_addr\",
            \"rejected_code\": 429,
            \"rejected_msg\": \"Too many financial requests. Please try again later.\"
        },
        \"limit-count\": {
            \"count\": 100,
            \"time_window\": 60,
            \"key\": \"remote_addr\",
            \"rejected_code\": 429,
            \"rejected_msg\": \"Financial operations rate limit exceeded.\"
        }
    }
}"

echo ""
echo -e "${GREEN}=== APISIX Route Initialization Complete ===${NC}"
echo ""
echo "Routes configured:"
echo "  ✅ thaliumx.com -> Main landing page (/landing)"
echo "  ✅ www.thaliumx.com -> Redirect to thaliumx.com"
echo "  ✅ thal.thaliumx.com -> Token presale page (/token-presale)"
echo "  ✅ auth.thaliumx.com -> Keycloak (/auth/*)"
echo "  ✅ /api/* -> Backend API (60 req/s, 1000/min per IP)"
echo "  ✅ /api/auth/* -> Auth endpoints (10 req/s, 20/min per IP)"
echo "  ✅ /api/financial/* -> Financial endpoints (30 req/s, 100/min per IP)"
echo "  ✅ /health -> Health check (no rate limiting)"
echo ""
echo "Rate limiting configured:"
echo "  • API endpoints: 60 req/s, 1000/min per IP"
echo "  • Auth endpoints: 10 req/s, 20/min per IP (strict)"
echo "  • Financial endpoints: 30 req/s, 100/min per IP (strict)"
echo ""
