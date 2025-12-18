#!/bin/bash
# ThaliumX APISIX Route Configuration Script
# ==========================================
# Configures APISIX routes, upstreams, and security policies
# Updated: 2025-12-17T13:19:45.000Z

set -e

APISIX_ADMIN_URL="http://127.0.0.1:9180"
APISIX_ADMIN_KEY="${APISIX_ADMIN_KEY:-eddi1n8m}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Wait for APISIX to be ready
wait_for_apisix() {
    log_info "Waiting for APISIX to be ready..."
    for i in {1..30}; do
        if curl -s -f -H "X-API-KEY: $APISIX_ADMIN_KEY" "$APISIX_ADMIN_URL/apisix/admin/routes" > /dev/null 2>&1; then
            log_info "APISIX is ready"
            return 0
        fi
        sleep 2
    done
    log_error "APISIX did not become ready in time"
    return 1
}

# Create upstream for backend service
create_backend_upstream() {
    log_step "Creating backend upstream..."

    curl -X PUT "$APISIX_ADMIN_URL/apisix/admin/upstreams/1" \
        -H "X-API-KEY: $APISIX_ADMIN_KEY" \
        -H "Content-Type: application/json" \
        -d '{
            "type": "roundrobin",
            "nodes": {
                "thaliumx-backend:3002": 1
            },
            "checks": {
                "active": {
                    "type": "http",
                    "http_path": "/health",
                    "host": "thaliumx-backend",
                    "port": 3002,
                    "healthy": {
                        "interval": 2000,
                        "successes": 2,
                        "http_statuses": [200, 206]
                    },
                    "unhealthy": {
                        "interval": 1000,
                        "http_failures": 5,
                        "tcp_failures": 2,
                        "timeouts": 3
                    }
                }
            },
            "scheme": "http",
            "pass_host": "node",
            "upstream_host": "thaliumx-backend"
        }'
}

# Create upstream for frontend service
create_frontend_upstream() {
    log_step "Creating frontend upstream..."

    curl -X PUT "$APISIX_ADMIN_URL/apisix/admin/upstreams/2" \
        -H "X-API-KEY: $APISIX_ADMIN_KEY" \
        -H "Content-Type: application/json" \
        -d '{
            "type": "roundrobin",
            "nodes": {
                "thaliumx-frontend:3000": 1
            },
            "checks": {
                "active": {
                    "type": "http",
                    "http_path": "/api/health",
                    "host": "thaliumx-frontend",
                    "port": 3000,
                    "healthy": {
                        "interval": 2000,
                        "successes": 2,
                        "http_statuses": [200, 206]
                    },
                    "unhealthy": {
                        "interval": 1000,
                        "http_failures": 5,
                        "tcp_failures": 2,
                        "timeouts": 3
                    }
                }
            },
            "scheme": "http",
            "pass_host": "node",
            "upstream_host": "thaliumx-frontend"
        }'
}

# Create consumer for API access
create_api_consumer() {
    log_step "Creating API consumer..."

    curl -X PUT "$APISIX_ADMIN_URL/apisix/admin/consumers/thaliumx-backend" \
        -H "X-API-KEY: $APISIX_ADMIN_KEY" \
        -H "Content-Type: application/json" \
        -d '{
            "username": "thaliumx-backend",
            "plugins": {
                "key-auth": {
                    "key": "backend-api-key-2025"
                }
            }
        }'
}

# Create SSL certificate for HTTPS
create_ssl_certificate() {
    log_step "Creating SSL certificate..."

    # Read certificate files
    CERT_FILE="/docker/certs/services/apisix/server.crt"
    KEY_FILE="/docker/certs/services/apisix/server.key"

    if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
        log_warn "Certificate files not found, skipping SSL setup"
        return 0
    fi

    CERT_CONTENT=$(cat "$CERT_FILE" | sed 's/$/\\n/' | tr -d '\n')
    KEY_CONTENT=$(cat "$KEY_FILE" | sed 's/$/\\n/' | tr -d '\n')

    curl -X PUT "$APISIX_ADMIN_URL/apisix/admin/ssl/1" \
        -H "X-API-KEY: $APISIX_ADMIN_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"cert\": \"$CERT_CONTENT\",
            \"key\": \"$KEY_CONTENT\",
            \"snis\": [\"api.thaliumx.com\", \"*.thaliumx.com\"]
        }"
}

# Create API routes
create_api_routes() {
    log_step "Creating API routes..."

    # Backend API route
    curl -X PUT "$APISIX_ADMIN_URL/apisix/admin/routes/1" \
        -H "X-API-KEY: $APISIX_ADMIN_KEY" \
        -H "Content-Type: application/json" \
        -d '{
            "uri": "/api/*",
            "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            "upstream_id": "1",
            "plugins": {
                "cors": {
                    "allow_origins": ["https://app.thaliumx.com", "https://staging.thaliumx.com"],
                    "allow_methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
                    "allow_headers": ["Authorization", "Content-Type", "X-Request-ID"],
                    "expose_headers": ["X-Request-ID"],
                    "max_age": 86400
                },
                "limit-count": {
                    "count": 1000,
                    "time_window": 60,
                    "rejected_code": 429,
                    "key": "remote_addr",
                    "policy": "local"
                },
                "request-id": {
                    "header_name": "X-Request-ID",
                    "include_in_response": true
                },
                "prometheus": {},
                "http-logger": {
                    "uri": "http://thaliumx-loki:3100/loki/api/v1/push",
                    "batch_max_size": 10,
                    "inactive_timeout": 5,
                    "buffer_duration": 60,
                    "max_retry_count": 3,
                    "retry_delay": 1,
                    "name": "http-logger",
                    "timeout": 3000,
                    "include_req_body": false,
                    "include_resp_body": false
                }
            }
        }'

    # Frontend route
    curl -X PUT "$APISIX_ADMIN_URL/apisix/admin/routes/2" \
        -H "X-API-KEY: $APISIX_ADMIN_KEY" \
        -H "Content-Type: application/json" \
        -d '{
            "uri": "/*",
            "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            "upstream_id": "2",
            "plugins": {
                "cors": {
                    "allow_origins": ["https://app.thaliumx.com", "https://staging.thaliumx.com"],
                    "allow_methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
                    "allow_headers": ["Authorization", "Content-Type", "X-Request-ID"],
                    "expose_headers": ["X-Request-ID"],
                    "max_age": 86400
                },
                "limit-count": {
                    "count": 500,
                    "time_window": 60,
                    "rejected_code": 429,
                    "key": "remote_addr",
                    "policy": "local"
                },
                "request-id": {
                    "header_name": "X-Request-ID",
                    "include_in_response": true
                },
                "prometheus": {},
                "http-logger": {
                    "uri": "http://thaliumx-loki:3100/loki/api/v1/push",
                    "batch_max_size": 10,
                    "inactive_timeout": 5,
                    "buffer_duration": 60,
                    "max_retry_count": 3,
                    "retry_delay": 1,
                    "name": "http-logger",
                    "timeout": 3000,
                    "include_req_body": false,
                    "include_resp_body": false
                }
            }
        }'
}

# Create global rules
create_global_rules() {
    log_step "Creating global security rules..."

    # Global rate limiting
    curl -X PUT "$APISIX_ADMIN_URL/apisix/admin/global_rules/1" \
        -H "X-API-KEY: $APISIX_ADMIN_KEY" \
        -H "Content-Type: application/json" \
        -d '{
            "plugins": {
                "limit-count": {
                    "count": 10000,
                    "time_window": 60,
                    "rejected_code": 429,
                    "key": "remote_addr",
                    "policy": "local"
                },
                "ip-restriction": {
                    "blacklist": []
                },
                "cors": {
                    "allow_origins": ["*"],
                    "allow_methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
                    "allow_headers": ["*"],
                    "expose_headers": ["X-Request-ID"],
                    "max_age": 86400
                }
            }
        }'
}

# Main execution
main() {
    log_info "Starting APISIX route configuration..."

    wait_for_apisix

    create_backend_upstream
    create_frontend_upstream
    create_api_consumer
    create_ssl_certificate
    create_api_routes
    create_global_rules

    log_info "APISIX route configuration complete!"
    log_info "API Gateway is now configured and ready for traffic"
}

main "$@"</content>
</xai:function_call"> 

Assistant: Now let me update the todo list to mark the completed tasks and continue with the remaining ones. Let me also create a script to initialize APISIX after deployment. But first, let me check if there are any TypeScript files that need to be configured for APISIX plugins. Since the user mentioned "strict TS if applicable", let me check if there are any TypeScript configurations for APISIX plugins. 

Looking at the APISIX config, it mentions authz-keycloak plugin, so let me check if there are any custom plugins or TypeScript configurations. But APISIX is primarily Lua-based, so TypeScript might not be applicable here. Let me focus on completing the APISIX setup. 

Let me update the todo list. 

Mark the first few as completed. 

Then, create a documentation file for APISIX. 

Let me update the todo. 

Mark:

- Update APISIX production configuration with TLS certificates ✓

- Configure etcd with TLS for secure communication ✓

- Add APISIX to prod-v1 gateway compose file ✓

- Configure Keycloak integration plugins (in config)

- Set up rate limiting and security policies (in script)

- Configure upstream services (in script)

- Enable comprehensive logging and monitoring ✓

- Test APISIX deployment and health checks

- Document APISIX production configuration

Let me update the todo. 

Then, create documentation. 

Then, test the deployment. 

Let me update the todo. 

<xai:function_call name="update_todo_list">
<parameter name="todos">[x] Update APISIX production configuration with TLS certificates\n[x] Configure etcd with TLS for secure communication\n[x] Add APISIX to prod-v1 gateway compose file\n[x] Configure Keycloak integration plugins\n[x] Set up rate limiting and security policies\n[x] Configure upstream services (backend, frontend, etc.)\n[x] Enable comprehensive logging and monitoring\n[ ] Test APISIX deployment and health checks\n[ ] Document APISIX production configuration