# Installation Tips & Special Fixes

This document captures all the important fixes, workarounds, and special configurations discovered during the Thaliumx platform setup.

## Table of Contents

1. [Wazuh SIEM/XDR](#wazuh-siemxdr)
2. [BlinkFinance (Blnk)](#blinkfinance-blnk)
3. [Schema Registry](#schema-registry)
4. [Kafka](#kafka)
5. [Vault](#vault)
6. [Keycloak](#keycloak)
7. [APISIX](#apisix)
8. [General Docker Tips](#general-docker-tips)

---

## Wazuh SIEM/XDR

### SSL Certificate Generation

Wazuh requires SSL certificates for secure communication between components. The certificates must be generated before starting the services.

**Location**: `docker/wazuh/scripts/generate-certs.sh`

```bash
# Run the certificate generation script
cd docker/wazuh
chmod +x scripts/generate-certs.sh
./scripts/generate-certs.sh
```

### OpenSearch Security Plugin Initialization

After starting the Wazuh Indexer for the first time, you must initialize the security plugin:

```bash
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

### Dashboard Configuration Issue

**Problem**: The Wazuh Dashboard startup script appends to the `wazuh.yml` configuration file, causing duplicate `hosts:` entries.

**Solution**: Do NOT mount a custom `wazuh.yml` file. Instead, use a Docker volume and let the startup script configure it via environment variables:

```yaml
volumes:
  - wazuh_dashboard_config:/usr/share/wazuh-dashboard/data/wazuh/config  # Volume, not bind mount
```

### Default Credentials

| Component | Username | Password |
|-----------|----------|----------|
| Dashboard | admin | SecretPassword |
| API | wazuh-wui | MyS3cr37P450r.*- |

---

## BlinkFinance (Blnk)

### Typesense API Key Hardcoded

**Problem**: Blnk v0.7.0 has a hardcoded Typesense API key `blnk-api-key` in the source code.

**Solution**: Configure Typesense to use this exact API key:

```yaml
# docker/typesense/compose.yaml
environment:
  TYPESENSE_API_KEY: blnk-api-key  # Must match Blnk's hardcoded key
```

### Building from Source

Blnk requires building from source as there's no official Docker image:

```dockerfile
# docker/fintech/blinkfinance/Dockerfile
FROM golang:1.22-alpine AS builder
RUN apk add --no-cache git make gcc musl-dev
WORKDIR /app
RUN git clone --depth 1 --branch v0.7.0 https://github.com/blnkfinance/blnk.git .
RUN go mod download
RUN CGO_ENABLED=0 GOOS=linux go build -o blnk ./cmd/blnk

FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /app/blnk /usr/local/bin/blnk
EXPOSE 5001
CMD ["blnk", "start"]
```

### Configuration File

Blnk requires a `blnk.json` configuration file:

```json
{
  "project_name": "Thaliumx Ledger",
  "data_source": {
    "dns": "postgres://blnk:ThaliumX2025@thaliumx-postgres:5432/blnk?sslmode=disable"
  },
  "redis": {
    "dns": "redis://thaliumx-redis:6379"
  },
  "server": {
    "port": "5001",
    "ssl": false
  },
  "type_sense": {
    "dns": "http://thaliumx-typesense:8108"
  }
}
```

---

## Schema Registry

### Port Conflict with Kafka UI

**Problem**: Both Schema Registry and Kafka UI default to port 8081.

**Solution**: Map Schema Registry to a different external port:

```yaml
ports:
  - "8085:8081"  # External port 8085, internal 8081
```

### Kafka Bootstrap Server

Schema Registry needs to connect to Kafka using the internal Docker network hostname:

```yaml
environment:
  SCHEMA_REGISTRY_KAFKASTORE_BOOTSTRAP_SERVERS: thaliumx-kafka:9092
```

---

## Kafka

### KRaft Mode (No Zookeeper)

Kafka runs in KRaft mode without Zookeeper. Key configuration:

```yaml
environment:
  KAFKA_NODE_ID: 1
  KAFKA_PROCESS_ROLES: broker,controller
  KAFKA_CONTROLLER_QUORUM_VOTERS: 1@thaliumx-kafka:9093
  CLUSTER_ID: thaliumx-kafka-cluster-01
```

### Confluent vs Bitnami Images

We use Confluent images (`confluentinc/cp-kafka:7.6.0`) for better compatibility with Schema Registry.

---

## Vault

### Development Mode vs Production

Vault runs in development mode for ease of setup. For production:

1. Use proper storage backend (not in-memory)
2. Initialize and unseal properly
3. Use proper TLS certificates

### Root Token

The development root token is set via environment variable:

```yaml
environment:
  VAULT_DEV_ROOT_TOKEN_ID: <VAULT_TOKEN>
```

**⚠️ Change this in production!**

---

## Keycloak

### Database Initialization

Keycloak requires PostgreSQL. The database is created automatically, but you may need to wait for PostgreSQL to be fully ready:

```yaml
depends_on:
  postgres:
    condition: service_healthy
```

### Admin Credentials

```yaml
environment:
  KEYCLOAK_ADMIN: admin
  KEYCLOAK_ADMIN_PASSWORD: ThaliumX2025
```

---

## APISIX

### etcd Dependency

APISIX requires etcd to be running and healthy before it can start:

```yaml
depends_on:
  etcd:
    condition: service_healthy
```

### Dashboard Configuration

The APISIX Dashboard needs to connect to both APISIX Admin API and etcd:

```yaml
environment:
  APISIX_ADMIN_API_URL: http://thaliumx-apisix:9180
  ETCD_ENDPOINTS: http://thaliumx-etcd:2379
```

---

## General Docker Tips

### Network Configuration

All services use a shared bridge network with a specific subnet:

```yaml
networks:
  thaliumx-net:
    name: thaliumx-net
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
```

### Container Naming Convention

All containers are prefixed with `thaliumx-` for easy identification:

```yaml
container_name: thaliumx-service-name
hostname: thaliumx-service-name
```

### Health Checks

Every service should have a health check for proper orchestration:

```yaml
healthcheck:
  test: ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 5
  start_period: 60s
```

### Volume Naming

Volumes are named with the `thaliumx-` prefix:

```yaml
volumes:
  service_data:
    name: thaliumx-service-data
```

### Restart Policy

All services use `unless-stopped` restart policy:

```yaml
restart: unless-stopped
```

### Memory Limits

For Java-based services, set appropriate heap sizes:

```yaml
environment:
  JAVA_OPTS: "-Xmx512m -Xms256m"
  # or
  KAFKA_HEAP_OPTS: "-Xmx512M -Xms512M"
```

---

## Troubleshooting

### Container Won't Start

1. Check logs: `docker logs thaliumx-service-name`
2. Check dependencies are healthy: `docker ps --filter name=thaliumx`
3. Check network connectivity: `docker network inspect thaliumx-net`

### Port Already in Use

```bash
# Find what's using the port
netstat -tlnp | grep PORT
# or
ss -tlnp | grep PORT
# or
docker ps --format "{{.Names}}\t{{.Ports}}" | grep PORT
```

### Volume Permission Issues

```bash
# Check volume permissions
docker volume inspect thaliumx-volume-name

# Fix permissions (if needed)
docker run --rm -v thaliumx-volume-name:/data alpine chown -R 1000:1000 /data
```

### Service Discovery Issues

Ensure services use the container hostname (not localhost) for inter-service communication:

```yaml
# Correct
DATABASE_URL: postgres://user:pass@thaliumx-postgres:5432/db

# Incorrect (won't work between containers)
DATABASE_URL: postgres://user:pass@localhost:5432/db
```
