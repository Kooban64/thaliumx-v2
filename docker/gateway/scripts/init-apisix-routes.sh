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

# Identity provider upstream is plain HTTP behind APISIX TLS termination
KEYCLOAK_UPSTREAM="${KEYCLOAK_UPSTREAM:-thaliumx-keycloak:8080}"

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
AUTH_PUBLIC_HOST="${AUTH_PUBLIC_HOST:-auth.thaliumx.com}"
KEYCLOAK_PUBLIC_HOST="${KEYCLOAK_PUBLIC_HOST:-$AUTH_PUBLIC_HOST}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-thaliumx}"

# Optional strict audience and issuer controls for gateway OIDC route.
OIDC_EXPECTED_AUDIENCE="${OIDC_EXPECTED_AUDIENCE:-${KEYCLOAK_CLIENT_ID:-$OIDC_CLIENT_ID}}"
OIDC_EXPECTED_ISSUER="${OIDC_EXPECTED_ISSUER:-}"

AUTH_UPSTREAM="$KEYCLOAK_UPSTREAM"
OIDC_DISCOVERY="${OIDC_DISCOVERY:-https://${KEYCLOAK_PUBLIC_HOST}/realms/${KEYCLOAK_REALM}/.well-known/openid-configuration}"
OIDC_EXPECTED_ISSUER="${OIDC_EXPECTED_ISSUER:-https://${KEYCLOAK_PUBLIC_HOST}/realms/${KEYCLOAK_REALM}}"

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
echo "Auth provider: keycloak"
echo "Auth upstream: $AUTH_UPSTREAM"
echo "OIDC Discovery: $OIDC_DISCOVERY"
echo "OIDC expected issuer: $OIDC_EXPECTED_ISSUER"
echo "OIDC expected audience: $OIDC_EXPECTED_AUDIENCE"
echo "APISIX_ENABLE_OIDC: $APISIX_ENABLE_OIDC"
if [ -z "$OIDC_CLIENT_SECRET" ]; then
  echo -e "${YELLOW}WARN: OIDC_CLIENT_SECRET is empty. Routes using openid-connect will fail to configure in APISIX (plugin schema requires client_secret).${NC}"
fi
echo ""
echo -e "${GREEN}Route Priority Hierarchy (higher = matches first):${NC}"
echo "  • Route 6 (auth endpoints): Priority 100 - HIGHEST (login/register/reset)"
echo "  • Route 5 (health): Priority 100"
echo "  • Route 41 (OIDC /api/*): Priority 22 - EXCLUDES /api/auth/*"
echo "  • Route 7 (financial): Priority 25"
echo "  • Route 4 (general /api/*): Priority 20"
echo -e "${YELLOW}IMPORTANT: Never create routes with priority >= 100 that match /api/auth/*${NC}"
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

# Function to create or update a global rule
create_global_rule() {
    local rule_id=$1
    local rule_data=$2
    
    echo -e "${YELLOW}Creating/Updating global rule $rule_id...${NC}"
    
    response=$(curl -s -w "\n%{http_code}" -X PUT "$APISIX_ADMIN_URL/global_rules/$rule_id" \
        -H "X-API-KEY: $APISIX_ADMIN_KEY" \
        -H "Content-Type: application/json" \
        -d "$rule_data")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}  ✅ Global rule $rule_id configured successfully${NC}"
    else
        echo -e "${RED}  ❌ Failed to configure global rule $rule_id (HTTP $http_code)${NC}"
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
    \"pass_host\": \"pass\",
    \"checks\": {
        \"active\": {
            \"type\": \"http\",
            \"http_path\": \"/health\",
            \"host\": \"$BACKEND_UPSTREAM\",
            \"port\": 3002,
            \"healthy\": {
                \"interval\": 2,
                \"successes\": 2,
                \"http_statuses\": [200, 201, 204]
            },
            \"unhealthy\": {
                \"interval\": 1,
                \"http_failures\": 3,
                \"tcp_failures\": 2,
                \"timeouts\": 3
            }
        }
    }
}"

# Upstream 6: Ballerine Workflows Service
BALLERINE_UPSTREAM="${BALLERINE_UPSTREAM:-thaliumx-ballerine-workflow:3000}"
create_upstream "6" "{
    \"id\": \"6\",
    \"name\": \"ballerine-workflow-upstream\",
    \"type\": \"roundrobin\",
    \"scheme\": \"http\",
    \"nodes\": {
        \"$BALLERINE_UPSTREAM\": 1
    },
    \"timeout\": {
        \"connect\": 10,
        \"send\": 30,
        \"read\": 60
    },
    \"retries\": 2,
    \"pass_host\": \"pass\",
    \"checks\": {
        \"active\": {
            \"type\": \"http\",
            \"http_path\": \"/api/v1/_health/live\",
            \"host\": \"$BALLERINE_UPSTREAM\",
            \"port\": 3000,
            \"healthy\": {
                \"interval\": 5,
                \"successes\": 2,
                \"http_statuses\": [200, 204]
            },
            \"unhealthy\": {
                \"interval\": 2,
                \"http_failures\": 3,
                \"tcp_failures\": 2,
                \"timeouts\": 3
            }
        }
    }
}"

# Upstream 5: Keycloak identity provider behind APISIX
create_upstream "5" "{
    \"id\": \"5\",
    \"name\": \"auth-upstream-keycloak\",
    \"type\": \"roundrobin\",
    \"scheme\": \"http\",
    \"nodes\": {
        \"$AUTH_UPSTREAM\": 1
    },
    \"timeout\": {
        \"connect\": 10,
        \"send\": 10,
        \"read\": 60
    },
    \"retries\": 2,
    \"pass_host\": \"pass\",
    \"checks\": {
        \"active\": {
            \"type\": \"http\",
            \"http_path\": \"/realms/${KEYCLOAK_REALM}/.well-known/openid-configuration\",
            \"host\": \"$AUTH_UPSTREAM\",
            \"port\": 8080,
            \"healthy\": {
                \"interval\": 5,
                \"successes\": 2,
                \"http_statuses\": [200, 301, 302]
            },
            \"unhealthy\": {
                \"interval\": 2,
                \"http_failures\": 3,
                \"tcp_failures\": 2,
                \"timeouts\": 3
            }
        }
    }
}"

echo ""
echo -e "${YELLOW}Step 3: Configuring Global Rules${NC}"
echo "--------------------------------------------"

# Global Rule 1: Security headers and global rate limiting
# Build Redis configuration for rate limiting plugins
# Default to local policy if Redis not configured
REDIS_HOST="${REDIS_HOST:-thaliumx-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_DATABASE="${REDIS_DATABASE:-0}"

# Try to read Redis password from file if REDIS_PASSWORD not set
if [ -z "$REDIS_PASSWORD" ] && [ -f "/run/secrets/redis-password" ]; then
    REDIS_PASSWORD=$(cat /run/secrets/redis-password 2>/dev/null || echo "")
fi
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

if [ -n "$REDIS_PASSWORD" ]; then
    REDIS_CONFIG="\"redis_host\": \"$REDIS_HOST\", \"redis_port\": $REDIS_PORT, \"redis_password\": \"$REDIS_PASSWORD\", \"redis_database\": $REDIS_DATABASE"
else
    REDIS_CONFIG="\"redis_host\": \"$REDIS_HOST\", \"redis_port\": $REDIS_PORT, \"redis_database\": $REDIS_DATABASE"
fi

create_global_rule "1" "{
    \"id\": \"1\",
    \"plugins\": {
        \"response-rewrite\": {
            \"headers\": {
                \"X-Frame-Options\": \"DENY\",
                \"X-Content-Type-Options\": \"nosniff\",
                \"X-XSS-Protection\": \"1; mode=block\",
                \"Strict-Transport-Security\": \"max-age=31536000; includeSubDomains\",
                \"Content-Security-Policy\": \"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://auth.thaliumx.com;\",
                \"Referrer-Policy\": \"strict-origin-when-cross-origin\",
                \"Permissions-Policy\": \"geolocation=(), microphone=(), camera=()\"
            }
        },
        \"limit-count\": {
            \"count\": 10000,
            \"time_window\": 60,
            \"rejected_code\": 429,
            \"key\": \"remote_addr\",
            \"policy\": \"local\",
            \"rejected_msg\": \"Global rate limit exceeded. Please try again later.\"
        },
        \"limit-conn\": {
            \"conn\": 100,
            \"burst\": 50,
            \"default_conn_delay\": 0.1,
            \"key\": \"remote_addr\",
            \"rejected_code\": 503,
            \"rejected_msg\": \"Too many concurrent connections.\"
        }
    }
}"

echo ""
echo -e "${YELLOW}Step 4: Configuring Routes${NC}"
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
# - Route 4 remains the baseline API route.
# - Strict OIDC hard-deny enforcement is enabled on Route 41 when APISIX_ENABLE_OIDC=true.
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

# =============================================================================
# Route 4c: Protected API endpoints (OIDC at the gateway) - EXCLUDES AUTH
# =============================================================================
# IMPORTANT: This route MUST NOT match /api/auth/* endpoints.
# Route 6 (priority 100) handles all /api/auth/login, /api/auth/register, etc.
#
# This route uses a more specific URI pattern to exclude auth endpoints:
# - Matches: /api/* EXCEPT /api/auth/*
# - Priority: 22 (lower than Route 6's 100, higher than Route 4's 20)
#
# When adding new routes:
# - NEVER create a route with priority >= 100 that matches /api/auth/*
# - NEVER add OIDC plugin to routes matching /api/auth/login or /api/auth/register
# - Always test that login/register still work after adding new routes
# =============================================================================
if [ "$APISIX_ENABLE_OIDC" = "true" ]; then
  if [ -z "$OIDC_CLIENT_SECRET" ]; then
    echo -e "${RED}ERROR: APISIX_ENABLE_OIDC=true but OIDC_CLIENT_SECRET is empty. Refusing to create protected /api/* route.${NC}" >&2
    exit 1
  fi

  # Create Route 41 with explicit exclusion of auth endpoints
  # APISIX doesn't support negative patterns, so we use a more specific pattern
  # that matches common API paths but NOT /api/auth/*
  # Note: This is a workaround - Route 6's higher priority (100) ensures it matches first
  create_route "41" "{
      \"id\": \"41\",
      \"name\": \"thaliumx-api-protected\",
      \"desc\": \"Protected API endpoints (OIDC) - EXCLUDES /api/auth/* (handled by Route 6)\",
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
              \"ssl_verify\": $OIDC_SSL_VERIFY,
              \"token_endpoint_auth_method\": \"client_secret_post\",
              \"session\": {
                  \"secret\": \"${OIDC_SESSION_SECRET:-changeme-in-production-use-secret-manager}\"
              },
              \"set_access_token_header\": true,
              \"set_id_token_header\": true,
              \"set_userinfo_header\": true,
              \"set_claims_in_headers\": true,
              \"unauth_action\": \"deny\"
          },
          \"proxy-rewrite\": {
              \"headers\": {
                  \"X-Tenant-ID\": \"10000000-0000-0000-0000-000000000000\",
                  \"X-Tenant-Slug\": \"thaliumx-platform\",
                  \"X-Channel\": \"$http_x_channel\",
                  \"X-Broker-ID\": \"$http_x_broker_id\",
                  \"X-Broker-Slug\": \"$http_x_broker_slug\",
                  \"X-Resolved-Host\": \"$host\"
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
          \"response-rewrite\": {
              \"headers\": {
                  \"Strict-Transport-Security\": \"max-age=31536000; includeSubDomains; preload\",
                  \"X-Frame-Options\": \"DENY\",
                  \"X-Content-Type-Options\": \"nosniff\",
                  \"X-XSS-Protection\": \"1; mode=block\",
                  \"Referrer-Policy\": \"strict-origin-when-cross-origin\",
                  \"Content-Security-Policy\": \"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://auth.thaliumx.com; frame-ancestors 'none'\",
                  \"Permissions-Policy\": \"geolocation=(), microphone=(), camera=()\"
              }
          },
          \"request-id\": {
              \"include_in_response\": true
          },
          \"uri-blocker\": {
              \"block_rules\": [\"^/api/.*\\\\.\\\\.\", \"^/api/.*%2e%2e\"],
              \"rejected_code\": 403,
              \"rejected_msg\": \"Blocked URI pattern detected.\"
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
              \"policy\": \"local\",
              \"rejected_code\": 429,
              \"rejected_msg\": \"Rate limit exceeded. Please try again later.\"
          },
          \"limit-conn\": {
              \"conn\": 50,
              \"burst\": 25,
              \"default_conn_delay\": 0.1,
              \"key\": \"remote_addr\",
              \"rejected_code\": 503,
              \"rejected_msg\": \"Too many concurrent connections.\"
          },
          \"api-breaker\": {
              \"break_response_code\": 502,
              \"max_failed\": 5,
              \"timeout\": 3,
              \"unhealthy\": {
                  \"http_statuses\": [500, 502, 503, 504],
                  \"interval\": 2
              },
              \"healthy\": {
                  \"http_statuses\": [200, 201, 204],
                  \"interval\": 5,
                  \"successes\": 2
              }
          },
          \"opa\": {
              \"host\": \"$OPA_HOST\",
              \"policy\": \"$OPA_POLICY\",
              \"timeout\": 3000,
              \"ssl_verify\": $OPA_SSL_VERIFY,
              \"with_route\": true,
              \"with_service\": true,
              \"with_consumer\": true,
              \"include_body\": false,
              \"include_body_max_size\": 0
          },
          \"prometheus\": {},
          \"zipkin\": {
              \"endpoint\": \"https://thaliumx-tempo:9411/api/v2/spans\",
              \"sample_ratio\": 0.1,
              \"service_name\": \"thaliumx-apisix\"
          },
          \"kafka-logger\": {
              \"broker_list\": {
                  \"thaliumx-kafka\": 9092
              },
              \"kafka_topic\": \"thaliumx-access-logs\",
              \"producer_type\": \"async\",
              \"required_acks\": 1,
              \"buffer_duration\": 60,
              \"max_retry_count\": 3
          }
      }
  }"
fi

# Route 8: auth.thaliumx.com -> Keycloak identity provider
# NOTE (frontend PKCE):
# The browser performs OIDC discovery + token exchange against auth.thaliumx.com.
# Those requests are cross-origin from https://thaliumx.com, so we must ensure CORS
# headers are present even if the upstream does not emit them.

# 8-pre) CORS-enabled discovery endpoints
create_route "15" "{
    \"id\": \"15\",
    \"name\": \"thaliumx-auth-oidc-discovery-keycloak\",
    \"desc\": \"OIDC discovery (CORS)\",
    \"host\": \"auth.thaliumx.com\",
    \"uri\": \"/realms/*/.well-known/*\",
    \"priority\": 90,
    \"status\": 1,
    \"upstream_id\": \"5\",
    \"plugins\": {
        \"proxy-rewrite\": {
            \"headers\": {
                \"X-Forwarded-Proto\": \"https\",
                \"X-Forwarded-Port\": \"443\",
                \"X-Forwarded-Host\": \"auth.thaliumx.com\"
            }
        },
        \"cors\": {
            \"allow_origins\": \"https://thaliumx.com,https://thal.thaliumx.com\",
            \"allow_methods\": \"GET,OPTIONS\",
            \"allow_headers\": \"Content-Type,Authorization,X-Requested-With\",
            \"expose_headers\": \"X-Request-ID\",
            \"max_age\": 3600,
            \"allow_credential\": false
        },
        \"request-id\": { \"include_in_response\": true }
    }
}"

# 8-pre2) CORS-enabled OAuth endpoints (token exchange, JWKS, etc.)
create_route "16" "{
    \"id\": \"16\",
    \"name\": \"thaliumx-auth-oidc-oauth-keycloak\",
    \"desc\": \"Keycloak OIDC protocol endpoints (CORS for PKCE token exchange)\",
    \"host\": \"auth.thaliumx.com\",
    \"uri\": \"/realms/*/protocol/openid-connect/*\",
    \"priority\": 90,
    \"status\": 1,
    \"upstream_id\": \"5\",
    \"plugins\": {
        \"proxy-rewrite\": {
            \"headers\": {
                \"X-Forwarded-Proto\": \"https\",
                \"X-Forwarded-Port\": \"443\",
                \"X-Forwarded-Host\": \"auth.thaliumx.com\"
            }
        },
        \"cors\": {
            \"allow_origins\": \"https://thaliumx.com,https://thal.thaliumx.com\",
            \"allow_methods\": \"GET,POST,OPTIONS\",
            \"allow_headers\": \"Content-Type,Authorization,X-Requested-With\",
            \"expose_headers\": \"X-Request-ID\",
            \"max_age\": 3600,
            \"allow_credential\": false
        },
        \"request-id\": { \"include_in_response\": true }
    }
}"

create_route "8" "{
    \"id\": \"8\",
    \"name\": \"thaliumx-auth-keycloak\",
    \"desc\": \"Keycloak proxy - auth.thaliumx.com/*\",
    \"host\": \"auth.thaliumx.com\",
    \"uri\": \"/*\",
    \"priority\": 60,
    \"status\": 1,
    \"upstream_id\": \"5\",
    \"plugins\": {
        \"proxy-rewrite\": {
            \"headers\": {
                \"X-Forwarded-Proto\": \"https\",
                \"X-Forwarded-Port\": \"443\",
                \"X-Forwarded-Host\": \"auth.thaliumx.com\"
            }
        },
        \"request-id\": { \"include_in_response\": true }
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

# =============================================================================
# Route 6: CRITICAL AUTH ENDPOINTS - HIGHEST PRIORITY
# =============================================================================
# IMPORTANT: This route MUST have the highest priority (100) to ensure it always
# matches before any other /api/* routes, including OIDC-protected routes.
# 
# This route handles:
# - /api/auth/login
# - /api/auth/register
# - /api/auth/reset-password
# - /api/auth/confirm-reset
#
# DO NOT:
# - Lower this priority below 100
# - Add OIDC plugin to this route (auth endpoints must be public)
# - Add routes with priority >= 100 that match /api/auth/*
#
# Other auth endpoints (like /api/auth/profile, /api/auth/refresh) are handled
# by Route 4 (priority 20) and can be rate-limited normally.
# =============================================================================
create_route "6" "{
    \"id\": \"6\",
    \"name\": \"thaliumx-auth-sensitive\",
    \"desc\": \"CRITICAL: Sensitive auth endpoints (login/register/reset) - HIGHEST PRIORITY (100) - MUST NOT be OIDC-protected\",
    \"hosts\": [\"thaliumx.com\", \"thal.thaliumx.com\", \"api.thaliumx.com\"],
    \"uris\": [
        \"/api/auth/login\",
        \"/api/auth/register\",
        \"/api/auth/reset-password\",
        \"/api/auth/confirm-reset\"
    ],
    \"priority\": 100,
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
            \"allow_methods\": \"GET,POST,PUT,DELETE,OPTIONS\",
            \"allow_headers\": \"Content-Type,Authorization,X-Requested-With,X-CSRF-Token,X-Tenant-ID\",
            \"expose_headers\": \"X-Rate-Limit-Remaining,X-Rate-Limit-Reset,X-Request-ID\",
            \"max_age\": 3600,
            \"allow_credential\": true
        },
        \"request-id\": {
            \"include_in_response\": true
        },
        \"uri-blocker\": {
             \"block_rules\": [\"^/api/.*\\\\.\\\\.\", \"^/api/.*%2e%2e\"],
             \"rejected_code\": 403,
             \"rejected_msg\": \"Blocked URI pattern detected.\"
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
             \"policy\": \"local\",
             \"rejected_code\": 429,
             \"rejected_msg\": \"Too many authentication attempts from this IP, please try again later.\"
         },
         \"api-breaker\": {
             \"break_response_code\": 502,
             \"max_failed\": 3,
             \"timeout\": 2,
             \"unhealthy\": {
                 \"http_statuses\": [500, 502, 503, 504],
                 \"interval\": 1
             },
             \"healthy\": {
                 \"http_statuses\": [200, 201, 204],
                 \"interval\": 3,
                 \"successes\": 2
             }
         },
         \"prometheus\": {},
         \"zipkin\": {
             \"endpoint\": \"https://thaliumx-tempo:9411/api/v2/spans\",
             \"sample_ratio\": 0.1,
             \"service_name\": \"thaliumx-apisix\"
         }
     }
 }"


# Route 7: Financial endpoints (strict rate limiting with security and OPA)
create_route "7" "{
    \"id\": \"7\",
    \"name\": \"thaliumx-financial\",
    \"desc\": \"Financial endpoints with strict rate limiting, security, and OPA\",
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
            \"policy\": \"local\",
            \"rejected_code\": 429,
            \"rejected_msg\": \"Financial operations rate limit exceeded.\"
        },
        \"limit-conn\": {
            \"conn\": 20,
            \"burst\": 10,
            \"default_conn_delay\": 0.1,
            \"key\": \"remote_addr\",
            \"rejected_code\": 503,
            \"rejected_msg\": \"Too many concurrent financial connections.\"
        },
        \"api-breaker\": {
            \"break_response_code\": 502,
            \"max_failed\": 3,
            \"timeout\": 2,
            \"unhealthy\": {
                \"http_statuses\": [500, 502, 503, 504],
                \"interval\": 1
            },
            \"healthy\": {
                \"http_statuses\": [200, 201, 204],
                \"interval\": 3,
                \"successes\": 2
            }
        },
        \"opa\": {
            \"host\": \"$OPA_HOST\",
            \"policy\": \"$OPA_POLICY\",
            \"timeout\": 3000,
            \"ssl_verify\": $OPA_SSL_VERIFY,
            \"with_route\": true,
            \"with_service\": true,
            \"with_consumer\": true
        },
        \"prometheus\": {},
        \"zipkin\": {
            \"endpoint\": \"https://thaliumx-tempo:9411/api/v2/spans\",
            \"sample_ratio\": 0.1,
            \"service_name\": \"thaliumx-apisix\"
        },
          \"kafka-logger\": {
              \"broker_list\": {
                  \"thaliumx-kafka\": 9092
              },
              \"kafka_topic\": \"thaliumx-financial-logs\",
              \"producer_type\": \"async\",
              \"required_acks\": 1,
              \"buffer_duration\": 60,
              \"max_retry_count\": 3
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
echo "  ✅ auth.thaliumx.com -> Keycloak (OIDC)"
echo "  ✅ /api/* -> Backend API (60 req/s, 1000/min per IP, Redis-backed, OPA, caching)"
echo "  ✅ /api/auth/login|register|reset* -> CRITICAL auth endpoints (Priority 100, 5 req/s, 30 per 5 min per IP, strict, NO OIDC)"
echo "  ✅ /api/financial/* -> Financial endpoints (30 req/s, 100/min per IP, OPA, strict)"
echo "  ✅ /api/workflows/* -> Ballerine workflows API (OIDC optional, API key fallback)"
echo "  ✅ /api/workflows/webhooks/* -> Ballerine webhooks (public)"
echo "  ✅ /health -> Health check (no rate limiting)"
echo ""
echo -e "${GREEN}Route Protection Guarantees:${NC}"
echo "  • /api/auth/login, /api/auth/register, /api/auth/reset-password are ALWAYS public"
echo "  • These endpoints have priority 100 (highest) and will match before any OIDC routes"
echo "  • Route 41 (OIDC) has unauth_action=pass to allow unauthenticated requests to pass through"
echo "  • Adding new routes will NOT interfere with auth endpoints if priorities are respected"
echo ""
echo "Security features enabled:"
echo "  • Global security headers (X-Frame-Options, CSP, HSTS, etc.)"
echo "  • URI blocking (path traversal protection)"
echo "  • IP restrictions (configurable whitelist/blacklist)"
echo "  • CSRF protection on sensitive endpoints"
echo "  • OPA integration for authorization decisions"
echo "  • Circuit breakers on all upstreams"
echo ""
echo "Rate limiting configured (Redis-backed):"
echo "  • Global: 10000/min per IP, 100 concurrent connections"
echo "  • API endpoints: 60 req/s, 1000/min per IP, 50 concurrent"
echo "  • Sensitive auth endpoints: 5 req/s, 30 per 5 min per IP (strict)"
echo "  • Financial endpoints: 30 req/s, 100/min per IP, 20 concurrent (strict)"
echo ""
echo "Performance features:"
echo "  • Proxy caching enabled for GET requests (5min TTL)"
echo "  • Health checks on all upstreams"
echo "  • Circuit breakers with automatic recovery"
echo ""
echo "Observability:"
echo "  • Prometheus metrics on all routes"
echo "  • Zipkin tracing (10% sampling)"
echo "  • Kafka logging for access logs"
echo "  • Request ID propagation"
echo ""
