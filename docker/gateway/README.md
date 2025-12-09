# ThaliumX API Gateway

This directory contains the APISIX API Gateway configuration for ThaliumX.

## Overview

The gateway uses:
- **APISIX**: High-performance API gateway
- **etcd**: Configuration storage backend

## Directory Structure

```
gateway/
├── compose.yaml           # Docker Compose configuration
├── config/
│   ├── apisix.yaml        # APISIX main configuration
│   └── ssl/               # SSL certificates directory
│       ├── fullchain.pem  # Certificate chain (from Let's Encrypt)
│       └── privkey.pem    # Private key (from Let's Encrypt)
├── scripts/
│   └── configure-routes.sh # Route configuration script
└── README.md
```

## Domain Routing

| Domain | Destination | Description |
|--------|-------------|-------------|
| `thaliumx.com` | Frontend (/) | Main landing page |
| `www.thaliumx.com` | Redirect → thaliumx.com | WWW redirect |
| `thal.thaliumx.com` | Frontend (/token-presale) | Token presale page |
| `*/api/*` | Backend | API endpoints |

## Quick Start

### 1. Start the Gateway

```bash
cd docker/gateway
docker compose up -d
```

### 2. Configure Routes

```bash
# Without SSL
./scripts/configure-routes.sh

# With SSL (after obtaining certificates)
./scripts/configure-routes.sh --ssl
```

### 3. Verify Configuration

```bash
# Check APISIX status
curl http://localhost:9080/apisix/status

# List configured routes
curl -H "X-API-KEY: thaliumx-admin-key" http://localhost:9180/apisix/admin/routes
```

## SSL Configuration

### Obtaining Certificates

1. First, obtain SSL certificates using the ssl-certs service:

```bash
cd ../ssl-certs
./scripts/obtain-certs.sh
```

2. Copy certificates to the gateway:

```bash
cp ../ssl-certs/data/certbot/conf/live/thaliumx.com/fullchain.pem config/ssl/
cp ../ssl-certs/data/certbot/conf/live/thaliumx.com/privkey.pem config/ssl/
```

3. Configure routes with SSL:

```bash
./scripts/configure-routes.sh --ssl
```

### Manual SSL Configuration

You can also configure SSL via the Admin API:

```bash
# Read certificate files
CERT=$(cat config/ssl/fullchain.pem)
KEY=$(cat config/ssl/privkey.pem)

# Create SSL configuration
curl -X PUT http://localhost:9180/apisix/admin/ssls/1 \
  -H "X-API-KEY: thaliumx-admin-key" \
  -H "Content-Type: application/json" \
  -d "{
    \"cert\": \"$CERT\",
    \"key\": \"$KEY\",
    \"snis\": [\"thaliumx.com\", \"www.thaliumx.com\", \"thal.thaliumx.com\"]
  }"
```

## Ports

| Port | Protocol | Description |
|------|----------|-------------|
| 80 | HTTP | Public HTTP (redirects to HTTPS) |
| 443 | HTTPS | Public HTTPS |
| 9080 | HTTP | Internal HTTP |
| 9180 | HTTP | Admin API |
| 9443 | HTTPS | Internal HTTPS |
| 2379 | HTTP | etcd client |

## Admin API

The APISIX Admin API is available at `http://localhost:9180/apisix/admin`.

### Authentication

All Admin API requests require the `X-API-KEY` header:

```bash
curl -H "X-API-KEY: thaliumx-admin-key" http://localhost:9180/apisix/admin/routes
```

### Common Operations

```bash
# List all routes
curl -H "X-API-KEY: thaliumx-admin-key" http://localhost:9180/apisix/admin/routes

# List all upstreams
curl -H "X-API-KEY: thaliumx-admin-key" http://localhost:9180/apisix/admin/upstreams

# List SSL certificates
curl -H "X-API-KEY: thaliumx-admin-key" http://localhost:9180/apisix/admin/ssls

# Get specific route
curl -H "X-API-KEY: thaliumx-admin-key" http://localhost:9180/apisix/admin/routes/1

# Delete a route
curl -X DELETE -H "X-API-KEY: thaliumx-admin-key" http://localhost:9180/apisix/admin/routes/1
```

## Route Configuration Details

### Route 1: Main Landing Page (thaliumx.com)

```json
{
  "name": "thaliumx-main",
  "uri": "/*",
  "host": "thaliumx.com",
  "upstream_id": 1,
  "plugins": {
    "redirect": {
      "http_to_https": true
    }
  }
}
```

### Route 2: WWW Redirect

```json
{
  "name": "thaliumx-www-redirect",
  "uri": "/*",
  "host": "www.thaliumx.com",
  "plugins": {
    "redirect": {
      "uri": "https://thaliumx.com$request_uri",
      "ret_code": 301
    }
  }
}
```

### Route 3: Token Presale (thal.thaliumx.com)

```json
{
  "name": "thaliumx-presale",
  "uri": "/*",
  "host": "thal.thaliumx.com",
  "upstream_id": 1,
  "plugins": {
    "redirect": {
      "http_to_https": true
    },
    "proxy-rewrite": {
      "uri": "/token-presale$request_uri"
    }
  }
}
```

### Route 4: API Endpoints

```json
{
  "name": "thaliumx-api",
  "uri": "/api/*",
  "hosts": ["thaliumx.com", "thal.thaliumx.com"],
  "upstream_id": 2,
  "plugins": {
    "cors": {
      "allow_origins": "https://thaliumx.com,https://thal.thaliumx.com",
      "allow_methods": "GET,POST,PUT,DELETE,OPTIONS",
      "allow_headers": "Content-Type,Authorization,X-Requested-With",
      "allow_credential": true
    }
  }
}
```

## Plugins

The gateway has the following plugins enabled:

- **redirect**: HTTP to HTTPS redirection
- **proxy-rewrite**: URL rewriting
- **cors**: Cross-Origin Resource Sharing
- **prometheus**: Metrics export
- **jwt-auth**: JWT authentication
- **key-auth**: API key authentication
- **limit-req**: Rate limiting
- **ip-restriction**: IP-based access control

## Monitoring

### Prometheus Metrics

Metrics are exported on port 9091:

```bash
curl http://localhost:9091/apisix/prometheus/metrics
```

### Health Check

```bash
curl http://localhost:9080/apisix/status
```

## Troubleshooting

### APISIX Won't Start

1. Check if etcd is running:
   ```bash
   docker compose logs etcd
   ```

2. Check APISIX logs:
   ```bash
   docker compose logs apisix
   ```

### Routes Not Working

1. Verify routes are configured:
   ```bash
   curl -H "X-API-KEY: thaliumx-admin-key" http://localhost:9180/apisix/admin/routes
   ```

2. Check upstream health:
   ```bash
   curl -H "X-API-KEY: thaliumx-admin-key" http://localhost:9180/apisix/admin/upstreams
   ```

### SSL Issues

1. Verify certificates are in place:
   ```bash
   ls -la config/ssl/
   ```

2. Check SSL configuration:
   ```bash
   curl -H "X-API-KEY: thaliumx-admin-key" http://localhost:9180/apisix/admin/ssls
   ```

3. Test HTTPS connection:
   ```bash
   curl -vk https://localhost:9443/
   ```

## Network Configuration

This service uses the `thaliumx-net` network for consistency with other ThaliumX services.

Container names:
- `thaliumx-apisix` - APISIX gateway
- `thaliumx-etcd` - etcd configuration store