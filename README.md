# ThaliumX Platform

A comprehensive, production-ready infrastructure backbone for building modern financial applications.

[![Version](https://img.shields.io/badge/version-0.5.0--security--hardening-blue.svg)](https://github.com/thaliumx/thaliumx)
[![Services](https://img.shields.io/badge/services-36-green.svg)](#services)
[![Security](https://img.shields.io/badge/security-hardened-brightgreen.svg)](#security)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🚀 Overview

ThaliumX provides a complete Docker-based infrastructure with 36 pre-configured services covering:

- **Core Applications**: Next.js Frontend, Node.js/Express Backend
- **Data Storage**: PostgreSQL (TimescaleDB), MongoDB, Redis, Typesense
- **Messaging**: Kafka (KRaft), Schema Registry
- **Security**: Keycloak, Vault, OPA, Wazuh SIEM
- **API Gateway**: APISIX with Dashboard
- **Observability**: Prometheus, Grafana, Loki, Tempo, OpenTelemetry
- **Fintech**: Ballerine (KYC/KYB), BlinkFinance (Ledger)
- **Trading**: Dingir Exchange, Liquibook, QuantLib

## 📊 Project Status

| Category | Status | Services |
|----------|--------|----------|
| Core Apps | ✅ Complete | Frontend (Next.js), Backend (Node.js) |
| Data Layer | ✅ Complete | PostgreSQL, MongoDB, Redis, Typesense |
| Messaging | ✅ Complete | Kafka, Schema Registry, Kafka UI |
| Security | ✅ Hardened | Keycloak, Vault, OPA, Wazuh (3) |
| Gateway | ✅ Complete | APISIX, etcd, Dashboard |
| Observability | ✅ Complete | 10 services |
| Fintech | ✅ Complete | Ballerine (3), BlinkFinance |
| Trading | ✅ Complete | Dingir (2), Liquibook, QuantLib |

**Total: 36 services running and healthy**

## 🔒 Security Features

ThaliumX implements comprehensive security hardening:

| Feature | Implementation |
|---------|----------------|
| **Non-root Containers** | All services run as UID 1001 |
| **Read-only Filesystems** | Immutable container filesystems |
| **Capability Dropping** | All capabilities dropped (CAP_DROP: ALL) |
| **Privilege Escalation** | Prevented via no-new-privileges |
| **Secrets Management** | HashiCorp Vault integration |
| **Signal Handling** | dumb-init for proper PID 1 handling |
| **Resource Limits** | CPU and memory constraints |
| **Network Isolation** | Dedicated bridge network (172.28.0.0/16) |

See [Security Documentation](docs/SECURITY.md) for details.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        THALIUMX PLATFORM                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│   │ Frontend │  │ Backend  │  │Ballerine │  │BlinkFin. │       │
│   │ (Next.js)│  │(Express) │  │  (KYC)   │  │ (Ledger) │       │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│        └──────────────┴──────────────┴──────────────┘           │
│                           │                                      │
│   ┌───────────────────────┼───────────────────────┐             │
│   │              Trading Layer                     │             │
│   │  Dingir Exchange │ Liquibook │ QuantLib       │             │
│   └───────────────────────────────────────────────┘             │
│                           │                                      │
│                    ┌──────┴──────┐                              │
│                    │   APISIX    │                              │
│                    │   Gateway   │                              │
│                    └──────┬──────┘                              │
│                           │                                      │
│   ┌───────────────────────┼───────────────────────┐             │
│   │              Security Layer                    │             │
│   │  Keycloak │ Vault │ OPA │ Wazuh SIEM         │             │
│   └───────────────────────────────────────────────┘             │
│                                                                  │
│   ┌───────────────────────┬───────────────────────┐             │
│   │      Data Layer       │    Messaging Layer    │             │
│   │ PostgreSQL │ MongoDB  │  Kafka │ Schema Reg.  │             │
│   │ Redis │ Typesense     │  Kafka UI             │             │
│   └───────────────────────┴───────────────────────┘             │
│                                                                  │
│   ┌───────────────────────────────────────────────┐             │
│   │            Observability Layer                 │             │
│   │ Prometheus │ Grafana │ Loki │ Tempo │ OTEL   │             │
│   └───────────────────────────────────────────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

```bash
# Clone the repository
git clone <repository-url> thaliumx
cd thaliumx

# Create Docker network
docker network create --driver bridge --subnet 172.28.0.0/16 thaliumx-net

# Generate Wazuh certificates
cd docker/wazuh && chmod +x scripts/generate-certs.sh && ./scripts/generate-certs.sh && cd ../..

# Start all services
cd docker && docker compose up -d

# Check status (wait 5-10 minutes for all services)
docker ps --filter name=thaliumx --format "table {{.Names}}\t{{.Status}}"
```

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Installation Guide](docs/INSTALLATION_GUIDE.md) | Complete setup from zero |
| [Core Services](docs/core-services/README.md) | Service descriptions and value |
| [Security Guide](docs/SECURITY.md) | Security hardening details |
| [Architecture](docs/ARCHITECTURE.md) | System architecture overview |
| [Docker Guide](docker/README.md) | Docker configuration details |
| [Installation Tips](docs/installation-tips/README.md) | Fixes and workarounds |

## 🔗 Access Points

### Web Interfaces

| Service | URL | Credentials |
|---------|-----|-------------|
| **Frontend** | http://localhost:3001 | - |
| **Backend API** | http://localhost:3002 | - |
| Grafana | http://localhost:3000 | admin / ThaliumX2025 |
| Keycloak | http://localhost:8080 | admin / ThaliumX2025 |
| Vault | http://localhost:8200 | Token: <VAULT_TOKEN> |
| APISIX Dashboard | http://localhost:9000 | admin / ThaliumX2025 |
| Kafka UI | http://localhost:8081 | - |
| Wazuh Dashboard | https://localhost:5601 | admin / SecretPassword |
| Ballerine Backoffice | http://localhost:3004 | - |
| Prometheus | http://localhost:9090 | - |

### Trading APIs

| Service | URL | Description |
|---------|-----|-------------|
| Dingir REST API | http://localhost:50053/api/exchange/panel | Trading engine REST interface |
| Dingir gRPC | localhost:50051 | High-performance gRPC interface |
| Liquibook | http://localhost:8083 | Order book engine |
| QuantLib | http://localhost:3010 | Financial calculations |

### Backend API Endpoints

| Endpoint | Description |
|----------|-------------|
| GET /health | Health check endpoint |
| GET /api/docs | API documentation |
| POST /api/auth/* | Authentication endpoints |
| GET /api/users/* | User management |
| GET /api/trading/* | Trading operations |

### Databases

| Service | Connection |
|---------|------------|
| PostgreSQL | `postgres://thaliumx:ThaliumX2025@localhost:5432/thaliumx` |
| MongoDB | `mongodb://thaliumx:ThaliumX2025@localhost:27017` |
| Redis | `redis://:ThaliumX2025@localhost:6379` |

## 📁 Project Structure

```
thaliumx/
├── docker/                    # Docker Compose configurations
│   ├── compose.yaml          # Master orchestrator
│   ├── package.json          # pnpm workspace root
│   ├── pnpm-workspace.yaml   # Workspace configuration
│   ├── shared/               # Shared TypeScript types/utilities
│   ├── frontend/             # Next.js frontend application
│   ├── backend/              # Node.js/Express backend API
│   ├── databases/            # PostgreSQL, MongoDB, Redis, Typesense
│   ├── messaging/            # Kafka, Schema Registry
│   ├── security/             # Keycloak, Vault, OPA
│   ├── gateway/              # APISIX, etcd
│   ├── observability/        # Prometheus, Grafana, Loki, etc.
│   ├── wazuh/                # Wazuh SIEM/XDR
│   ├── fintech/              # Ballerine, BlinkFinance
│   ├── core/                 # Core services compose
│   └── trading/              # Dingir, Liquibook, QuantLib
├── docs/                      # Documentation
│   ├── INSTALLATION_GUIDE.md
│   ├── SECURITY.md
│   ├── ARCHITECTURE.md
│   ├── core-services/
│   └── installation-tips/
├── blockchain-contracts/      # Smart contracts (future)
└── README.md                  # This file
```

## 🏷️ Version History

| Version | Tag | Description |
|---------|-----|-------------|
| 0.5.0 | v0.5.0-security-hardening | Security hardening, Vault integration, pnpm workspace |
| 0.4.0 | v0.4.0-core-apps | Frontend/Backend integration |
| 0.3.0 | v0.3.0-trading | Trading services (Dingir, Liquibook, QuantLib) |
| 0.2.0 | v0.2.0-backbone | Complete backbone with 32 services |
| 0.1.0 | v0.1.0-core-services | Initial 28 services |

## 🗺️ Roadmap

### Completed ✅
- [x] Data Layer (PostgreSQL/TimescaleDB, MongoDB, Redis, Typesense)
- [x] Messaging Layer (Kafka KRaft, Schema Registry, Kafka UI)
- [x] Security Layer (Keycloak, Vault, OPA, Wazuh SIEM)
- [x] Gateway Layer (APISIX, etcd, Dashboard)
- [x] Observability Layer (10 services)
- [x] Fintech Layer (Ballerine, BlinkFinance)
- [x] Core Layer (Frontend Next.js, Backend Express)
- [x] Trading Layer (Dingir Exchange, Liquibook, QuantLib)
- [x] Security Hardening (non-root, read-only, capabilities)
- [x] Vault Integration for secrets management
- [x] pnpm Workspace configuration
- [x] Documentation

### Planned 🔲
- [ ] Citus for multi-tenancy
- [ ] Kubernetes deployment
- [ ] CI/CD pipelines
- [ ] Helm charts
- [ ] Terraform modules

## 🛠️ Development

### Prerequisites

- Docker 24.0+
- Docker Compose v2.20+
- Node.js 20+ (for local development)
- pnpm 9.14+ (for local development)

### Local Development

```bash
# Install dependencies
cd docker
pnpm install

# Build all packages
pnpm build

# Run in development mode
pnpm dev
```

### Building Images

```bash
# Build frontend
cd docker/core && docker compose build frontend

# Build backend
cd docker/core && docker compose build backend

# Build with no cache
docker compose build --no-cache
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

This platform integrates the following open-source projects:
- [PostgreSQL](https://www.postgresql.org/) / [TimescaleDB](https://www.timescale.com/)
- [Apache Kafka](https://kafka.apache.org/)
- [Keycloak](https://www.keycloak.org/)
- [HashiCorp Vault](https://www.vaultproject.io/)
- [Apache APISIX](https://apisix.apache.org/)
- [Prometheus](https://prometheus.io/) / [Grafana](https://grafana.com/)
- [Wazuh](https://wazuh.com/)
- [Ballerine](https://www.ballerine.com/)
- [BlinkFinance](https://github.com/blnkfinance/blnk)
- [Dingir Exchange](https://github.com/fluidex/dingir-exchange)
- [Liquibook](https://github.com/objectcomputing/liquibook)
- [QuantLib](https://www.quantlib.org/)
- [Next.js](https://nextjs.org/)
- [Express.js](https://expressjs.com/)

---

**Built with ❤️ for the fintech community**
