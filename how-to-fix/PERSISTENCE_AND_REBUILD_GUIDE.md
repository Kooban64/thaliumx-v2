# ThaliumX Persistence and Rebuild Survival Guide

## Overview

This document explains how ThaliumX ensures 100% data persistence across container restarts, rebuilds, and system reboots.

## Architecture

ThaliumX uses a layered persistence strategy:

1. **Named Docker Volumes** - For database data
2. **Bind Mounts** - For configuration files
3. **Idempotent Initialization** - Scripts that can run multiple times safely
4. **Password Synchronization** - Ensuring credentials match between config and data

---

## Volume Persistence Matrix

| Service | Volume Name | Mount Point | Data Type |
|---------|-------------|-------------|-----------|
| PostgreSQL | `thaliumx-postgres-data` | `/var/lib/postgresql/data` | Database files |
| MongoDB | `thaliumx-mongodb-data` | `/data/db` | Database files |
| Redis | `thaliumx-redis-data` | `/data` | AOF persistence |
| Typesense | `thaliumx-typesense-data` | `/data` | Search index |
| Vault | `thaliumx-vault-data` | `/vault/data` | Secrets storage |
| Vault Logs | `thaliumx-vault-logs` | `/vault/logs` | Audit logs |
| Keycloak | `thaliumx-keycloak-data` | `/opt/keycloak/data` | Session data |
| Kafka | `thaliumx-kafka-data` | `/bitnami/kafka` | Message logs |
| Zookeeper | `thaliumx-zookeeper-data` | `/bitnami/zookeeper` | Cluster state |
| Wazuh Manager | `thaliumx-wazuh-manager-*` | Various | Security data |
| Wazuh Indexer | `thaliumx-wazuh-indexer-data` | `/var/lib/wazuh-indexer` | Security index |
| TimescaleDB | `thaliumx-timescaledb-data` | `/var/lib/postgresql/data` | Time-series data |
| Citus | `thaliumx-citus-*-data` | `/var/lib/postgresql/data` | Distributed data |
| Grafana | `thaliumx-grafana-data` | `/var/lib/grafana` | Dashboards |
| Prometheus | `thaliumx-prometheus-data` | `/prometheus` | Metrics |
| Loki | `thaliumx-loki-data` | `/loki` | Logs |

---

## Critical Persistence Rules

### Rule 1: Never Delete Named Volumes

```bash
# DANGEROUS - Will lose all data!
docker volume rm thaliumx-postgres-data

# SAFE - Only removes containers, keeps volumes
docker compose down

# DANGEROUS - Removes volumes too!
docker compose down -v
```

### Rule 2: Password Synchronization

When PostgreSQL (or any database) is first initialized, it stores the password in the volume. If you change the password in `.env` but don't update the database, authentication will fail.

**Solution: Update passwords in both places**

```bash
# Update PostgreSQL password
docker exec thaliumx-postgres psql -U thaliumx -c "ALTER USER thaliumx WITH PASSWORD 'new_password';"

# Then update .env file
POSTGRES_PASSWORD=new_password
```

### Rule 3: Idempotent Initialization

All initialization scripts must be idempotent (safe to run multiple times):

```sql
-- Good: Idempotent
CREATE DATABASE IF NOT EXISTS mydb;
CREATE USER IF NOT EXISTS myuser;

-- Bad: Will fail on second run
CREATE DATABASE mydb;
CREATE USER myuser;
```

---

## Service-Specific Persistence

### PostgreSQL / TimescaleDB

**Data Location:** `/var/lib/postgresql/data`

**Persistence Mechanism:**
- Named volume `thaliumx-postgres-data`
- WAL (Write-Ahead Logging) for crash recovery
- Initialization scripts in `/docker-entrypoint-initdb.d/`

**Rebuild Survival:**
- Data survives container rebuild
- Password must match volume's stored password
- Init scripts only run on empty volume

**Backup:**
```bash
docker exec thaliumx-postgres pg_dumpall -U thaliumx > backup.sql
```

**Restore:**
```bash
docker exec -i thaliumx-postgres psql -U thaliumx < backup.sql
```

### MongoDB

**Data Location:** `/data/db`

**Persistence Mechanism:**
- Named volume `thaliumx-mongodb-data`
- WiredTiger storage engine with journaling

**Rebuild Survival:**
- Data survives container rebuild
- Authentication credentials stored in volume

**Backup:**
```bash
docker exec thaliumx-mongodb mongodump --out /data/backup
docker cp thaliumx-mongodb:/data/backup ./mongodb-backup
```

### Redis

**Data Location:** `/data`

**Persistence Mechanism:**
- Named volume `thaliumx-redis-data`
- AOF (Append Only File) persistence enabled
- `--appendonly yes` flag

**Rebuild Survival:**
- Data survives container rebuild
- Password in command line, not stored in volume

### Vault

**Data Location:** `/vault/data`

**Persistence Mechanism:**
- Named volume `thaliumx-vault-data`
- File storage backend

**CRITICAL: Dev Mode vs Production Mode**

| Mode | Data Persistence | Unseal Required |
|------|------------------|-----------------|
| Dev (`server -dev`) | ❌ In-memory only | No |
| Production (`server`) | ✅ Persistent | Yes |

**Rebuild Survival (Production Mode):**
- Data survives container rebuild
- **Manual unseal required after restart**
- Unseal keys must be stored securely

**Auto-Unseal Options:**
1. AWS KMS
2. Azure Key Vault
3. GCP Cloud KMS
4. HashiCorp Vault Transit

### Keycloak

**Data Location:** `/opt/keycloak/data` (sessions only)

**Primary Storage:** PostgreSQL database

**Persistence Mechanism:**
- Database stores all configuration
- Volume stores session data and caches

**Rebuild Survival:**
- All data in PostgreSQL survives
- Sessions may be lost (users re-login)

### Kafka

**Data Location:** `/bitnami/kafka`

**Persistence Mechanism:**
- Named volume `thaliumx-kafka-data`
- Log segments stored on disk

**Rebuild Survival:**
- Messages survive container rebuild
- Consumer offsets stored in `__consumer_offsets` topic

### Wazuh

**Data Locations:**
- Manager: `/var/ossec/data`, `/var/ossec/logs`
- Indexer: `/var/lib/wazuh-indexer`

**Persistence Mechanism:**
- Multiple named volumes
- OpenSearch for indexed data

**Rebuild Survival:**
- Security data survives rebuild
- Dashboard password in keystore (regenerated on rebuild)

---

## Rebuild Procedures

### Safe Rebuild (Preserves Data)

```bash
cd docker

# Stop all containers
docker compose down

# Rebuild images
docker compose build --no-cache

# Start containers
docker compose up -d

# Verify health
docker compose ps
```

### Full System Restart

```bash
cd docker

# Stop everything
docker compose down

# Start everything
docker compose up -d

# Wait for health checks
sleep 60

# Check status
docker compose ps --format "table {{.Name}}\t{{.Status}}"
```

### After Rebuild Checklist

1. **Check all containers are healthy:**
   ```bash
   docker ps --filter "health=unhealthy"
   ```

2. **Verify database connectivity:**
   ```bash
   docker exec thaliumx-postgres pg_isready
   ```

3. **Check Vault seal status (production):**
   ```bash
   docker exec thaliumx-vault vault status
   ```

4. **Verify Keycloak health:**
   ```bash
   curl -s http://localhost:8080/health/ready
   ```

5. **Check Kafka topics:**
   ```bash
   docker exec thaliumx-kafka kafka-topics.sh --list --bootstrap-server localhost:9092
   ```

---

## Backup Strategy

### Automated Backup Script

```bash
#!/bin/bash
# backup-all.sh

BACKUP_DIR="/opt/thaliumx/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "${BACKUP_DIR}"

# PostgreSQL
docker exec thaliumx-postgres pg_dumpall -U thaliumx > "${BACKUP_DIR}/postgres.sql"

# MongoDB
docker exec thaliumx-mongodb mongodump --archive > "${BACKUP_DIR}/mongodb.archive"

# Redis
docker exec thaliumx-redis redis-cli -a "${REDIS_PASSWORD}" BGSAVE
docker cp thaliumx-redis:/data/dump.rdb "${BACKUP_DIR}/redis.rdb"

# Vault (if using file storage)
docker cp thaliumx-vault:/vault/data "${BACKUP_DIR}/vault-data"

# Compress
tar -czf "${BACKUP_DIR}.tar.gz" -C "$(dirname ${BACKUP_DIR})" "$(basename ${BACKUP_DIR})"
rm -rf "${BACKUP_DIR}"

echo "Backup complete: ${BACKUP_DIR}.tar.gz"
```

### Backup Schedule (Cron)

```cron
# Daily backup at 2 AM
0 2 * * * /opt/thaliumx/scripts/backup-all.sh

# Weekly full backup on Sunday at 3 AM
0 3 * * 0 /opt/thaliumx/scripts/backup-full.sh
```

---

## Disaster Recovery

### Scenario 1: Container Crash

**Impact:** Minimal - container restarts automatically
**Recovery:** Automatic via `restart: unless-stopped`

### Scenario 2: Volume Corruption

**Impact:** Data loss for affected service
**Recovery:**
1. Stop affected container
2. Remove corrupted volume
3. Restore from backup
4. Restart container

### Scenario 3: Host System Failure

**Impact:** All services down
**Recovery:**
1. Provision new host
2. Install Docker
3. Restore volumes from backup
4. Start containers

### Scenario 4: Vault Sealed After Restart

**Impact:** Applications cannot access secrets
**Recovery:**
1. Unseal Vault with 3 of 5 keys
2. Or use auto-unseal mechanism

---

## Production Checklist

### Before Going Live

- [ ] All services using named volumes (not bind mounts for data)
- [ ] Vault running in production mode (not dev)
- [ ] Vault auto-unseal configured
- [ ] TLS enabled for Vault and Keycloak
- [ ] Backup scripts configured and tested
- [ ] Monitoring alerts for unhealthy containers
- [ ] Password synchronization verified
- [ ] Init scripts are idempotent
- [ ] Resource limits configured
- [ ] Log rotation configured

### Regular Maintenance

- [ ] Weekly: Verify backup integrity
- [ ] Monthly: Test restore procedure
- [ ] Quarterly: Rotate credentials
- [ ] Annually: Renew TLS certificates

---

## Troubleshooting

### Container Won't Start After Rebuild

1. Check logs: `docker logs <container>`
2. Verify volume exists: `docker volume ls | grep thaliumx`
3. Check password sync: Compare `.env` with database

### Authentication Failures

1. Check password in `.env`
2. Verify password in database
3. Update if mismatched:
   ```bash
   docker exec thaliumx-postgres psql -U thaliumx -c "ALTER USER username WITH PASSWORD 'password';"
   ```

### Vault Sealed

1. Get unseal keys from secure storage
2. Unseal with 3 keys:
   ```bash
   vault operator unseal <key1>
   vault operator unseal <key2>
   vault operator unseal <key3>
   ```

### Data Not Persisting

1. Verify volume mount in compose file
2. Check volume exists: `docker volume inspect <volume>`
3. Verify data directory permissions

---

## Quick Reference

### Volume Commands

```bash
# List all ThaliumX volumes
docker volume ls | grep thaliumx

# Inspect a volume
docker volume inspect thaliumx-postgres-data

# Backup a volume
docker run --rm -v thaliumx-postgres-data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-data.tar.gz /data

# Restore a volume
docker run --rm -v thaliumx-postgres-data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres-data.tar.gz -C /
```

### Health Check Commands

```bash
# All container health
docker ps --format "table {{.Names}}\t{{.Status}}"

# Unhealthy only
docker ps --filter "health=unhealthy"

# Specific service logs
docker logs --tail 100 -f thaliumx-postgres
```

### Emergency Commands

```bash
# Force restart all
docker compose down && docker compose up -d

# Restart single service
docker compose restart keycloak

# Enter container shell
docker exec -it thaliumx-postgres bash