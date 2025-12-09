#!/bin/bash

# ThaliumX APISIX Gateway - Complete Route Configuration
# ======================================================
# This script configures all routes for the ThaliumX platform including:
# - Main landing page (thaliumx.com)
# - Token presale page (thal.thaliumx.com)
# - API endpoints
# - Platform Admin Dashboard
# - Broker Admin Dashboard
# - User Dashboard
# - Health checks
# - WebSocket connections

set -e

APISIX_ADMIN_URL="${APISIX_ADMIN_URL:-http://localhost:9180}"
APISIX_ADMIN_KEY="${APISIX_ADMIN_KEY:-thaliumx-admin-key}"
FRONTEND_UPSTREAM="${FRONTEND_UPSTREAM:-thaliumx-frontend:3000}"
BACKEND_UPSTREAM="${BACKEND_UPSTREAM:-thaliumx-backend:3002}"

echo "=============================================="
echo "ThaliumX APISIX Route Configuration"
echo "=============================================="
echo "Admin URL: $APISIX_ADMIN_URL"
echo "Frontend: $FRONTEND_UPSTREAM"
echo "Backend: $BACKEND_UPSTREAM"
echo ""

# Function to create or update a route
create_route() {
    local route_id=$1
    local route_data=$2
    
    echo "Creating/Updating route $route_id..."
    
    response=$(curl -s -w "\n%{http_code}" -X PUT "$APISIX_ADMIN_URL/apisix/admin/routes/$route_id" \
        -H "X-API-KEY: $APISIX_ADMIN_KEY" \
        -H "Content-Type: application/json" \
        -d "$route_data")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo "  ✅ Route $route_id configured successfully"
    else
        echo "  ❌ Failed to configure route $route_id (HTTP $http_code)"
        echo "  Response: $body"
    fi
}

# Function to create or update an upstream
create_upstream() {
    local upstream_id=$1
    local upstream_data=$2
    
    echo "Creating/Updating upstream $upstream_id..."
    
    response=$(curl -s -w "\n%{http_code}" -X PUT "$APISIX_ADMIN_URL/apisix/admin/upstreams/$upstream_id" \
        -H "X-API-KEY: $APISIX_ADMIN_KEY" \
        -H "Content-Type: application/json" \
        -d "$upstream_data")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo "  ✅ Upstream $upstream_id configured successfully"
    else
        echo "  ❌ Failed to configure upstream $upstream_id (HTTP $http_code)"
        echo "  Response: $body"
    fi
}

echo ""
echo "Step 1: Configuring Upstreams"
echo "--------------------------------------------"

# Upstream 1: Frontend (Next.js)
create_upstream "1" '{
    "id": "1",
    "name": "frontend-upstream",
    "type": "roundrobin",
    "scheme": "http",
    "nodes": {
        "'$FRONTEND_UPSTREAM'": 1
    },
    "timeout": {
        "connect": 6,
        "send": 6,
        "read": 6
    },
    "retries": 2,
    "pass_host": "pass"
}'

# Upstream 2: Backend (Express API)
create_upstream "2" '{
    "id": "2",
    "name": "backend-upstream",
    "type": "roundrobin",
    "scheme": "http",
    "nodes": {
        "'$BACKEND_UPSTREAM'": 1
    },
    "timeout": {
        "connect": 6,
        "send": 6,
        "read": 6
    },
    "retries": 2,
    "pass_host": "pass"
}'

# Upstream 3: WebSocket (for real-time trading)
create_upstream "3" '{
    "id": "3",
    "name": "websocket-upstream",
    "type": "roundrobin",
    "scheme": "http",
    "nodes": {
        "'$BACKEND_UPSTREAM'": 1
    },
    "timeout": {
        "connect": 60,
        "send": 60,
        "read": 60
    },
    "retries": 1,
    "pass_host": "pass"
}'

echo ""
echo "Step 2: Configuring Routes"
echo "--------------------------------------------"

# Route 1: Main landing page - thaliumx.com
create_route "1" '{
    "id": "1",
    "name": "thaliumx-main",
    "desc": "Main landing page - thaliumx.com",
    "host": "thaliumx.com",
    "uri": "/*",
    "priority": 10,
    "status": 1,
    "upstream_id": "1",
    "plugins": {
        "redirect": {
            "http_to_https": true,
            "ret_code": 302
        }
    }
}'

# Route 2: WWW redirect
create_route "2" '{
    "id": "2",
    "name": "thaliumx-www-redirect",
    "desc": "Redirect www to non-www",
    "host": "www.thaliumx.com",
    "uri": "/*",
    "priority": 10,
    "status": 1,
    "plugins": {
        "redirect": {
            "uri": "https://thaliumx.com$request_uri",
            "ret_code": 301
        }
    }
}'

# Route 3: Token presale page - thal.thaliumx.com
create_route "3" '{
    "id": "3",
    "name": "thaliumx-presale",
    "desc": "Token presale page - thal.thaliumx.com",
    "host": "thal.thaliumx.com",
    "uri": "/*",
    "priority": 10,
    "status": 1,
    "upstream_id": "1",
    "plugins": {
        "redirect": {
            "http_to_https": true,
            "ret_code": 302
        },
        "proxy-rewrite": {
            "uri": "/token-presale$request_uri"
        }
    }
}'

# Route 4: API endpoints
create_route "4" '{
    "id": "4",
    "name": "thaliumx-api",
    "desc": "API endpoints",
    "hosts": ["thaliumx.com", "thal.thaliumx.com", "api.thaliumx.com"],
    "uri": "/api/*",
    "priority": 20,
    "status": 1,
    "upstream_id": "2",
    "plugins": {
        "redirect": {
            "http_to_https": true,
            "ret_code": 302
        },
        "cors": {
            "allow_origins": "https://thaliumx.com,https://thal.thaliumx.com,https://api.thaliumx.com",
            "allow_methods": "GET,POST,PUT,DELETE,OPTIONS,PATCH",
            "allow_headers": "Content-Type,Authorization,X-Requested-With,X-API-Key,X-Tenant-ID,X-Broker-ID",
            "expose_headers": "X-Rate-Limit-Remaining,X-Rate-Limit-Reset,X-Request-ID",
            "max_age": 3600,
            "allow_credential": true
        },
        "request-id": {
            "include_in_response": true
        }
    }
}'

# Route 5: Health check endpoint
create_route "5" '{
    "id": "5",
    "name": "health-check",
    "desc": "Health check endpoint",
    "uri": "/health",
    "methods": ["GET"],
    "priority": 100,
    "status": 1,
    "plugins": {
        "serverless-pre-function": {
            "phase": "access",
            "functions": ["return function() ngx.say(\"{\\\"status\\\":\\\"healthy\\\"}\") end"]
        }
    }
}'

# Route 6: Platform Admin Dashboard
create_route "6" '{
    "id": "6",
    "name": "platform-admin-dashboard",
    "desc": "Platform Admin Dashboard - /admin/*",
    "hosts": ["thaliumx.com"],
    "uri": "/admin/*",
    "priority": 15,
    "status": 1,
    "upstream_id": "1",
    "plugins": {
        "redirect": {
            "http_to_https": true,
            "ret_code": 302
        },
        "cors": {
            "allow_origins": "https://thaliumx.com",
            "allow_methods": "GET,POST,PUT,DELETE,OPTIONS",
            "allow_headers": "Content-Type,Authorization,X-Requested-With",
            "max_age": 3600,
            "allow_credential": true
        }
    }
}'

# Route 7: Broker Admin Dashboard
create_route "7" '{
    "id": "7",
    "name": "broker-admin-dashboard",
    "desc": "Broker Admin Dashboard - /broker/*",
    "hosts": ["thaliumx.com", "*.thaliumx.com"],
    "uri": "/broker/*",
    "priority": 15,
    "status": 1,
    "upstream_id": "1",
    "plugins": {
        "redirect": {
            "http_to_https": true,
            "ret_code": 302
        },
        "cors": {
            "allow_origins": "https://thaliumx.com,https://*.thaliumx.com",
            "allow_methods": "GET,POST,PUT,DELETE,OPTIONS",
            "allow_headers": "Content-Type,Authorization,X-Requested-With,X-Broker-ID",
            "max_age": 3600,
            "allow_credential": true
        }
    }
}'

# Route 8: User Dashboard
create_route "8" '{
    "id": "8",
    "name": "user-dashboard",
    "desc": "User Dashboard - /dashboard/*",
    "hosts": ["thaliumx.com", "*.thaliumx.com"],
    "uri": "/dashboard/*",
    "priority": 15,
    "status": 1,
    "upstream_id": "1",
    "plugins": {
        "redirect": {
            "http_to_https": true,
            "ret_code": 302
        },
        "cors": {
            "allow_origins": "https://thaliumx.com,https://*.thaliumx.com",
            "allow_methods": "GET,POST,PUT,DELETE,OPTIONS",
            "allow_headers": "Content-Type,Authorization,X-Requested-With",
            "max_age": 3600,
            "allow_credential": true
        }
    }
}'

# Route 9: Authentication pages
create_route "9" '{
    "id": "9",
    "name": "auth-pages",
    "desc": "Authentication pages - /auth/*",
    "hosts": ["thaliumx.com", "*.thaliumx.com"],
    "uri": "/auth/*",
    "priority": 15,
    "status": 1,
    "upstream_id": "1",
    "plugins": {
        "redirect": {
            "http_to_https": true,
            "ret_code": 302
        },
        "cors": {
            "allow_origins": "https://thaliumx.com,https://*.thaliumx.com",
            "allow_methods": "GET,POST,OPTIONS",
            "allow_headers": "Content-Type,Authorization,X-Requested-With",
            "max_age": 3600,
            "allow_credential": true
        }
    }
}'

# Route 10: Portfolio page
create_route "10" '{
    "id": "10",
    "name": "portfolio-page",
    "desc": "Portfolio page - /portfolio/*",
    "hosts": ["thaliumx.com", "*.thaliumx.com"],
    "uri": "/portfolio/*",
    "priority": 15,
    "status": 1,
    "upstream_id": "1",
    "plugins": {
        "redirect": {
            "http_to_https": true,
            "ret_code": 302
        }
    }
}'

# Route 11: Vesting page
create_route "11" '{
    "id": "11",
    "name": "vesting-page",
    "desc": "Vesting page - /vesting/*",
    "hosts": ["thaliumx.com", "thal.thaliumx.com"],
    "uri": "/vesting/*",
    "priority": 15,
    "status": 1,
    "upstream_id": "1",
    "plugins": {
        "redirect": {
            "http_to_https": true,
            "ret_code": 302
        }
    }
}'

# Route 12: Landing page
create_route "12" '{
    "id": "12",
    "name": "landing-page",
    "desc": "Landing page - /landing/*",
    "hosts": ["thaliumx.com"],
    "uri": "/landing/*",
    "priority": 15,
    "status": 1,
    "upstream_id": "1",
    "plugins": {
        "redirect": {
            "http_to_https": true,
            "ret_code": 302
        }
    }
}'

# Route 13: WebSocket connections for real-time trading
create_route "13" '{
    "id": "13",
    "name": "websocket-trading",
    "desc": "WebSocket connections for real-time trading",
    "hosts": ["thaliumx.com", "*.thaliumx.com", "ws.thaliumx.com"],
    "uri": "/socket.io/*",
    "priority": 25,
    "status": 1,
    "upstream_id": "3",
    "plugins": {
        "proxy-rewrite": {
            "headers": {
                "Connection": "Upgrade",
                "Upgrade": "websocket"
            }
        }
    }
}'

# Route 14: Broker API endpoints
create_route "14" '{
    "id": "14",
    "name": "broker-api",
    "desc": "Broker-specific API endpoints",
    "hosts": ["thaliumx.com", "*.thaliumx.com"],
    "uri": "/api/broker/*",
    "priority": 25,
    "status": 1,
    "upstream_id": "2",
    "plugins": {
        "redirect": {
            "http_to_https": true,
            "ret_code": 302
        },
        "cors": {
            "allow_origins": "https://thaliumx.com,https://*.thaliumx.com",
            "allow_methods": "GET,POST,PUT,DELETE,OPTIONS",
            "allow_headers": "Content-Type,Authorization,X-Requested-With,X-Broker-ID,X-Tenant-ID",
            "expose_headers": "X-Rate-Limit-Remaining,X-Rate-Limit-Reset",
            "max_age": 3600,
            "allow_credential": true
        },
        "request-id": {
            "include_in_response": true
        }
    }
}'

# Route 15: Admin API endpoints
create_route "15" '{
    "id": "15",
    "name": "admin-api",
    "desc": "Admin API endpoints",
    "hosts": ["thaliumx.com"],
    "uri": "/api/admin/*",
    "priority": 25,
    "status": 1,
    "upstream_id": "2",
    "plugins": {
        "redirect": {
            "http_to_https": true,
            "ret_code": 302
        },
        "cors": {
            "allow_origins": "https://thaliumx.com",
            "allow_methods": "GET,POST,PUT,DELETE,OPTIONS",
            "allow_headers": "Content-Type,Authorization,X-Requested-With",
            "expose_headers": "X-Rate-Limit-Remaining,X-Rate-Limit-Reset",
            "max_age": 3600,
            "allow_credential": true
        },
        "request-id": {
            "include_in_response": true
        },
        "limit-count": {
            "count": 1000,
            "time_window": 60,
            "rejected_code": 429,
            "key": "remote_addr"
        }
    }
}'

# Route 16: Metrics endpoint (protected)
create_route "16" '{
    "id": "16",
    "name": "metrics-endpoint",
    "desc": "Prometheus metrics endpoint",
    "hosts": ["thaliumx.com"],
    "uri": "/metrics",
    "methods": ["GET"],
    "priority": 100,
    "status": 1,
    "upstream_id": "2",
    "plugins": {
        "ip-restriction": {
            "whitelist": ["127.0.0.1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]
        }
    }
}'

# Route 17: Static assets
create_route "17" '{
    "id": "17",
    "name": "static-assets",
    "desc": "Static assets (images, fonts, etc.)",
    "hosts": ["thaliumx.com", "*.thaliumx.com"],
    "uri": "/_next/*",
    "priority": 5,
    "status": 1,
    "upstream_id": "1",
    "plugins": {
        "proxy-cache": {
            "cache_zone": "disk_cache_one",
            "cache_key": ["$host", "$request_uri"],
            "cache_bypass": ["$arg_nocache"],
            "cache_method": ["GET"],
            "cache_http_status": [200, 301, 404],
            "hide_cache_headers": false,
            "no_cache": ["$arg_nocache"]
        }
    }
}'

# Route 18: Public assets
create_route "18" '{
    "id": "18",
    "name": "public-assets",
    "desc": "Public assets",
    "hosts": ["thaliumx.com", "*.thaliumx.com"],
    "uri": "/public/*",
    "priority": 5,
    "status": 1,
    "upstream_id": "1"
}'

# Route 19: Favicon
create_route "19" '{
    "id": "19",
    "name": "favicon",
    "desc": "Favicon",
    "hosts": ["thaliumx.com", "*.thaliumx.com"],
    "uri": "/favicon.ico",
    "priority": 5,
    "status": 1,
    "upstream_id": "1"
}'

# Route 20: Robots.txt
create_route "20" '{
    "id": "20",
    "name": "robots-txt",
    "desc": "Robots.txt",
    "hosts": ["thaliumx.com", "*.thaliumx.com"],
    "uri": "/robots.txt",
    "priority": 5,
    "status": 1,
    "upstream_id": "1"
}'

# Route 21: Sitemap
create_route "21" '{
    "id": "21",
    "name": "sitemap",
    "desc": "Sitemap",
    "hosts": ["thaliumx.com"],
    "uri": "/sitemap.xml",
    "priority": 5,
    "status": 1,
    "upstream_id": "1"
}'

# Route 22: RBAC Admin page
create_route "22" '{
    "id": "22",
    "name": "rbac-admin",
    "desc": "RBAC Admin page",
    "hosts": ["thaliumx.com"],
    "uri": "/admin/rbac/*",
    "priority": 16,
    "status": 1,
    "upstream_id": "1",
    "plugins": {
        "redirect": {
            "http_to_https": true,
            "ret_code": 302
        }
    }
}'

# Route 23: Policy Management page
create_route "23" '{
    "id": "23",
    "name": "policy-management",
    "desc": "Policy Management page",
    "hosts": ["thaliumx.com"],
    "uri": "/admin/policies/*",
    "priority": 16,
    "status": 1,
    "upstream_id": "1",
    "plugins": {
        "redirect": {
            "http_to_https": true,
            "ret_code": 302
        }
    }
}'

# Route 24: Broker subdomain routing (wildcard)
create_route "24" '{
    "id": "24",
    "name": "broker-subdomain",
    "desc": "Broker subdomain routing",
    "host": "*.broker.thaliumx.com",
    "uri": "/*",
    "priority": 8,
    "status": 1,
    "upstream_id": "1",
    "plugins": {
        "redirect": {
            "http_to_https": true,
            "ret_code": 302
        },
        "proxy-rewrite": {
            "headers": {
                "X-Broker-Domain": "$host"
            }
        }
    }
}'

# Route 25: API documentation
create_route "25" '{
    "id": "25",
    "name": "api-docs",
    "desc": "API documentation",
    "hosts": ["thaliumx.com", "api.thaliumx.com"],
    "uri": "/api/docs",
    "methods": ["GET"],
    "priority": 30,
    "status": 1,
    "upstream_id": "2"
}'

echo ""
echo "Step 3: Verifying Configuration"
echo "--------------------------------------------"

# List all routes
echo "Configured routes:"
curl -s "$APISIX_ADMIN_URL/apisix/admin/routes" \
    -H "X-API-KEY: $APISIX_ADMIN_KEY" | python3 -c "
import json, sys
data = json.load(sys.stdin)
routes = data.get('list', [])
print(f'Total routes: {len(routes)}')
for route in routes:
    r = route.get('value', {})
    print(f\"  - {r.get('id')}: {r.get('name')} ({r.get('uri')})\")
" 2>/dev/null || echo "  (Unable to parse routes)"

# List all upstreams
echo ""
echo "Configured upstreams:"
curl -s "$APISIX_ADMIN_URL/apisix/admin/upstreams" \
    -H "X-API-KEY: $APISIX_ADMIN_KEY" | python3 -c "
import json, sys
data = json.load(sys.stdin)
upstreams = data.get('list', [])
print(f'Total upstreams: {len(upstreams)}')
for upstream in upstreams:
    u = upstream.get('value', {})
    print(f\"  - {u.get('id')}: {u.get('name')} ({list(u.get('nodes', {}).keys())})\")
" 2>/dev/null || echo "  (Unable to parse upstreams)"

echo ""
echo "=============================================="
echo "Route Configuration Complete!"
echo "=============================================="
echo ""
echo "Dashboard Routes:"
echo "  - Platform Admin: https://thaliumx.com/admin"
echo "  - Broker Admin:   https://thaliumx.com/broker"
echo "  - User Dashboard: https://thaliumx.com/dashboard"
echo "  - Token Presale:  https://thal.thaliumx.com"
echo ""
echo "API Routes:"
echo "  - Main API:       https://thaliumx.com/api/*"
echo "  - Admin API:      https://thaliumx.com/api/admin/*"
echo "  - Broker API:     https://thaliumx.com/api/broker/*"
echo ""
echo "WebSocket:"
echo "  - Trading WS:     wss://thaliumx.com/socket.io"
echo ""