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
KEYCLOAK_UPSTREAM="${KEYCLOAK_UPSTREAM:-thaliumx-keycloak:8443}"              # THALIUMX_KEYCLOAK_DEPRECATE
KEYCLOAK_MGMT_UPSTREAM="${KEYCLOAK_MGMT_UPSTREAM:-thaliumx-keycloak:9000}"    # THALIUMX_KEYCLOAK_DEPRECATE

# Keycloak OIDC (Keycloak-authoritative auth enforced at APISIX)
# Single-realm mode: thaliumx-platform is the only realm used for both end-users and admins.
KEYCLOAK_REALM="${KEYCLOAK_REALM:-thaliumx-platform}"  # THALIUMX_KEYCLOAK_DEPRECATE
OIDC_CLIENT_ID="${OIDC_CLIENT_ID:-thaliumx-frontend}"
# NOTE: APISIX openid-connect plugin schema requires a client_secret even in bearer_only mode.
# Provide a confidential client secret (recommended: a dedicated apisix client, or reuse backend client for introspection).
OIDC_CLIENT_SECRET="${OIDC_CLIENT_SECRET:-}"

# IMPORTANT (prod correctness): the OIDC discovery URL must match the issuer that end-users actually see.
# - End-user tokens are minted via the public hostname through APISIX.
# - If discovery is pointed directly at the internal Keycloak service (e.g. https://keycloak:8443/...),
#   Keycloak may emit a different `issuer` (often including :8443) which then causes APISIX to reject
#   otherwise-valid tokens (issuer mismatch).
#
# Default to the public hostname, but allow overrides for air-gapped/dev deployments.
KEYCLOAK_PUBLIC_HOST="${KEYCLOAK_PUBLIC_HOST:-thaliumx.com}"
OIDC_DISCOVERY="${OIDC_DISCOVERY:-https://${KEYCLOAK_PUBLIC_HOST}/auth/realms/${KEYCLOAK_REALM}/.well-known/openid-configuration}"  # THALIUMX_KEYCLOAK_DEPRECATE

# PRODUCTION: verify Keycloak TLS using the internal CA mounted into the APISIX container.
OIDC_SSL_VERIFY="${OIDC_SSL_VERIFY:-true}"

# Enable gateway-side OIDC enforcement for protected APIs.
# - When true, a higher-priority /api/* route is created with the openid-connect plugin.
# - Public endpoints remain public via more-specific routes.
APISIX_ENABLE_OIDC="${APISIX_ENABLE_OIDC:-false}"

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
echo "Keycloak (mgmt): $KEYCLOAK_MGMT_UPSTREAM"
echo "OIDC Discovery: $OIDC_DISCOVERY"
echo "APISIX_ENABLE_OIDC: $APISIX_ENABLE_OIDC"
if [ -z "$OIDC_CLIENT_SECRET" ]; then
  echo -e "${YELLOW}WARN: OIDC_CLIENT_SECRET is empty. Routes using openid-connect will fail to configure in APISIX (plugin schema requires client_secret).${NC}"
fi
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

    # NOTE: APISIX Admin API uses the plural resource name: /ssls
    response=$(curl -s -w "\n%{http_code}" -X PUT "$APISIX_ADMIN_URL/ssls/$ssl_id" \
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
    \"pass_host\": \"pass\"
}"

# Upstream 4: Keycloak management interface (HTTPS, health endpoints)
# Keycloak exposes health endpoints on :9000 (TLS) as /auth/health/* when `--http-relative-path=/auth`.
create_upstream "4" "{
    \"id\": \"4\",
    \"name\": \"keycloak-mgmt-upstream\",
    \"type\": \"roundrobin\",
    \"scheme\": \"https\",
    \"nodes\": {
        \"$KEYCLOAK_MGMT_UPSTREAM\": 1
    },
    \"timeout\": {
        \"connect\": 10,
        \"send\": 10,
        \"read\": 30
    },
    \"retries\": 2,
    \"pass_host\": \"pass\"
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
# NOTE (ThaliumX auth contract):
# - We intentionally DO NOT enforce Keycloak OIDC at the gateway for all /api/* here.
# - The current frontend login/register flows use the backend's native auth endpoints.
# - Enforcing APISIX openid-connect on /api/* breaks /api/auth/login and /api/auth/register.
# - Backend already performs authentication/authorization via middleware.
#
# Once the frontend is migrated to Keycloak-native OIDC, re-enable openid-connect here.
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

# Route 4b: Public CSRF token endpoint (kept open during migration)
# - When APISIX OIDC is enabled for /api/*, /api/csrf-token must remain public for legacy cookie flows.
create_route "31" "{
    \"id\": \"31\",
    \"name\": \"thaliumx-csrf-token\",
    \"desc\": \"Public CSRF token endpoint\",
    \"hosts\": [\"thaliumx.com\", \"thal.thaliumx.com\", \"api.thaliumx.com\"],
    \"uri\": \"/api/csrf-token\",
    \"priority\": 26,
    \"status\": 1,
    \"upstream_id\": \"2\",
    \"plugins\": {
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
            \"allow_methods\": \"GET,OPTIONS\",
            \"allow_headers\": \"Content-Type,Authorization,X-Requested-With,X-CSRF-Token\",
            \"expose_headers\": \"X-Request-ID\",
            \"max_age\": 3600,
            \"allow_credential\": true
        },
        \"request-id\": {
            \"include_in_response\": true
        }
    }
}"

# Route 4d: Public presale status endpoint
# - Required so the token sale landing page can render stats before login.
# - Must have higher priority than the protected /api/* route.
create_route "32" "{
    \"id\": \"32\",
    \"name\": \"thaliumx-presale-status\",
    \"desc\": \"Public presale status endpoint\",
    \"hosts\": [\"thaliumx.com\", \"thal.thaliumx.com\", \"api.thaliumx.com\"],
    \"uri\": \"/api/presale/status\",
    \"methods\": [\"GET\", \"OPTIONS\"],
    \"priority\": 26,
    \"status\": 1,
    \"upstream_id\": \"2\",
    \"plugins\": {
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
            \"allow_methods\": \"GET,OPTIONS\",
            \"allow_headers\": \"Content-Type,Authorization,X-Requested-With\",
            \"expose_headers\": \"X-Request-ID\",
            \"max_age\": 3600,
            \"allow_credential\": true
        },
        \"request-id\": {
            \"include_in_response\": true
        }
    }
}"

# Route 4e: Public market price endpoints (used by presale UI)
create_route "33" "{
    \"id\": \"33\",
    \"name\": \"thaliumx-market-prices\",
    \"desc\": \"Public market price endpoints\",
    \"hosts\": [\"thaliumx.com\", \"thal.thaliumx.com\", \"api.thaliumx.com\"],
    \"uri\": \"/api/market/prices/*\",
    \"methods\": [\"GET\", \"OPTIONS\"],
    \"priority\": 26,
    \"status\": 1,
    \"upstream_id\": \"2\",
    \"plugins\": {
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
            \"allow_methods\": \"GET,OPTIONS\",
            \"allow_headers\": \"Content-Type,Authorization,X-Requested-With\",
            \"expose_headers\": \"X-Request-ID\",
            \"max_age\": 3600,
            \"allow_credential\": true
        },
        \"request-id\": {
            \"include_in_response\": true
        }
    }
}"

# Route 4c: Protected API endpoints (Keycloak OIDC at the gateway)
# - Only created when APISIX_ENABLE_OIDC=true.
# - Higher priority than route 4 so it wins for /api/*.
# - Sensitive auth endpoints remain public via route 6.
if [ "$APISIX_ENABLE_OIDC" = "true" ]; then
  if [ -z "$OIDC_CLIENT_SECRET" ]; then
    echo -e "${RED}ERROR: APISIX_ENABLE_OIDC=true but OIDC_CLIENT_SECRET is empty. Refusing to create protected /api/* route.${NC}" >&2
    exit 1
  fi

  create_route "41" "{
      \"id\": \"41\",
      \"name\": \"thaliumx-api-protected\",
      \"desc\": \"Protected API endpoints (gateway-enforced OIDC)\",
      \"hosts\": [\"thaliumx.com\", \"thal.thaliumx.com\", \"api.thaliumx.com\"],
      \"uri\": \"/api/*\",
      \"priority\": 22,
      \"status\": 1,
      \"upstream_id\": \"2\",
      \"plugins\": {
          \"openid-connect\": {
              \"client_id\": \"$OIDC_CLIENT_ID\",
              \"client_secret\": \"$OIDC_CLIENT_SECRET\",
              \"discovery\": \"$OIDC_DISCOVERY\",
              \"bearer_only\": true,
              \"scope\": \"openid profile email\",
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
fi

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

# 8a2) /auth (no trailing slash) -> redirect to /auth/
# Fixes a sharp edge where `/auth` does not match the `/auth/*` route below.
create_route "11" "{
    \"id\": \"11\",
    \"name\": \"thaliumx-auth-auth-no-slash\",
    \"desc\": \"Keycloak redirect - auth.thaliumx.com/auth -> /auth/\",
    \"host\": \"auth.thaliumx.com\",
    \"uri\": \"/auth\",
    \"priority\": 70,
    \"status\": 1,
    \"plugins\": {
        \"redirect\": {
            \"uri\": \"/auth/\",
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
        \"proxy-rewrite\": {
            \"headers\": {
                \"X-Forwarded-Proto\": \"https\",
                \"X-Forwarded-Port\": \"443\",
                \"X-Forwarded-Host\": \"auth.thaliumx.com\"
            }
        },
        \"request-id\": {
            \"include_in_response\": true
        }
    }
}"

# 8c) Keycloak health endpoints (served on management interface :9000)
# IMPORTANT:
# - Must have higher priority than route 9 (/auth/*) so it wins.
# - Keeps health checks stable even if the Keycloak app port does not expose health.
create_route "10" "{
    \"id\": \"10\",
    \"name\": \"thaliumx-auth-health\",
    \"desc\": \"Keycloak health proxy - auth.thaliumx.com/auth/health/* -> keycloak:9000\",
    \"host\": \"auth.thaliumx.com\",
    \"uri\": \"/auth/health/*\",
    \"priority\": 80,
    \"status\": 1,
    \"upstream_id\": \"4\",
    \"plugins\": {
        \"proxy-rewrite\": {
            \"headers\": {
                \"X-Forwarded-Proto\": \"https\",
                \"X-Forwarded-Port\": \"443\",
                \"X-Forwarded-Host\": \"auth.thaliumx.com\"
            }
        },
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
    \"hosts\": [\"thaliumx.com\", \"thal.thaliumx.com\", \"api.thaliumx.com\"],
    \"uri\": \"/health\",
    \"priority\": 100,
    \"status\": 1,
    \"upstream_id\": \"2\",
    \"plugins\": {}
}"

 # Route 6: Sensitive auth endpoints (strict rate limiting)
 # IMPORTANT:
 # - Do NOT rate-limit *all* /api/auth/*.
 # - Endpoints like /api/auth/profile and /api/auth/refresh are hit frequently by normal UX
 #   (token pre-refresh, page reloads, multi-tab usage) and should fall back to the general /api/* route limiter.
 # - Apply stricter controls only to brute-force targets: login/register/reset.
 create_route "6" "{
     \"id\": \"6\",
     \"name\": \"thaliumx-auth-sensitive\",
     \"desc\": \"Sensitive auth endpoints (login/register/reset) with strict rate limiting\",
     \"hosts\": [\"thaliumx.com\", \"thal.thaliumx.com\", \"api.thaliumx.com\"],
     \"uris\": [
         \"/api/auth/login\",
         \"/api/auth/register\",
         \"/api/auth/reset-password\",
         \"/api/auth/confirm-reset\"
     ],
     \"priority\": 25,
     \"status\": 1,
     \"upstream_id\": \"2\",
     \"plugins\": {
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
             \"allow_origins\": \"https://thaliumx.com,https://thal.thaliumx.com\",
             \"allow_methods\": \"GET,POST,PUT,DELETE,OPTIONS\",
             \"allow_headers\": \"Content-Type,Authorization,X-Requested-With,X-CSRF-Token\",
             \"expose_headers\": \"X-Rate-Limit-Remaining,X-Rate-Limit-Reset,X-Request-ID\",
             \"max_age\": 3600,
             \"allow_credential\": true
         },
         \"request-id\": {
             \"include_in_response\": true
         },
         \"limit-req\": {
             \"rate\": 5,
             \"burst\": 5,
             \"key\": \"remote_addr\",
             \"rejected_code\": 429,
             \"rejected_msg\": \"Too many authentication attempts from this IP, please try again later.\"
         },
         \"limit-count\": {
             \"count\": 30,
             \"time_window\": 300,
             \"key\": \"remote_addr\",
             \"rejected_code\": 429,
             \"rejected_msg\": \"Too many authentication attempts from this IP, please try again later.\"
         }
     }
 }"

# Route 12: thaliumx.com -> Keycloak under the main hostname (temporary workaround)
# Why: browsers are failing to resolve auth.thaliumx.com (NXDOMAIN), which breaks the Keycloak JS adapter
# (3p-cookies step1.html iframe) and causes timeouts on page load.
#
# 12a) /auth -> redirect to /auth/
create_route "12" "{
    \"id\": \"12\",
    \"name\": \"thaliumx-auth-on-main-host-no-slash\",
    \"desc\": \"Keycloak redirect - thaliumx.com/auth -> /auth/\",
    \"host\": \"thaliumx.com\",
    \"uri\": \"/auth\",
    \"priority\": 90,
    \"status\": 1,
    \"plugins\": {
        \"redirect\": {
            \"uri\": \"/auth/\",
            \"ret_code\": 302
        }
    }
}"

# 12b) /auth/* -> upstream keycloak
create_route "13" "{
    \"id\": \"13\",
    \"name\": \"thaliumx-auth-on-main-host\",
    \"desc\": \"Keycloak proxy - thaliumx.com/auth/*\",
    \"host\": \"thaliumx.com\",
    \"uri\": \"/auth/*\",
    \"priority\": 95,
    \"status\": 1,
    \"upstream_id\": \"3\",
    \"plugins\": {
        \"proxy-rewrite\": {
            \"headers\": {
                \"X-Forwarded-Proto\": \"https\",
                \"X-Forwarded-Port\": \"443\",
                \"X-Forwarded-Host\": \"thaliumx.com\"
            }
        },
        \"request-id\": {
            \"include_in_response\": true
        }
    }
}"

# 12c) /auth/health/* -> keycloak mgmt
create_route "14" "{
    \"id\": \"14\",
    \"name\": \"thaliumx-auth-health-on-main-host\",
    \"desc\": \"Keycloak health proxy - thaliumx.com/auth/health/* -> keycloak:9000\",
    \"host\": \"thaliumx.com\",
    \"uri\": \"/auth/health/*\",
    \"priority\": 96,
    \"status\": 1,
    \"upstream_id\": \"4\",
    \"plugins\": {
        \"proxy-rewrite\": {
            \"headers\": {
                \"X-Forwarded-Proto\": \"https\",
                \"X-Forwarded-Port\": \"443\",
                \"X-Forwarded-Host\": \"thaliumx.com\"
            }
        },
        \"request-id\": {
            \"include_in_response\": true
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
echo "  ✅ auth.thaliumx.com -> Keycloak health (/auth/health/*)"
echo "  ✅ /api/* -> Backend API (60 req/s, 1000/min per IP)"
echo "  ✅ /api/auth/login|register|reset* -> Sensitive auth endpoints (5 req/s, 30 per 5 min per IP)"
echo "  ✅ /api/financial/* -> Financial endpoints (30 req/s, 100/min per IP)"
echo "  ✅ /health -> Health check (no rate limiting)"
echo ""
echo "Rate limiting configured:"
echo "  • API endpoints: 60 req/s, 1000/min per IP"
echo "  • Sensitive auth endpoints: 5 req/s, 30 per 5 min per IP (strict)"
echo "  • Financial endpoints: 30 req/s, 100/min per IP (strict)"
echo ""
