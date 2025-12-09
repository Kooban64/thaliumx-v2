# ThaliumX Deployment Readiness Guide
====================================

This guide ensures your ThaliumX system can be rebuilt anytime while preserving all data and configurations.

## 🎯 Problem Solved

When you moved to Vault and hardened security, seeded data was wiped out. This guide provides a complete solution for persistent, rebuildable infrastructure.

## 📋 Prerequisites

### System Requirements
- Docker Engine 20.10+
- Docker Compose 2.0+
- 16GB RAM minimum
- 100GB storage minimum
- Linux/Unix environment

### Directory Structure
```bash
/opt/thaliumx/
├── data/           # Persistent data volumes
│   ├── postgres/
│   ├── redis/
│   ├── mongodb/
│   ├── vault/
│   ├── keycloak/
│   └── ...
├── backups/        # Automated backups
│   ├── vault/
│   ├── data/
│   └── config/
└── logs/          # System logs
```

## 🚀 Quick Start

### 1. Initial System Setup
```bash
# Create required directories
sudo mkdir -p /opt/thaliumx/{data,backups/{vault,data,config},logs}

# Set proper permissions
sudo chown -R $USER:$USER /opt/thaliumx

# Navigate to project
cd /path/to/thaliumx

# Run system initialization
./docker/scripts/init-system.sh init
```

### 2. Start Services
```bash
# Start with persistent volumes
docker compose -f docker/compose.yaml -f docker/docker-compose.override.yml up -d

# Or use the convenience script
./docker/scripts/init-system.sh start
```

### 3. Verify System Health
```bash
# Check system status
./docker/scripts/init-system.sh check

# View running services
docker ps --filter "name=thaliumx-"
```

## 🔧 Configuration Management

### Environment Variables
Create `.env` file in the `docker/` directory:
```bash
# Database credentials (generated securely)
POSTGRES_USER=thaliumx
POSTGRES_PASSWORD=<SECURE_PASSWORD>
REDIS_PASSWORD=<SECURE_PASSWORD>
MONGODB_ROOT_PASSWORD=<SECURE_PASSWORD>

# Vault configuration
VAULT_TOKEN=<VAULT_ROOT_TOKEN>

# Service ports
BACKEND_PORT=3002
FRONTEND_PORT=3000
APISIX_PORT=9080
```

### Secrets Management
All secrets are stored in Vault at `kv/fintech/`:
- Database passwords
- JWT secrets
- API keys
- Encryption keys

## 💾 Data Persistence

### Volume Mapping
All data volumes are mapped to `/opt/thaliumx/data/`:
- `postgres-data` → `/opt/thaliumx/data/postgres`
- `redis-data` → `/opt/thaliumx/data/redis`
- `vault-data` → `/opt/thaliumx/data/vault`
- `keycloak-data` → `/opt/thaliumx/data/keycloak`

### Backup Strategy
```bash
# Create full system backup
./docker/scripts/init-system.sh backup

# Backup specific volume
docker run --rm -v thaliumx-postgres-data:/data -v /opt/thaliumx/backups:/backup \
  alpine tar czf /backup/postgres_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .
```

### Restore from Backup
```bash
# Restore full system
./docker/scripts/init-system.sh restore /opt/thaliumx/backups/thaliumx_full_backup_20251207.tar.gz

# Restore specific volume
docker run --rm -v thaliumx-postgres-data:/data -v /opt/thaliumx/backups:/backup \
  alpine sh -c "cd /data && tar xzf /backup/postgres_backup.tar.gz"
```

## 🔄 Rebuild Process

### Complete System Rebuild
```bash
# 1. Stop all services
docker compose -f docker/compose.yaml -f docker/docker-compose.override.yml down

# 2. Backup current data (optional but recommended)
./docker/scripts/init-system.sh backup

# 3. Remove containers and networks (keep volumes)
docker compose -f docker/compose.yaml -f docker/docker-compose.override.yml down -v --remove-orphans

# 4. Rebuild and start
docker compose -f docker/compose.yaml -f docker/docker-compose.override.yml up -d --build

# 5. Run initialization
./docker/scripts/init-system.sh init
```

### Service-Specific Rebuild
```bash
# Rebuild specific service
docker compose -f docker/compose.yaml -f docker/docker-compose.override.yml up -d --build postgres

# Restart dependent services
docker compose -f docker/compose.yaml -f docker/docker-compose.override.yml up -d backend
```

## 🔒 Security Considerations

### Vault Management
- Vault data is persisted and backed up
- Root token and unseal keys are stored securely
- Automatic unsealing is supported

### Certificate Management
TLS certificates are stored in `docker/certs/`:
```
docker/certs/
├── ca/           # Certificate Authority
├── services/     # Service certificates
└── clients/      # Client certificates
```

### Network Security
- Databases isolated in `database-network`
- Monitoring services in `monitoring-network`
- API Gateway enforces TLS

## 📊 Monitoring & Observability

### Health Checks
All services include health checks:
```bash
# Check service health
docker ps --filter "name=thaliumx-" --format "table {{.Names}}\t{{.Status}}"

# View logs
docker logs thaliumx-backend --tail 50
```

### Metrics & Alerts
- Prometheus collects metrics from all services
- Grafana provides dashboards
- Alertmanager handles notifications
- Loki aggregates logs

## 🐛 Troubleshooting

### Common Issues

#### Services Won't Start
```bash
# Check logs
docker logs <service_name>

# Check dependencies
docker compose -f docker/compose.yaml -f docker/docker-compose.override.yml ps

# Restart with verbose logging
docker compose -f docker/compose.yaml -f docker/docker-compose.override.yml up <service_name>
```

#### Database Connection Issues
```bash
# Check database connectivity
docker exec thaliumx-postgres pg_isready -U thaliumx

# View database logs
docker logs thaliumx-postgres
```

#### Vault Issues
```bash
# Check Vault status
docker exec thaliumx-vault vault status

# Check Vault logs
docker logs thaliumx-vault
```

### Data Recovery
If data is lost:
1. Stop all services
2. Restore from backup
3. Restart services
4. Run initialization

## 📈 Scaling & High Availability

### Horizontal Scaling
```bash
# Scale services
docker compose -f docker/compose.yaml -f docker/docker-compose.override.yml up -d --scale backend=3

# Load balancing via APISIX
# Configure upstreams in apisix config
```

### High Availability
For production HA:
1. Use external databases (RDS, Cloud SQL)
2. Implement Vault HA with Consul
3. Use Kubernetes for orchestration
4. Implement proper backup strategies

## 🔧 Maintenance Tasks

### Regular Backups
```bash
# Daily backup script
#!/bin/bash
/opt/thaliumx/docker/scripts/init-system.sh backup
```

### Log Rotation
```bash
# Rotate Docker logs
docker system prune -f

# Archive old logs
find /opt/thaliumx/logs -name "*.log" -mtime +30 -exec gzip {} \;
```

### Updates
```bash
# Update services
docker compose -f docker/compose.yaml -f docker/docker-compose.override.yml pull
docker compose -f docker/compose.yaml -f docker/docker-compose.override.yml up -d

# Update with zero downtime
docker compose -f docker/compose.yaml -f docker/docker-compose.override.yml up -d --no-deps <service>
```

## 📞 Support

### Logs to Collect
When reporting issues:
```bash
# System info
docker version
docker compose version
uname -a

# Service status
docker ps -a --filter "name=thaliumx-"

# Recent logs
docker logs thaliumx-backend --tail 100
docker logs thaliumx-vault --tail 50
```

### Emergency Recovery
If system is completely broken:
```bash
# Nuclear option - complete reset
docker compose -f docker/compose.yaml -f docker/docker-compose.override.yml down -v --remove-orphans
sudo rm -rf /opt/thaliumx/data/*
./docker/scripts/init-system.sh init
```

---

## ✅ Checklist

- [ ] Directories created (`/opt/thaliumx/{data,backups,logs}`)
- [ ] Permissions set correctly
- [ ] `.env` file configured
- [ ] Vault initialized and unsealed
- [ ] Services starting successfully
- [ ] Data persisting across restarts
- [ ] Backups working
- [ ] Monitoring accessible

**Your ThaliumX system is now rebuildable anytime! 🎉**