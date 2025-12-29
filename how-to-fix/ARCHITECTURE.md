# ThaliumX Architecture Documentation

This document provides a comprehensive overview of the ThaliumX platform architecture.

## Table of Contents

1. [System Overview](#system-overview)
2. [Service Layers](#service-layers)
3. [Core Applications](#core-applications)
4. [Data Flow](#data-flow)
5. [Technology Stack](#technology-stack)
6. [Deployment Architecture](#deployment-architecture)
7. [Scalability Considerations](#scalability-considerations)

---

## System Overview

ThaliumX is a microservices-based financial platform built on Docker containers. The architecture follows a layered approach with clear separation of concerns.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              THALIUMX PLATFORM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        APPLICATION LAYER                             │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │   │
│  │  │  Frontend   │  │   Backend   │  │  Ballerine  │  │BlinkFinance│ │   │
│  │  │  (Next.js)  │  │  (Express)  │  │   (KYC)     │  │  (Ledger)  │ │   │
│  │  │  Port:3001  │  │  Port:3002  │  │  Port:3003  │  │  Port:5001 │ │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘ │   │
│  └─────────┼────────────────┼────────────────┼───────────────┼────────┘   │
│            │                │                │               │             │
│  ┌─────────┼────────────────┼────────────────┼───────────────┼────────┐   │
│  │         └────────────────┴────────────────┴───────────────┘        │   │
│  │                        TRADING LAYER                                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│  │  │   Dingir    │  │  Liquibook  │  │  QuantLib   │                 │   │
│  │  │  Exchange   │  │ Order Book  │  │  Analytics  │                 │   │
│  │  │ Port:50051  │  │  Port:8083  │  │  Port:3010  │                 │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                    │                                       │
│  ┌─────────────────────────────────┼──────────────────────────────────┐   │
│  │                        GATEWAY LAYER                                │   │
│  │                    ┌─────────────┐                                  │   │
│  │                    │   APISIX    │                                  │   │
│  │                    │   Gateway   │                                  │   │
│  │                    │  Port:9080  │                                  │   │
│  │                    └──────┬──────┘                                  │   │
│  │                           │                                         │   │
│  │  ┌─────────────┐  ┌──────┴──────┐  ┌─────────────┐                 │   │
│  │  │    etcd     │  │  Dashboard  │  │   Admin     │                 │   │
│  │  │  Port:2379  │  │  Port:9000  │  │  Port:9180  │                 │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                    │                                       │
│  ┌─────────────────────────────────┼──────────────────────────────────┐   │
│  │                       SECURITY LAYER                                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐│   │
│  │  │  Keycloak   │  │    Vault    │  │     OPA     │  │   Wazuh    ││   │
│  │  │    (IAM)    │  │  (Secrets)  │  │  (Policy)   │  │   (SIEM)   ││   │
│  │  │  Port:8080  │  │  Port:8200  │  │  Port:8181  │  │  Port:5601 ││   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘│   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                    │                                       │
│  ┌─────────────────────────────────┼──────────────────────────────────┐   │
│  │                         DATA LAYER                                  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐│   │
│  │  │ PostgreSQL  │  │    Citus    │  │   MongoDB   │  │   Redis    ││   │
│  │  │ TimescaleDB │  │Multi-Tenant │  │  (Document) │  │  (Cache)   ││   │
│  │  │  Port:5432  │  │  Port:5434  │  │  Port:27017 │  │  Port:6379 ││   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘│   │
│  │                                                      ┌────────────┐│   │
│  │                                                      │ Typesense  ││   │
│  │                                                      │  (Search)  ││   │
│  │                                                      │  Port:8108 ││   │
│  │                                                      └────────────┘│   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                    │                                       │
│  ┌─────────────────────────────────┼──────────────────────────────────┐   │
│  │                      MESSAGING LAYER                                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│  │  │    Kafka    │  │   Schema    │  │  Kafka UI   │                 │   │
│  │  │   (KRaft)   │  │  Registry   │  │             │                 │   │
│  │  │  Port:9092  │  │  Port:8085  │  │  Port:8081  │                 │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                    │                                       │
│  ┌─────────────────────────────────┼──────────────────────────────────┐   │
│  │                    OBSERVABILITY LAYER                              │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │   │
│  │  │Prometheus│ │ Grafana  │ │   Loki   │ │  Tempo   │ │   OTEL   │ │   │
│  │  │ Port:9090│ │Port:3000 │ │Port:3100 │ │Port:3200 │ │Port:4318 │ │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Service Layers

### 1. Application Layer

The application layer contains the core business logic:

| Service | Technology | Purpose | Port |
|---------|------------|---------|------|
| Frontend | Next.js 15 | Web UI | 3001 |
| Backend | Express.js | REST API | 3002 |
| Ballerine | Node.js | KYC/KYB Workflows | 3003 |
| BlinkFinance | Go | Double-entry Ledger | 5001 |

### 2. Trading Layer

High-performance trading infrastructure:

| Service | Technology | Purpose | Port |
|---------|------------|---------|------|
| Dingir Exchange | Rust | Matching Engine | 50051 (gRPC), 50053 (REST) |
| Liquibook | C++/Node.js | Order Book | 8083 |
| QuantLib | Python | Financial Analytics | 3010 |

### 3. Gateway Layer

API management and routing:

| Service | Technology | Purpose | Port |
|---------|------------|---------|------|
| APISIX | Nginx/Lua | API Gateway | 9080 |
| etcd | Go | Configuration Store | 2379 |
| Dashboard | Vue.js | Gateway Management | 9000 |

### 4. Security Layer

Authentication, authorization, and monitoring:

| Service | Technology | Purpose | Port |
|---------|------------|---------|------|
| Keycloak | Java | Identity Management | 8080 |
| Vault | Go | Secrets Management | 8200 |
| OPA | Go | Policy Engine | 8181 |
| Wazuh | OpenSearch | SIEM/XDR | 5601 |

### 5. Data Layer

Persistent storage:

| Service | Technology | Purpose | Port |
|---------|------------|---------|------|
| PostgreSQL | PostgreSQL 16 + TimescaleDB | Time-series DB | 5432 |
| Citus | PostgreSQL 16 + Citus | Multi-tenant Distributed DB | 5434 |
| MongoDB | MongoDB 7 | Document DB | 27017 |
| Redis | Redis 7 | Cache/Pub-Sub | 6379 |
| Typesense | Typesense | Search Engine | 8108 |

#### Citus Multi-Tenant Architecture

Citus provides horizontal scaling and multi-tenant isolation:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CITUS COORDINATOR                             │
│                    (thaliumx-citus-coordinator:5434)            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Reference Tables (replicated to all nodes):             │   │
│  │  - tenants                                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Distributed Tables (sharded by tenant_id):              │   │
│  │  - users, accounts, transactions, orders, audit_logs     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│    CITUS WORKER 1       │     │    CITUS WORKER 2       │
│ (thaliumx-citus-worker-1)│     │ (thaliumx-citus-worker-2)│
│                         │     │                         │
│  Shards: 1-16           │     │  Shards: 17-32          │
│  (tenant data)          │     │  (tenant data)          │
└─────────────────────────┘     └─────────────────────────┘
```

**Multi-Tenant Benefits:**
- **Tenant Isolation**: Each tenant's data is isolated by `tenant_id`
- **Horizontal Scaling**: Add more workers to handle more tenants
- **Query Routing**: Queries are automatically routed to correct shards
- **Reference Tables**: Lookup tables replicated to all nodes for fast joins

### 6. Messaging Layer

Event streaming and messaging:

| Service | Technology | Purpose | Port |
|---------|------------|---------|------|
| Kafka | Apache Kafka | Event Streaming | 9092 |
| Schema Registry | Confluent | Schema Management | 8085 |
| Kafka UI | Provectus | Kafka Management | 8081 |

### 7. Observability Layer

Monitoring, logging, and tracing:

| Service | Technology | Purpose | Port |
|---------|------------|---------|------|
| Prometheus | Prometheus | Metrics | 9090 |
| Grafana | Grafana | Dashboards | 3000 |
| Loki | Grafana Loki | Log Aggregation | 3100 |
| Tempo | Grafana Tempo | Distributed Tracing | 3200 |
| OTEL Collector | OpenTelemetry | Telemetry Collection | 4317/4318 |

---

## Core Applications

### Frontend (Next.js)

```
docker/frontend/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (auth)/         # Authentication pages
│   │   ├── dashboard/      # Dashboard pages
│   │   ├── trading/        # Trading interface
│   │   └── api/            # API routes
│   ├── components/         # React components
│   │   ├── ui/            # shadcn/ui components
│   │   └── auth/          # Auth components
│   └── lib/               # Utilities
├── public/                # Static assets
├── Dockerfile            # Multi-stage build
└── package.json          # Dependencies
```

**Key Features:**
- Server-side rendering (SSR)
- React Server Components
- Keycloak authentication
- Real-time WebSocket updates
- Responsive design with Tailwind CSS

### Backend (Express.js)

```
docker/backend/
├── src/
│   ├── index.ts           # Application entry
│   ├── routes/            # API routes
│   │   ├── auth.ts       # Authentication
│   │   ├── users.ts      # User management
│   │   └── trading.ts    # Trading operations
│   ├── services/          # Business logic
│   │   ├── database.ts   # Database service
│   │   ├── redis.ts      # Redis service
│   │   ├── kafka.ts      # Kafka service
│   │   ├── secrets.ts    # Vault integration
│   │   └── config.ts     # Configuration
│   ├── middleware/        # Express middleware
│   ├── models/           # Data models
│   └── migrations/       # Database migrations
├── Dockerfile            # Multi-stage build
└── package.json          # Dependencies
```

**Key Features:**
- RESTful API design
- JWT authentication
- Vault secrets integration
- OpenTelemetry instrumentation
- Health checks and metrics

### Shared Package

```
docker/shared/
├── src/
│   ├── index.ts          # Main exports
│   └── types/            # TypeScript types
│       └── index.ts      # Type definitions
├── tsconfig.json         # TypeScript config
└── package.json          # Package definition
```

**Exports:**
- Common TypeScript interfaces
- Utility functions
- Constants and enums
- Validation schemas

---

## Data Flow

### Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│ Frontend │────▶│ Keycloak │────▶│  Backend │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │
     │  1. Login      │                │                │
     │───────────────▶│                │                │
     │                │  2. Redirect   │                │
     │                │───────────────▶│                │
     │                │                │  3. Auth       │
     │                │                │◀───────────────│
     │                │  4. Token      │                │
     │                │◀───────────────│                │
     │  5. JWT        │                │                │
     │◀───────────────│                │                │
     │                │                │                │
     │  6. API Call   │                │                │
     │───────────────▶│───────────────▶│───────────────▶│
     │                │                │  7. Validate   │
     │                │                │◀───────────────│
     │  8. Response   │                │                │
     │◀───────────────│◀───────────────│◀───────────────│
```

### Trading Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│ Backend  │────▶│  Dingir  │────▶│ Liquibook│
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │
     │  1. Order      │                │                │
     │───────────────▶│                │                │
     │                │  2. Validate   │                │
     │                │───────────────▶│                │
     │                │                │  3. Match      │
     │                │                │───────────────▶│
     │                │                │  4. Execute    │
     │                │                │◀───────────────│
     │                │  5. Confirm    │                │
     │                │◀───────────────│                │
     │  6. Result     │                │                │
     │◀───────────────│                │                │
     │                │                │                │
     │                │  7. Event      │                │
     │                │───────────────▶│ Kafka          │
```

### Event Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Producer │────▶│  Kafka   │────▶│ Consumer │────▶│ Database │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │
     │  1. Publish    │                │                │
     │───────────────▶│                │                │
     │                │  2. Store      │                │
     │                │───────────────▶│                │
     │                │                │  3. Process    │
     │                │                │───────────────▶│
     │                │                │  4. Persist    │
     │                │                │◀───────────────│
```

---

## Technology Stack

### Languages

| Language | Usage |
|----------|-------|
| TypeScript | Frontend, Backend, Shared |
| Rust | Dingir Exchange |
| Python | QuantLib |
| Go | Vault, OPA, BlinkFinance |
| Java | Keycloak |
| C++ | Liquibook |

### Frameworks

| Framework | Usage |
|-----------|-------|
| Next.js 15 | Frontend |
| Express.js | Backend API |
| React 19 | UI Components |
| Tailwind CSS | Styling |
| shadcn/ui | Component Library |

### Databases

| Database | Usage |
|----------|-------|
| PostgreSQL 16 | Primary relational data |
| TimescaleDB | Time-series data |
| Citus 12.1 | Multi-tenant distributed data |
| MongoDB 7 | Document storage |
| Redis 7 | Caching, sessions |
| Typesense | Full-text search |

### Infrastructure

| Tool | Usage |
|------|-------|
| Docker | Containerization |
| Docker Compose | Orchestration |
| pnpm | Package management |
| OpenTelemetry | Observability |

---

## Deployment Architecture

### Docker Compose Structure

```
docker/
├── compose.yaml              # Master orchestrator
├── package.json              # Workspace root
├── pnpm-workspace.yaml       # Workspace config
│
├── core/                     # Core applications
│   ├── compose.yaml
│   └── core.env
│
├── databases/                # Data layer
│   └── compose.yaml
│
├── citus/                    # Multi-tenant database
│   ├── compose.yaml
│   └── init/
│       ├── 01-init-citus.sql
│       ├── 02-register-workers.sql
│       └── 03-distribute-tables.sql
│
├── messaging/                # Messaging layer
│   └── compose.yaml
│
├── security/                 # Security layer
│   └── compose.yaml
│
├── gateway/                  # Gateway layer
│   └── compose.yaml
│
├── observability/            # Observability layer
│   └── compose.yaml
│
├── wazuh/                    # SIEM
│   └── compose.yaml
│
├── fintech/                  # Fintech services
│   └── compose.yaml
│
└── trading/                  # Trading services
    └── compose.yaml
```

### Network Configuration

```yaml
networks:
  thaliumx-net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
```

### Volume Management

```yaml
volumes:
  postgres-data:
  mongodb-data:
  redis-data:
  kafka-data:
  vault-data:
  grafana-data:
  prometheus-data:
  loki-data:
```

---

## Scalability Considerations

### Horizontal Scaling

| Service | Scaling Strategy |
|---------|------------------|
| Frontend | Multiple replicas behind load balancer |
| Backend | Multiple replicas with shared Redis sessions |
| Kafka | Partition-based scaling |
| PostgreSQL | Read replicas for analytics |
| Citus | Add workers for tenant sharding |
| Redis | Redis Cluster |

### Multi-Tenant Scaling with Citus

```
# Add a new worker node
docker exec thaliumx-citus-coordinator psql -U postgres -d thaliumx \
  -c "SELECT citus_add_node('thaliumx-citus-worker-3', 5432);"

# Rebalance shards across workers
docker exec thaliumx-citus-coordinator psql -U postgres -d thaliumx \
  -c "SELECT rebalance_table_shards();"
```

### Vertical Scaling

| Service | Resource Limits |
|---------|-----------------|
| Backend | 2 CPU, 1GB RAM |
| Frontend | 1 CPU, 512MB RAM |
| PostgreSQL | 4 CPU, 4GB RAM |
| Kafka | 2 CPU, 2GB RAM |

### Future Kubernetes Migration

```yaml
# Example Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: thaliumx-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    spec:
      containers:
        - name: backend
          image: thaliumx/backend:latest
          resources:
            limits:
              cpu: "2"
              memory: "1Gi"
```

---

## Service Dependencies

```
Frontend
  └── Backend
        ├── PostgreSQL
        ├── Redis
        ├── Kafka
        ├── Vault
        ├── Keycloak
        └── OPA

Trading Services
  └── Dingir
        ├── PostgreSQL
        ├── Redis
        └── Kafka

Observability
  └── Grafana
        ├── Prometheus
        ├── Loki
        └── Tempo
```

---

## Configuration Management

### Environment Variables

```bash
# Core configuration
NODE_ENV=production
PORT=3002

# Database (Citus for multi-tenant)
DB_HOST=thaliumx-citus-coordinator
DB_PORT=5432
DB_NAME=thaliumx
DB_USER=thaliumx
DB_PASSWORD=${DB_PASSWORD}

# Redis
REDIS_HOST=thaliumx-redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}

# Vault
VAULT_ADDR=http://thaliumx-vault:8200
VAULT_TOKEN=${VAULT_TOKEN}

# Keycloak
KEYCLOAK_URL=http://thaliumx-keycloak:8080
KEYCLOAK_REALM=thaliumx
KEYCLOAK_CLIENT_ID=thaliumx-backend
```

### Secrets Management

All sensitive configuration is stored in HashiCorp Vault:

```
secret/thaliumx/
├── database
│   ├── username
│   └── password
├── redis
│   └── password
├── jwt
│   └── secret
├── keycloak
│   └── client_secret
└── api-keys
    └── external_services
```

---

## References

- [Docker Documentation](https://docs.docker.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Express.js Documentation](https://expressjs.com/)
- [Apache Kafka Documentation](https://kafka.apache.org/documentation/)
- [HashiCorp Vault Documentation](https://www.vaultproject.io/docs)
- [Keycloak Documentation](https://www.keycloak.org/documentation)