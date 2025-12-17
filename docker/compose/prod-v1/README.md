# ThaliumX Production v1 Docker Compose

## Overview
Production-ready Docker Compose setup for ThaliumX platform with enterprise security and scalability.

**Version:** prod-v1
**Date:** 2025-12-17
**Status:** Active Development

## Architecture
- **Base Layer:** Shared networks, volumes, secrets
- **Infrastructure Layer:** Core services (Vault, PostgreSQL, Redis)
- **Database Layer:** Distributed databases (Citus, TimescaleDB, MongoDB)
- **Application Layer:** Business services
- **Infrastructure Layer:** Supporting services (Kafka, Monitoring, etc.)

## Quick Start

```bash
# Start foundation
docker compose -f compose/prod-v1/base.yml up -d

# Add infrastructure
docker compose -f compose/prod-v1/base.yml -f compose/prod-v1/infrastructure.yml up -d

# Add databases
docker compose -f compose/prod-v1/base.yml -f compose/prod-v1/infrastructure.yml -f compose/prod-v1/databases.yml up -d
```

## File Structure

```
compose/prod-v1/
├── README.md                 # This file
├── base.yml                  # Shared resources (networks, volumes, secrets)
├── infrastructure.yml        # Core infra (Vault, Postgres, Redis)
├── databases.yml             # Database services (Citus, TimescaleDB, MongoDB)
├── applications.yml          # Business applications (Backend, Compliance)
├── messaging.yml             # Message queue (Kafka, Redis queue)
├── gateway.yml               # API Gateway (APISIX, etcd)
├── monitoring.yml            # Observability (Prometheus, Grafana)
└── production.yml            # Production overrides (all services)
```

## Security Features

- ✅ SSL/TLS encryption on all connections
- ✅ Certificate-based authentication
- ✅ Docker secrets for credential management
- ✅ Vault for secret management
- ✅ Network isolation
- ✅ Audit logging

## Development Workflow

1. **Work on base layer first** - Ensure shared resources are correct
2. **Add services incrementally** - One layer at a time
3. **Test thoroughly** - Validate health, connectivity, security
4. **Document changes** - Update this README and related docs
5. **Commit atomically** - Each layer as separate commit

## Current Service Status (Live)

| Service | Status | SSL | Health Check | Container Status |
|---------|--------|-----|--------------|------------------|
| Vault | ✅ **LIVE** | ✅ TLS | ✅ Status API | Up 3h |
| PostgreSQL | ✅ **LIVE** | ✅ SSL | ✅ pg_isready | Up 4h (healthy) |
| Redis | ⚠️ **LIVE** | ✅ TLS | ⚠️ Health Check* | Up 3h (unhealthy) |
| Citus Coordinator | ✅ **LIVE** | ⚠️ Disabled** | ✅ pg_isready | Up 9m (healthy) |
| Citus Worker-1 | ✅ **LIVE** | ⚠️ Disabled** | ✅ pg_isready | Up 9m (healthy) |
| Citus Worker-2 | ✅ **LIVE** | ⚠️ Disabled** | ✅ pg_isready | Up 9m (healthy) |
| TimescaleDB | ✅ **LIVE** | ⚠️ Disabled** | ✅ pg_isready | Up 9m (healthy) |
| MongoDB | ✅ **LIVE** | ⚠️ Disabled** | ✅ mongosh ping | Up 12s (healthy) |

**SSL Notes:**
- ✅ = SSL enabled and working
- ⚠️ Health Check* = TLS enabled, health check simplified (Redis ping works)
- ⚠️ Disabled** = SSL configured but temporarily disabled due to certificate permissions

**SSL Notes:**
- ✅ = SSL enabled and working
- ⚠️ Disabled* = SSL configured but temporarily disabled due to certificate permission issues
- Requires maintenance window to re-enable SSL on Citus/TimescaleDB

## Migration Path

### From Legacy Compose Files
- Old files moved to `compose/archive/`
- Reference old configs for service-specific settings
- Gradually migrate services to new structure

### To Kubernetes
- Compose files designed for easy k8s conversion
- Use `kompose` or manual manifest creation
- Maintain service boundaries for k8s deployments

## Troubleshooting

### Common Issues
1. **SSL Permission Errors**: Run `chown 70:70 certs/services/*/server.key`
2. **Service Dependencies**: Use `depends_on` with `condition: service_healthy`
3. **Resource Limits**: Monitor with `docker stats`

### Health Checks
```bash
# Check all services
docker compose -f compose/prod-v1/production.yml ps

# Check specific service
docker compose -f compose/prod-v1/base.yml -f compose/prod-v1/infrastructure.yml ps vault

# View logs
docker compose -f compose/prod-v1/base.yml -f compose/prod-v1/infrastructure.yml logs vault
```

## Contributing

1. Follow the layered architecture
2. Test changes locally before committing
3. Update this README for any structural changes
4. Use semantic commit messages

## Future Enhancements

- [ ] Kubernetes migration manifests
- [ ] CI/CD pipeline integration
- [ ] Automated testing suite
- [ ] Service mesh integration
- [ ] Multi-region deployment support