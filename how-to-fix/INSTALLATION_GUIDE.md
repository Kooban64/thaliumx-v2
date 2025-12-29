# ThaliumX Platform Installation Guide

This guide walks you through setting up the complete ThaliumX platform from scratch.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Step-by-Step Installation](#step-by-step-installation)
4. [Service Startup Order](#service-startup-order)
5. [Verification](#verification)
6. [Access Points](#access-points)
7. [Security Configuration](#security-configuration)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 4 cores | 8+ cores |
| RAM | 16 GB | 32+ GB |
| Disk | 50 GB | 100+ GB SSD |
| OS | Linux (Ubuntu 22.04+) | Linux |

### Software Requirements

1. **Docker** (24.0+)
   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   # Log out and back in
   ```

2. **Docker Compose** (v2.20+)
   ```bash
   # Usually included with Docker Desktop
   # For Linux standalone:
   sudo apt-get install docker-compose-plugin
   ```

3. **Git**
   ```bash
   sudo apt-get install git
   ```

4. **curl** (for testing)
   ```bash
   sudo apt-get install curl
   ```

### System Configuration

```bash
# Increase virtual memory for Elasticsearch/OpenSearch (Wazuh)
sudo sysctl -w vm.max_map_count=262144
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf

# Increase file descriptors
ulimit -n 65536
```

---

## Quick Start

If you want to get everything running quickly:

```bash
# Clone the repository
git clone <repository-url> thaliumx
cd thaliumx

# Create the Docker network
docker network create --driver bridge --subnet 172.28.0.0/16 thaliumx-net

# Generate Wazuh SSL certificates
cd docker/wazuh
chmod +x scripts/generate-certs.sh
./scripts/generate-certs.sh
cd ../..

# Start all services (this will take several minutes)
cd docker
docker compose up -d

# Wait for services to become healthy (5-10 minutes)
watch -n 5 'docker ps --format "table {{.Names}}\t{{.Status}}" | grep -c healthy'
```

---

## Step-by-Step Installation

### Step 1: Clone and Setup

```bash
# Clone the repository
git clone <repository-url> thaliumx
cd thaliumx

# Create the Docker network
docker network create --driver bridge --subnet 172.28.0.0/16 thaliumx-net
```

### Step 2: Generate Wazuh Certificates

Wazuh requires SSL certificates before starting:

```bash
cd docker/wazuh
chmod +x scripts/generate-certs.sh
./scripts/generate-certs.sh
cd ../..
```

This creates certificates in `docker/wazuh/config/wazuh_indexer_ssl_certs/`.

### Step 3: Start Data Layer Services

Start the foundational data services first:

```bash
cd docker/databases
docker compose up -d
```

Wait for healthy status:
```bash
docker ps --filter name=thaliumx-postgres --format "{{.Status}}"
docker ps --filter name=thaliumx-redis --format "{{.Status}}"
docker ps --filter name=thaliumx-mongodb --format "{{.Status}}"
```

### Step 4: Start Messaging Layer

```bash
cd ../messaging
docker compose up -d kafka
# Wait for Kafka to be healthy
sleep 30
docker compose up -d schema-registry
```

### Step 5: Start Security Layer

```bash
cd ../security
docker compose up -d
```

Wait for Keycloak and Vault:
```bash
docker ps --filter name=thaliumx-keycloak --format "{{.Status}}"
docker ps --filter name=thaliumx-vault --format "{{.Status}}"
```

### Step 6: Start Gateway Layer

```bash
cd ../gateway
docker compose up -d etcd
sleep 10
docker compose up -d apisix apisix-dashboard
```

### Step 7: Start Observability Layer

```bash
cd ../observability
docker compose up -d
```

### Step 8: Start Wazuh SIEM

```bash
cd ../wazuh
docker compose up -d wazuh-indexer
# Wait for indexer to be healthy (2-3 minutes)
sleep 120

# Initialize OpenSearch security plugin
docker exec thaliumx-wazuh-indexer bash -c '
export JAVA_HOME=/usr/share/wazuh-indexer/jdk && \
/usr/share/wazuh-indexer/plugins/opensearch-security/tools/securityadmin.sh \
  -cd /usr/share/wazuh-indexer/opensearch-security/ \
  -cacert /usr/share/wazuh-indexer/certs/root-ca.pem \
  -cert /usr/share/wazuh-indexer/certs/admin.pem \
  -key /usr/share/wazuh-indexer/certs/admin-key.pem \
  -icl -nhnv \
  -h localhost
'

# Start manager and dashboard
docker compose up -d wazuh-manager
sleep 60
docker compose up -d wazuh-dashboard
```

### Step 9: Start Fintech Services

```bash
cd ../fintech
docker compose up -d
```

### Step 10: Start Core Services

```bash
cd ../core
docker compose build  # Build frontend and backend images
docker compose up -d
```

Wait for services to be healthy:
```bash
docker ps --filter name=thaliumx-frontend --format "{{.Status}}"
docker ps --filter name=thaliumx-backend --format "{{.Status}}"
```

### Step 11: Start Typesense

```bash
cd ../typesense
docker compose up -d
```

---

## Service Startup Order

For proper dependency resolution, start services in this order:

```
1. Network (thaliumx-net)
2. Data Layer
   ├── PostgreSQL
   ├── Redis
   └── MongoDB
3. Messaging Layer
   ├── Kafka
   └── Schema Registry
4. Security Layer
   ├── Vault
   ├── Keycloak
   └── OPA
5. Gateway Layer
   ├── etcd
   ├── APISIX
   └── APISIX Dashboard
6. Observability Layer
   ├── Prometheus
   ├── Loki
   ├── Tempo
   ├── Grafana
   ├── Promtail
   ├── OpenTelemetry Collector
   ├── cAdvisor
   ├── Blackbox Exporter
   ├── PostgreSQL Exporter
   └── Redis Exporter
7. Wazuh SIEM
   ├── Wazuh Indexer (+ security init)
   ├── Wazuh Manager
   └── Wazuh Dashboard
8. Fintech Layer
   ├── Ballerine PostgreSQL
   ├── Ballerine Workflow
   ├── Ballerine Backoffice
   └── BlinkFinance
9. Typesense
10. Core Layer
    ├── Backend (depends on PostgreSQL, Redis, Kafka, Vault)
    └── Frontend (depends on Backend)
```

---

## Security Configuration

### Container Security

All core application containers run with security hardening:

```yaml
services:
  backend:
    user: "1001:1001"           # Non-root user
    read_only: true             # Read-only filesystem
    cap_drop:
      - ALL                     # Drop all capabilities
    security_opt:
      - no-new-privileges:true  # Prevent privilege escalation
```

### Secrets Management

Secrets are managed via HashiCorp Vault:

```bash
# Access Vault UI
open http://localhost:8200

# Login with token
Token: <VAULT_TOKEN>

# Store a secret
vault kv put secret/thaliumx/database username=thaliumx password=ThaliumX2025
```

### Environment Variables

Core services use these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `VAULT_ADDR` | Vault server address | http://thaliumx-vault:8200 |
| `VAULT_TOKEN` | Vault authentication token | (required) |
| `DB_HOST` | PostgreSQL host | thaliumx-postgres |
| `DB_PASSWORD` | Database password | ThaliumX2025 |
| `REDIS_PASSWORD` | Redis password | ThaliumX2025 |
| `KEYCLOAK_CLIENT_SECRET` | Keycloak client secret | ThaliumX2025 |

---

## Verification

### Check All Containers

```bash
# List all running containers
docker ps --filter name=thaliumx --format "table {{.Names}}\t{{.Status}}"

# Count healthy containers (should be 32)
docker ps --filter name=thaliumx --format "{{.Status}}" | grep -c healthy
```

### Test Individual Services

```bash
# PostgreSQL
docker exec thaliumx-postgres pg_isready

# Redis
docker exec thaliumx-redis redis-cli ping

# MongoDB
docker exec thaliumx-mongodb mongosh --eval "db.runCommand('ping')"

# Kafka
docker exec thaliumx-kafka kafka-broker-api-versions --bootstrap-server localhost:9092

# Schema Registry
curl -s http://localhost:8085/subjects

# Vault
curl -s http://localhost:8200/v1/sys/health

# Keycloak
curl -s http://localhost:8080/health/ready

# APISIX
curl -s http://localhost:9080/apisix/status

# Prometheus
curl -s http://localhost:9090/-/healthy

# Grafana
curl -s http://localhost:3000/api/health

# Loki
curl -s http://localhost:3100/ready

# Typesense
curl -s http://localhost:8108/health

# Wazuh Indexer
curl -sk https://localhost:9200/_cluster/health -u admin:SecretPassword

# Wazuh Dashboard
curl -sk https://localhost:5601/api/status

# BlinkFinance
curl -s http://localhost:5001/health
```

---

## Access Points

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

### API Endpoints

| Service | URL | Notes |
|---------|-----|-------|
| APISIX Gateway | http://localhost:9080 | Main API gateway |
| APISIX Admin | http://localhost:9180 | Gateway admin API |
| Schema Registry | http://localhost:8085 | Kafka schema management |
| OPA | http://localhost:8181 | Policy engine |
| Typesense | http://localhost:8108 | Search API (key: blnk-api-key) |
| BlinkFinance | http://localhost:5001 | Ledger API |
| Ballerine Workflow | http://localhost:3003 | Workflow API |
| OpenTelemetry | http://localhost:4318 | OTLP HTTP receiver |
| OpenTelemetry | grpc://localhost:4317 | OTLP gRPC receiver |

### Backend API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/docs` | GET | API documentation |
| `/api/auth/login` | POST | User login |
| `/api/auth/register` | POST | User registration |
| `/api/users` | GET | List users |
| `/api/trading/*` | * | Trading operations |

### Database Connections

| Service | Connection String |
|---------|-------------------|
| PostgreSQL | `postgres://thaliumx:ThaliumX2025@localhost:5432/thaliumx` |
| MongoDB | `mongodb://thaliumx:ThaliumX2025@localhost:27017` |
| Redis | `redis://:ThaliumX2025@localhost:6379` |

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs thaliumx-<service-name>

# Check if dependencies are running
docker ps --filter name=thaliumx

# Check network
docker network inspect thaliumx-net
```

### Port Already in Use

```bash
# Find what's using the port
sudo netstat -tlnp | grep <port>
# or
sudo ss -tlnp | grep <port>

# Kill the process or change the port in compose file
```

### Wazuh Indexer Security Not Initialized

```bash
# Re-run security admin
docker exec thaliumx-wazuh-indexer bash -c '
export JAVA_HOME=/usr/share/wazuh-indexer/jdk && \
/usr/share/wazuh-indexer/plugins/opensearch-security/tools/securityadmin.sh \
  -cd /usr/share/wazuh-indexer/opensearch-security/ \
  -cacert /usr/share/wazuh-indexer/certs/root-ca.pem \
  -cert /usr/share/wazuh-indexer/certs/admin.pem \
  -key /usr/share/wazuh-indexer/certs/admin-key.pem \
  -icl -nhnv \
  -h localhost
'
```

### Out of Memory

```bash
# Check memory usage
docker stats --no-stream

# Reduce Java heap sizes in compose files
# Look for JAVA_OPTS or *_HEAP_OPTS environment variables
```

### Disk Space Issues

```bash
# Check disk usage
df -h

# Clean up Docker
docker system prune -a --volumes
```

### Service Can't Connect to Another Service

```bash
# Verify both services are on the same network
docker network inspect thaliumx-net

# Test connectivity from inside a container
docker exec thaliumx-<service> ping thaliumx-<other-service>
docker exec thaliumx-<service> curl http://thaliumx-<other-service>:<port>
```

---

## Stopping Services

### Stop All Services

```bash
cd docker
docker compose down
```

### Stop Individual Service Groups

```bash
cd docker/<group>
docker compose down
```

### Stop and Remove All Data

```bash
# WARNING: This deletes all data!
cd docker
docker compose down -v
docker volume prune -f
```

---

## Updating Services

### Pull Latest Images

```bash
cd docker
docker compose pull
docker compose up -d
```

### Rebuild Custom Images (BlinkFinance)

```bash
cd docker/fintech
docker compose build --no-cache blinkfinance
docker compose up -d blinkfinance
```

---

## Backup and Restore

### Backup Volumes

```bash
# List all volumes
docker volume ls | grep thaliumx

# Backup a volume
docker run --rm -v thaliumx-postgres-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/postgres-backup.tar.gz -C /data .
```

### Restore Volumes

```bash
# Restore a volume
docker run --rm -v thaliumx-postgres-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/postgres-backup.tar.gz -C /data
```

---

## Next Steps

After installation:

1. **Access the Frontend**: Open http://localhost:3001
2. **Configure Keycloak**: Create realms, clients, and users
3. **Setup Grafana Dashboards**: Import pre-built dashboards
4. **Configure APISIX Routes**: Define API routes and plugins
5. **Setup Wazuh Agents**: Install agents on hosts to monitor
6. **Create Kafka Topics**: Define topics for your application
7. **Register Schemas**: Add Avro/Protobuf schemas to Schema Registry
8. **Configure OPA Policies**: Write Rego policies for authorization
9. **Review Security**: See [Security Documentation](SECURITY.md)

---

## Support

For issues and questions:
- Check the [Installation Tips](installation-tips/README.md) for known issues
- Review the [Core Services](core-services/README.md) documentation
- Review the [Security Documentation](SECURITY.md)
- Review the [Architecture Documentation](ARCHITECTURE.md)
- Check container logs: `docker logs thaliumx-<service-name>`
