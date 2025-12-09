# ThaliumX Docker Configuration

This directory contains all Docker Compose configurations and application source code for the ThaliumX platform.

## Table of Contents

1. [Directory Structure](#directory-structure)
2. [Quick Start](#quick-start)
3. [Service Groups](#service-groups)
4. [Building Images](#building-images)
5. [Development Workflow](#development-workflow)
6. [Configuration](#configuration)
7. [Troubleshooting](#troubleshooting)

---

## Directory Structure

```
docker/
├── compose.yaml              # Master orchestrator (includes all services)
├── package.json              # pnpm workspace root
├── pnpm-workspace.yaml       # Workspace configuration
│
├── shared/                   # Shared TypeScript package
│   ├── src/
│   │   ├── index.ts         # Main exports
│   │   └── types/           # Type definitions
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/             # Next.js App Router
│   │   ├── components/      # React components
│   │   └── lib/             # Utilities
│   ├── Dockerfile           # Multi-stage build
│   └── package.json
│
├── backend/                  # Express.js backend API
│   ├── src/
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── middleware/      # Express middleware
│   │   └── migrations/      # Database migrations
│   ├── Dockerfile           # Multi-stage build
│   └── package.json
│
├── core/                     # Core services compose
│   ├── compose.yaml         # Frontend + Backend
│   ├── core.env             # Environment variables
│   └── secrets/             # Local secrets (gitignored)
│
├── databases/                # Data layer
│   └── compose.yaml         # PostgreSQL, MongoDB, Redis
│
├── citus/                    # Multi-tenant distributed database
│   ├── compose.yaml         # Citus coordinator + workers
│   └── init/                # Initialization scripts
│       ├── 01-init-citus.sql
│       ├── 02-register-workers.sql
│       └── 03-distribute-tables.sql
│
├── messaging/                # Messaging layer
│   └── compose.yaml         # Kafka, Schema Registry
│
├── security/                 # Security layer
│   └── compose.yaml         # Keycloak, Vault, OPA
│
├── gateway/                  # Gateway layer
│   └── compose.yaml         # APISIX, etcd
│
├── observability/            # Observability layer
│   └── compose.yaml         # Prometheus, Grafana, Loki, Tempo
│
├── wazuh/                    # SIEM
│   ├── compose.yaml
│   └── scripts/             # Certificate generation
│
├── fintech/                  # Fintech services
│   └── compose.yaml         # Ballerine, BlinkFinance
│
├── trading/                  # Trading services
│   ├── compose.yaml         # Dingir, Liquibook, QuantLib
│   └── dingir/              # Dingir configuration
│
└── typesense/                # Search engine
    └── compose.yaml
```

---

## Quick Start

### Prerequisites

- Docker 24.0+
- Docker Compose v2.20+
- 16GB+ RAM recommended

### Start All Services

```bash
# Create network
docker network create --driver bridge --subnet 172.28.0.0/16 thaliumx-net

# Generate Wazuh certificates
cd wazuh && chmod +x scripts/generate-certs.sh && ./scripts/generate-certs.sh && cd ..

# Start all services
docker compose up -d

# Check status
docker ps --filter name=thaliumx --format "table {{.Names}}\t{{.Status}}"
```

### Start Individual Service Groups

```bash
# Start only databases
cd databases && docker compose up -d

# Start only core apps
cd core && docker compose up -d

# Start only trading
cd trading && docker compose up -d
```

---

## Service Groups

### Core Applications (`core/`)

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| frontend | thaliumx/frontend | 3001 | Next.js web application |
| backend | thaliumx/backend | 3002 | Express.js REST API |

**Build:**
```bash
cd core
docker compose build frontend backend
```

### Databases (`databases/`)

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| postgres | timescale/timescaledb | 5432 | PostgreSQL with TimescaleDB |
| mongodb | mongo:7 | 27017 | Document database |
| redis | redis:7-alpine | 6379 | Cache and pub/sub |

### Citus Multi-Tenant (`citus/`)

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| citus-coordinator | citusdata/citus:12.1 | 5434 | Distributed query coordinator |
| citus-worker-1 | citusdata/citus:12.1 | - | Data shard worker 1 |
| citus-worker-2 | citusdata/citus:12.1 | - | Data shard worker 2 |

**Multi-Tenant Features:**
- Tables distributed by `tenant_id` for isolation
- Reference tables replicated to all nodes
- 32 shards per distributed table
- Horizontal scaling by adding workers

### Messaging (`messaging/`)

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| kafka | confluentinc/cp-kafka | 9092 | Event streaming |
| schema-registry | confluentinc/cp-schema-registry | 8085 | Schema management |
| kafka-ui | provectuslabs/kafka-ui | 8081 | Kafka management UI |

### Security (`security/`)

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| keycloak | quay.io/keycloak/keycloak | 8080 | Identity management |
| vault | hashicorp/vault | 8200 | Secrets management |
| opa | openpolicyagent/opa | 8181 | Policy engine |

### Gateway (`gateway/`)

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| apisix | apache/apisix | 9080 | API gateway |
| etcd | bitnami/etcd | 2379 | Configuration store |
| apisix-dashboard | apache/apisix-dashboard | 9000 | Gateway UI |

### Observability (`observability/`)

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| prometheus | prom/prometheus | 9090 | Metrics collection |
| grafana | grafana/grafana | 3000 | Dashboards |
| loki | grafana/loki | 3100 | Log aggregation |
| tempo | grafana/tempo | 3200 | Distributed tracing |
| otel-collector | otel/opentelemetry-collector | 4317/4318 | Telemetry collection |

### Trading (`trading/`)

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| dingir-matchengine | thaliumx/dingir-matchengine | 50051 | Matching engine |
| dingir-restapi | thaliumx/dingir-restapi | 50053 | REST API |
| liquibook | thaliumx/liquibook | 8083 | Order book |
| quantlib | thaliumx/quantlib | 3010 | Financial analytics |

---

## Building Images

### Build All Custom Images

```bash
# Build core applications
cd core && docker compose build --no-cache

# Build trading services
cd trading && docker compose build --no-cache
```

### Build Individual Images

```bash
# Frontend
docker build -t thaliumx/frontend:latest -f frontend/Dockerfile .

# Backend
docker build -t thaliumx/backend:latest -f backend/Dockerfile .
```

### Multi-Architecture Builds

```bash
# Build for multiple platforms
docker buildx build --platform linux/amd64,linux/arm64 \
  -t thaliumx/backend:latest \
  -f backend/Dockerfile \
  --push .
```

---

## Development Workflow

### Local Development with pnpm

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run in development mode
pnpm dev

# Run tests
pnpm test

# Lint code
pnpm lint
```

### Workspace Commands

```bash
# Run command in specific package
pnpm --filter @thaliumx/frontend dev
pnpm --filter @thaliumx/backend build

# Run command in all packages
pnpm -r build
```

### Hot Reload Development

For development with hot reload, mount source code as volumes:

```yaml
# docker-compose.override.yaml
services:
  backend:
    volumes:
      - ./backend/src:/app/src
    command: ["pnpm", "dev"]
```

---

## Configuration

### Environment Variables

Each service group has its own environment file:

| File | Purpose |
|------|---------|
| `core/core.env` | Core application settings |
| `trading/trading.env` | Trading service settings |
| `databases/databases.env` | Database credentials |

### Core Environment Variables

```bash
# core/core.env
NODE_ENV=production
PORT=3002

# Database (Citus for multi-tenant)
DB_HOST=thaliumx-citus-coordinator
DB_PORT=5432
DB_NAME=thaliumx
DB_USER=thaliumx
DB_PASSWORD=ThaliumX2025

# Redis
REDIS_HOST=thaliumx-redis
REDIS_PORT=6379
REDIS_PASSWORD=ThaliumX2025

# Vault
VAULT_ADDR=http://thaliumx-vault:8200
VAULT_TOKEN=<VAULT_TOKEN>

# Keycloak
KEYCLOAK_URL=http://thaliumx-keycloak:8080
KEYCLOAK_REALM=thaliumx
KEYCLOAK_CLIENT_ID=thaliumx-backend
```

### Security Configuration

Security settings in `core/compose.yaml`:

```yaml
services:
  backend:
    # Run as non-root
    user: "1001:1001"
    
    # Read-only filesystem
    read_only: true
    
    # Drop all capabilities
    cap_drop:
      - ALL
    
    # Prevent privilege escalation
    security_opt:
      - no-new-privileges:true
    
    # Writable directories via tmpfs
    tmpfs:
      - /tmp:noexec,nosuid,nodev,size=100M,uid=1001,gid=1001
      - /app/logs:noexec,nosuid,nodev,size=100M,uid=1001,gid=1001
```

---

## Troubleshooting

### Common Issues

#### Container Won't Start

```bash
# Check logs
docker logs thaliumx-backend

# Check container status
docker inspect thaliumx-backend

# Check network connectivity
docker exec thaliumx-backend ping thaliumx-postgres
```

#### Permission Denied Errors

If you see permission errors with tmpfs mounts:

```yaml
# Ensure uid/gid match the container user
tmpfs:
  - /app/logs:noexec,nosuid,nodev,size=100M,uid=1001,gid=1001,mode=0770
```

#### Build Failures

```bash
# Clean build cache
docker builder prune -f

# Build with no cache
docker compose build --no-cache

# Check disk space
df -h
```

#### Network Issues

```bash
# Recreate network
docker network rm thaliumx-net
docker network create --driver bridge --subnet 172.28.0.0/16 thaliumx-net

# Verify network
docker network inspect thaliumx-net
```

### Health Checks

```bash
# Check all service health
docker ps --filter name=thaliumx --format "table {{.Names}}\t{{.Status}}"

# Test specific endpoints
curl http://localhost:3002/health
curl http://localhost:3001/api/health
```

### Logs

```bash
# View logs for a service
docker logs -f thaliumx-backend

# View logs for all services
docker compose logs -f

# View logs with timestamps
docker logs -t thaliumx-backend
```

### Resource Usage

```bash
# Check resource usage
docker stats --no-stream

# Check disk usage
docker system df
```

---

## Maintenance

### Cleanup

```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune

# Remove unused volumes (CAUTION: deletes data)
docker volume prune

# Full cleanup
docker system prune -a --volumes
```

### Backup

```bash
# Backup PostgreSQL (TimescaleDB)
docker exec thaliumx-postgres pg_dump -U thaliumx thaliumx > backup.sql

# Backup Citus (multi-tenant)
docker exec thaliumx-citus-coordinator pg_dump -U postgres thaliumx > citus-backup.sql

# Backup volumes
docker run --rm -v thaliumx-postgres-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz -C /data .
```

### Citus Management

```bash
# Check worker nodes
docker exec thaliumx-citus-coordinator psql -U postgres -d thaliumx \
  -c "SELECT * FROM citus_get_active_worker_nodes();"

# Check distributed tables
docker exec thaliumx-citus-coordinator psql -U postgres -d thaliumx \
  -c "SELECT * FROM citus_tables;"

# Add a new worker
docker exec thaliumx-citus-coordinator psql -U postgres -d thaliumx \
  -c "SELECT citus_add_node('thaliumx-citus-worker-3', 5432);"

# Rebalance shards
docker exec thaliumx-citus-coordinator psql -U postgres -d thaliumx \
  -c "SELECT rebalance_table_shards();"
```

### Updates

```bash
# Pull latest images
docker compose pull

# Rebuild custom images
docker compose build --no-cache

# Restart with new images
docker compose up -d
```

---

## References

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Next.js Docker](https://nextjs.org/docs/deployment#docker-image)
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)