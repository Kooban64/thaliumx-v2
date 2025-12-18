# Core Services Overview

This document describes all the core backbone services in the ThaliumX platform and the value they provide.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              THALIUMX PLATFORM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Frontend   │  │   Backend   │  │  Ballerine  │  │ BlinkFinance│        │
│  │  (React)    │  │  (Node.js)  │  │  (Workflow) │  │  (Ledger)   │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│  ┌──────┴────────────────┴────────────────┴────────────────┴──────┐        │
│  │                        APISIX Gateway                          │        │
│  └────────────────────────────┬───────────────────────────────────┘        │
│                               │                                             │
│  ┌────────────────────────────┼───────────────────────────────────┐        │
│  │                    Security Layer                               │        │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │        │
│  │  │Keycloak │  │  Vault  │  │   OPA   │  │  Wazuh  │           │        │
│  │  │  (IAM)  │  │(Secrets)│  │(Policy) │  │ (SIEM)  │           │        │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘           │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │                      Data Layer                                 │        │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │        │
│  │  │PostgreSQL│ │ MongoDB │  │  Redis  │  │Typesense│           │        │
│  │  │TimescaleDB│ │(Document)│ │ (Cache) │  │(Search) │           │        │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘           │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │                    Messaging Layer                              │        │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                        │        │
│  │  │  Kafka  │  │ Schema  │  │Kafka UI │                        │        │
│  │  │ (KRaft) │  │Registry │  │         │                        │        │
│  │  └─────────┘  └─────────┘  └─────────┘                        │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │                   Observability Layer                           │        │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │        │
│  │  │Prometheus│ │ Grafana │  │  Loki   │  │  Tempo  │           │        │
│  │  │(Metrics)│  │(Dashboards)│ │ (Logs) │  │(Traces) │           │        │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘           │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Layer Services

### PostgreSQL with TimescaleDB
**Port**: 5432 | **Container**: `thaliumx-postgres`

**Purpose**: Primary relational database with time-series capabilities.

**Value to Platform**:
- **ACID Compliance**: Ensures data integrity for financial transactions
- **TimescaleDB Extension**: Optimized storage and queries for time-series data (market data, audit logs, metrics)
- **Hypertables**: Automatic partitioning for high-volume time-series data
- **Continuous Aggregates**: Pre-computed rollups for fast analytics
- **Data Retention Policies**: Automatic data lifecycle management

**Use Cases**:
- User accounts and profiles
- Transaction records
- Market data history
- Audit trails
- Configuration storage

---

### MongoDB
**Port**: 27017 | **Container**: `thaliumx-mongodb`

**Purpose**: Document database for flexible, schema-less data storage.

**Value to Platform**:
- **Flexible Schema**: Store complex, nested documents without rigid schemas
- **Horizontal Scaling**: Easy sharding for large datasets
- **Rich Queries**: Powerful aggregation framework
- **Change Streams**: Real-time data change notifications

**Use Cases**:
- User preferences and settings
- Session data
- Workflow state storage
- Complex nested configurations
- Event sourcing

---

### Redis
**Port**: 6379 | **Container**: `thaliumx-redis`

**Purpose**: In-memory data store for caching and real-time operations.

**Value to Platform**:
- **Sub-millisecond Latency**: Extremely fast read/write operations
- **Pub/Sub**: Real-time messaging between services
- **Data Structures**: Lists, sets, sorted sets, hashes for various use cases
- **TTL Support**: Automatic expiration for cache entries
- **Persistence Options**: RDB snapshots and AOF for durability

**Use Cases**:
- Session caching
- API response caching
- Rate limiting
- Real-time leaderboards
- Distributed locks
- Message queues

---

### Typesense
**Port**: 8108 | **Container**: `thaliumx-typesense`

**Purpose**: Fast, typo-tolerant search engine.

**Value to Platform**:
- **Instant Search**: Sub-50ms search responses
- **Typo Tolerance**: Handles misspellings gracefully
- **Faceted Search**: Filter and aggregate results
- **Geo Search**: Location-based queries
- **Easy Setup**: No complex configuration required

**Use Cases**:
- Product/asset search
- User search
- Transaction search
- Autocomplete suggestions
- Full-text search across documents

---

## Messaging Layer Services

### Apache Kafka (KRaft Mode)
**Port**: 9092 | **Container**: `thaliumx-kafka`

**Purpose**: Distributed event streaming platform.

**Value to Platform**:
- **High Throughput**: Millions of messages per second
- **Durability**: Persistent message storage with replication
- **Ordering Guarantees**: Partition-level message ordering
- **Replay Capability**: Re-process historical events
- **KRaft Mode**: No Zookeeper dependency, simplified operations

**Use Cases**:
- Event-driven architecture
- Real-time data pipelines
- Audit logging
- Service-to-service communication
- Market data distribution
- Transaction event streaming

---

### Schema Registry
**Port**: 8085 | **Container**: `thaliumx-schema-registry`

**Purpose**: Centralized schema management for Kafka messages.

**Value to Platform**:
- **Schema Evolution**: Manage schema changes safely
- **Compatibility Checks**: Prevent breaking changes
- **Multiple Formats**: Avro, Protobuf, JSON Schema support
- **Serialization**: Efficient binary encoding
- **Documentation**: Self-documenting message formats

**Use Cases**:
- Define message contracts between services
- Ensure backward/forward compatibility
- Reduce message size with binary encoding
- API versioning for events

---

### Kafka UI
**Port**: 8081 | **Container**: `thaliumx-kafka-ui`

**Purpose**: Web interface for Kafka management.

**Value to Platform**:
- **Visual Management**: Browse topics, partitions, consumers
- **Message Inspection**: View and search messages
- **Consumer Lag Monitoring**: Track consumer health
- **Topic Management**: Create, configure, delete topics

---

## Security Layer Services

### Keycloak
**Port**: 8080 | **Container**: `thaliumx-keycloak`

**Purpose**: Identity and Access Management (IAM).

**Value to Platform**:
- **Single Sign-On (SSO)**: One login for all services
- **OAuth 2.0 / OIDC**: Industry-standard authentication
- **User Federation**: Connect to LDAP, Active Directory
- **Social Login**: Google, GitHub, Facebook integration
- **Multi-Factor Authentication**: Enhanced security
- **Fine-grained Authorization**: Role-based access control

**Use Cases**:
- User authentication
- API authentication
- Service-to-service authentication
- User management
- Role and permission management

---

### HashiCorp Vault
**Port**: 8200 | **Container**: `thaliumx-vault`

**Purpose**: Secrets management and encryption.

**Value to Platform**:
- **Centralized Secrets**: Single source of truth for credentials
- **Dynamic Secrets**: Generate short-lived credentials on demand
- **Encryption as a Service**: Encrypt/decrypt without exposing keys
- **Audit Logging**: Track all secret access
- **Secret Rotation**: Automatic credential rotation

**Use Cases**:
- Database credentials
- API keys
- TLS certificates
- Encryption keys
- Service tokens

---

### Open Policy Agent (OPA)
**Port**: 8181 | **Container**: `thaliumx-opa`

**Purpose**: Policy-based access control.

**Value to Platform**:
- **Unified Policy Language**: Rego for all authorization decisions
- **Decoupled Authorization**: Separate policy from application code
- **Fine-grained Control**: Attribute-based access control (ABAC)
- **Audit Trail**: Log all policy decisions
- **Policy Testing**: Unit test your policies

**Use Cases**:
- API authorization
- Resource access control
- Data filtering
- Compliance enforcement
- Multi-tenancy isolation

---

### Wazuh SIEM/XDR
**Ports**: 9200, 1514, 5601 | **Containers**: `thaliumx-wazuh-*`

**Purpose**: Security Information and Event Management.

**Value to Platform**:
- **Threat Detection**: Real-time security monitoring
- **Log Analysis**: Centralized security log analysis
- **Compliance**: PCI-DSS, GDPR, HIPAA compliance reporting
- **Vulnerability Detection**: Identify system vulnerabilities
- **File Integrity Monitoring**: Detect unauthorized changes
- **Incident Response**: Automated response to threats

**Use Cases**:
- Security monitoring
- Intrusion detection
- Compliance auditing
- Forensic analysis
- Vulnerability management

---

## Gateway Layer Services

### Apache APISIX
**Ports**: 9080, 9443, 9180 | **Container**: `thaliumx-apisix`

**Purpose**: High-performance API gateway.

**Value to Platform**:
- **Traffic Management**: Load balancing, rate limiting, circuit breaking
- **Security**: Authentication, authorization, IP filtering
- **Observability**: Request logging, metrics, tracing
- **Protocol Support**: HTTP, gRPC, WebSocket, TCP/UDP
- **Plugin Ecosystem**: 80+ plugins for various use cases
- **Dynamic Configuration**: Hot-reload without restarts

**Use Cases**:
- API routing
- Rate limiting
- Authentication proxy
- Request/response transformation
- Canary deployments
- A/B testing

---

### etcd
**Port**: 2379 | **Container**: `thaliumx-etcd`

**Purpose**: Distributed key-value store for APISIX configuration.

**Value to Platform**:
- **Consistency**: Strong consistency guarantees
- **High Availability**: Distributed consensus
- **Watch API**: Real-time configuration updates
- **APISIX Backend**: Stores gateway configuration

---

### APISIX Dashboard
**Port**: 9000 | **Container**: `thaliumx-apisix-dashboard`

**Purpose**: Web UI for APISIX management.

**Value to Platform**:
- **Visual Configuration**: Manage routes, upstreams, plugins
- **Monitoring**: View traffic and health metrics
- **Plugin Management**: Enable/disable plugins easily

---

## Observability Layer Services

### Prometheus
**Port**: 9090 | **Container**: `thaliumx-prometheus`

**Purpose**: Metrics collection and alerting.

**Value to Platform**:
- **Pull-based Metrics**: Scrape metrics from all services
- **PromQL**: Powerful query language for metrics
- **Alerting**: Define alert rules and notifications
- **Service Discovery**: Auto-discover new services
- **Long-term Storage**: Historical metrics retention

**Use Cases**:
- System metrics (CPU, memory, disk)
- Application metrics (requests, latency, errors)
- Business metrics (transactions, users)
- SLA monitoring
- Capacity planning

---

### Grafana
**Port**: 3000 | **Container**: `thaliumx-grafana`

**Purpose**: Visualization and dashboards.

**Value to Platform**:
- **Rich Visualizations**: Graphs, tables, heatmaps, gauges
- **Multiple Data Sources**: Prometheus, Loki, Tempo, PostgreSQL
- **Alerting**: Visual alert configuration
- **Dashboards as Code**: Version-controlled dashboards
- **Annotations**: Mark events on graphs

**Use Cases**:
- System dashboards
- Application performance monitoring
- Business intelligence
- SLA reporting
- Incident investigation

---

### Loki
**Port**: 3100 | **Container**: `thaliumx-loki`

**Purpose**: Log aggregation system.

**Value to Platform**:
- **Cost-effective**: Index-free design, stores only metadata
- **Prometheus-like**: Same label-based approach
- **LogQL**: Query language similar to PromQL
- **Grafana Integration**: Native log exploration in Grafana

**Use Cases**:
- Centralized logging
- Log search and analysis
- Error tracking
- Audit logging
- Debugging

---

### Promtail
**Container**: `thaliumx-promtail`

**Purpose**: Log collector for Loki.

**Value to Platform**:
- **Auto-discovery**: Automatically find and tail log files
- **Label Extraction**: Parse and label log entries
- **Pipeline Processing**: Transform logs before sending

---

### Tempo
**Port**: 3200 | **Container**: `thaliumx-tempo`

**Purpose**: Distributed tracing backend.

**Value to Platform**:
- **Trace Storage**: Store and query distributed traces
- **Cost-effective**: Object storage backend
- **Grafana Integration**: Native trace exploration
- **OpenTelemetry Support**: Industry-standard instrumentation

**Use Cases**:
- Request tracing across services
- Latency analysis
- Error root cause analysis
- Service dependency mapping

---

### OpenTelemetry Collector
**Ports**: 4317, 4318 | **Container**: `thaliumx-otel-collector`

**Purpose**: Telemetry data collection and processing.

**Value to Platform**:
- **Vendor Agnostic**: Single collector for all telemetry
- **Protocol Support**: OTLP, Jaeger, Zipkin, Prometheus
- **Processing Pipeline**: Filter, transform, batch data
- **Multiple Exporters**: Send to multiple backends

**Use Cases**:
- Collect traces from applications
- Collect metrics from applications
- Protocol translation
- Data enrichment

---

### cAdvisor
**Port**: 8088 | **Container**: `thaliumx-cadvisor`

**Purpose**: Container resource monitoring.

**Value to Platform**:
- **Container Metrics**: CPU, memory, network, disk per container
- **Real-time Data**: Live resource usage
- **Prometheus Integration**: Export metrics for scraping

---

### Blackbox Exporter
**Port**: 9115 | **Container**: `thaliumx-blackbox-exporter`

**Purpose**: Endpoint probing and monitoring.

**Value to Platform**:
- **HTTP Probes**: Check endpoint availability and response
- **TCP Probes**: Verify port connectivity
- **DNS Probes**: Monitor DNS resolution
- **SSL Certificate Monitoring**: Track certificate expiration

**Use Cases**:
- Uptime monitoring
- SSL certificate alerts
- External service monitoring
- SLA verification

---

### PostgreSQL Exporter
**Port**: 9187 | **Container**: `thaliumx-postgres-exporter`

**Purpose**: PostgreSQL metrics for Prometheus.

**Value to Platform**:
- **Database Metrics**: Connections, queries, locks, replication
- **Custom Queries**: Define custom metric queries
- **Performance Insights**: Query performance statistics

---

### Redis Exporter
**Port**: 9121 | **Container**: `thaliumx-redis-exporter`

**Purpose**: Redis metrics for Prometheus.

**Value to Platform**:
- **Redis Metrics**: Memory, connections, commands, keys
- **Cluster Support**: Monitor Redis clusters
- **Latency Tracking**: Command latency histograms

---

## Core Application Layer

### Frontend (Next.js)
**Port**: 3001 | **Container**: `thaliumx-frontend`

**Purpose**: Modern web application for user interaction.

**Value to Platform**:
- **Server-Side Rendering**: Fast initial page loads with SEO benefits
- **React Server Components**: Efficient data fetching and rendering
- **Keycloak Integration**: Secure authentication via OAuth 2.0/OIDC
- **Real-time Updates**: WebSocket support for live data
- **Responsive Design**: Mobile-first approach with Tailwind CSS

**Technology Stack**:
- Next.js 15 with App Router
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui components

**Use Cases**:
- User authentication and registration
- Trading dashboard
- Portfolio management
- Admin interfaces
- KYC/KYB workflows

---

### Backend (Express.js)
**Port**: 3002 | **Container**: `thaliumx-backend`

**Purpose**: RESTful API server for business logic and data access.

**Value to Platform**:
- **RESTful API**: Clean, documented API endpoints
- **Vault Integration**: Secure secrets management
- **OpenTelemetry**: Full observability with traces and metrics
- **Database Migrations**: Automated schema management
- **Health Checks**: Kubernetes-ready health endpoints

**Technology Stack**:
- Node.js 20
- Express.js
- TypeScript
- Sequelize ORM
- Winston logging

**Security Features**:
- Non-root container execution (UID 1001)
- Read-only filesystem
- Dropped Linux capabilities
- No privilege escalation
- dumb-init for signal handling

**API Endpoints**:
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/docs` | GET | API documentation |
| `/api/auth/*` | * | Authentication |
| `/api/users/*` | * | User management |
| `/api/trading/*` | * | Trading operations |

**Use Cases**:
- User authentication and authorization
- Trading order management
- Portfolio calculations
- KYC/KYB processing
- Audit logging

---

## Fintech Layer Services

### Ballerine Workflow Engine
**Port**: 3003 | **Container**: `thaliumx-ballerine-workflow`

**Purpose**: KYC/KYB workflow automation.

**Value to Platform**:
- **Workflow Orchestration**: Define complex verification flows
- **Rule Engine**: Configurable business rules
- **Integration Ready**: Connect to verification providers
- **Audit Trail**: Complete workflow history

**Use Cases**:
- Customer onboarding (KYC)
- Business verification (KYB)
- Document verification
- Risk assessment workflows
- Compliance workflows

---

### Ballerine Backoffice
**Port**: 3001 | **Container**: `thaliumx-ballerine-backoffice`

**Purpose**: Admin interface for workflow management.

**Value to Platform**:
- **Case Management**: Review and approve cases
- **Workflow Monitoring**: Track workflow progress
- **Manual Review**: Handle edge cases
- **Reporting**: Compliance reports

---

### BlinkFinance (Blnk)
**Port**: 5001 | **Container**: `thaliumx-blinkfinance`

**Purpose**: Double-entry ledger system.

**Value to Platform**:
- **Double-Entry Accounting**: Proper financial record keeping
- **Multi-currency Support**: Handle multiple currencies
- **Transaction History**: Complete audit trail
- **Balance Tracking**: Real-time balance calculations
- **Idempotency**: Safe transaction retries

**Use Cases**:
- Wallet management
- Payment processing
- Account balances
- Transaction history
- Financial reporting

---

## Service Ports Summary

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| PostgreSQL | 5432 | TCP | Database |
| MongoDB | 27017 | TCP | Document DB |
| Redis | 6379 | TCP | Cache |
| Typesense | 8108 | HTTP | Search |
| Kafka | 9092 | TCP | Messaging |
| Schema Registry | 8085 | HTTP | Schema Management |
| Kafka UI | 8081 | HTTP | Kafka Management |
| Keycloak | 8080 | HTTP | IAM |
| Vault | 8200 | HTTP | Secrets |
| OPA | 8181 | HTTP | Policy |
| APISIX | 9080/9443 | HTTP/HTTPS | Gateway |
| APISIX Admin | 9180 | HTTP | Gateway Admin |
| APISIX Dashboard | 9000 | HTTP | Gateway UI |
| etcd | 2379 | HTTP | Config Store |
| Prometheus | 9090 | HTTP | Metrics |
| Grafana | 3000 | HTTP | Dashboards |
| Loki | 3100 | HTTP | Logs |
| Tempo | 3200 | HTTP | Traces |
| OTEL Collector | 4317/4318 | gRPC/HTTP | Telemetry |
| cAdvisor | 8088 | HTTP | Container Metrics |
| Blackbox Exporter | 9115 | HTTP | Probing |
| PostgreSQL Exporter | 9187 | HTTP | DB Metrics |
| Redis Exporter | 9121 | HTTP | Cache Metrics |
| Wazuh Indexer | 9200 | HTTPS | SIEM Storage |
| Wazuh Manager | 1514/55000 | TCP | SIEM Engine |
| Wazuh Dashboard | 5601 | HTTPS | SIEM UI |
| Ballerine Workflow | 3003 | HTTP | KYC Workflow |
| Ballerine Backoffice | 3004 | HTTP | KYC Admin |
| BlinkFinance | 5001 | HTTP | Ledger |
| **Frontend** | 3001 | HTTP | Web UI (Next.js) |
| **Backend** | 3002 | HTTP | REST API (Express) |
