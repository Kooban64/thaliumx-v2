# ThaliumX Backend Persistence Guide

## Overview

This guide ensures all updates and configurations persist across container rebuilds and restarts.

## Automatic Persistence Mechanisms

### 1. Database Migrations

**Status**: ✅ Automatic on startup

- Migrations run automatically in production mode on application startup
- Migration state is tracked in `sequelize_meta` table
- Migrations are idempotent - safe to run multiple times
- Location: `src/migrations/runner.ts`

**How it works:**
```typescript
// In DatabaseService.initialize() - production mode
if (process.env.NODE_ENV === 'production') {
  await MigrationRunner.runMigrations();
}
```

**Verification:**
```bash
# Check migration status
docker exec thaliumx-backend psql -U thaliumx -d thaliumx -c "SELECT * FROM sequelize_meta;"

# Run persistence verification
npm run verify:persistence
```

### 2. Docker Volumes

**Status**: ✅ Configured in compose files

All persistent data is stored in Docker volumes:

- **PostgreSQL**: `thaliumx-postgres-data` → `/var/lib/postgresql/data`
- **Redis**: `thaliumx-redis-data` → `/data`
- **MongoDB**: `thaliumx-mongodb-data` → `/data/db`
- **Vault**: `thaliumx-vault-data` → `/vault/data`

**Volumes persist across:**
- Container restarts
- Container rebuilds
- Docker Compose down/up
- System reboots (if on persistent storage)

**Verification:**
```bash
# List all volumes
docker volume ls | grep thaliumx

# Inspect a volume
docker volume inspect thaliumx-postgres-data
```

### 3. Environment Variables

**Status**: ✅ Loaded from multiple sources

Configuration priority:
1. Environment variables (highest priority)
2. Vault secrets (production)
3. `.secrets` files (development fallback)

**Sources:**
- `docker/.env` - Main environment file
- `docker/core/core.env` - Core services
- `docker/trading/trading.env` - Trading services
- Docker Compose `environment:` sections

**Critical Variables:**
```bash
NODE_ENV=production
DB_HOST=postgres
DB_NAME=thaliumx
DB_USER=thaliumx
DB_PASSWORD=<from-vault-or-secrets>
REDIS_HOST=redis
OPA_URL=http://opa:8181
```

### 4. OPA Services (New)

**Status**: ✅ Singleton pattern ensures persistence

All OPA services use singleton pattern:
- `opaService` - HTTP-based OPA client
- `opaCacheService` - Multi-tier caching (memory + Redis)
- `policyManager` - Policy routing manager

**Persistence:**
- Cache data stored in Redis (persists across restarts)
- Connection pooling configured (reuses connections)
- Metrics tracked in Prometheus (persists in volume)

**Verification:**
```bash
# Check OPA service health
curl http://localhost:3002/health

# Check OPA metrics
curl http://localhost:9090/api/v1/query?query=opa_evaluations_total
```

### 5. Service Initialization

**Status**: ✅ Automatic on startup

All services initialize automatically in `src/index.ts`:

```typescript
// Critical services (must succeed)
- DatabaseService
- RedisService

// Non-critical services (log failures, continue)
- All other services (48 total)
```

**Initialization order:**
1. Logger
2. Database (runs migrations)
3. Redis
4. All other services

### 6. Configuration Files

**Status**: ✅ Included in Docker image

All configuration files are copied into Docker image:
- TypeScript source files → compiled to `dist/`
- Migration files → included in build
- Service files → all included

**Build process:**
```dockerfile
# Copy source code
COPY docker/backend/src ./src

# Build TypeScript
RUN pnpm run build

# Copy built files
COPY --from=builder /app/dist ./dist
```

## Manual Verification

### Run Persistence Verification Script

```bash
# From backend directory
npm run verify:persistence

# Or directly
ts-node scripts/verify-persistence.ts
```

This script checks:
- ✅ Database connection and migrations
- ✅ Redis connection and read/write
- ✅ OPA services (service, cache, policy manager)
- ✅ Configuration loading
- ✅ Metrics service
- ✅ Environment variables

### Check Service Health

```bash
# Backend health
curl http://localhost:3002/health

# Database connection
docker exec thaliumx-backend psql -U thaliumx -d thaliumx -c "SELECT 1;"

# Redis connection
docker exec thaliumx-redis redis-cli ping

# OPA health
curl http://localhost:8181/health
```

## Rebuild Process

### Safe Rebuild Steps

1. **Stop services** (data preserved in volumes):
   ```bash
   docker compose -f docker/compose.yaml down
   ```

2. **Rebuild images**:
   ```bash
   docker compose -f docker/compose.yaml build --no-cache backend
   ```

3. **Start services** (migrations run automatically):
   ```bash
   docker compose -f docker/compose.yaml up -d
   ```

4. **Verify persistence**:
   ```bash
   docker exec thaliumx-backend npm run verify:persistence
   ```

### What Persists

✅ **Persists:**
- Database data (in volumes)
- Redis cache (in volumes)
- Migration state (in database)
- Configuration (in environment variables)
- OPA cache (in Redis)
- Metrics (in Prometheus volume)

❌ **Does NOT persist:**
- In-memory cache (rebuilt on startup)
- Active connections (recreated on startup)
- Temporary files (cleared on restart)

## Troubleshooting

### Migrations Not Running

**Symptom**: Tables missing after rebuild

**Solution**:
```bash
# Manually run migrations
docker exec thaliumx-backend npm run migrate

# Or via direct script
docker exec thaliumx-backend ts-node src/migrations/runner.ts
```

### OPA Cache Empty After Restart

**Expected**: In-memory cache is cleared, but Redis cache persists

**Verification**:
```bash
# Check Redis cache
docker exec thaliumx-redis redis-cli KEYS "opa:*"
```

### Configuration Not Loading

**Symptom**: Services fail to start with config errors

**Solution**:
1. Check environment variables:
   ```bash
   docker exec thaliumx-backend env | grep -E "(DB_|REDIS_|OPA_)"
   ```

2. Check Vault connection:
   ```bash
   docker exec thaliumx-backend curl http://vault:8200/v1/sys/health
   ```

3. Verify secrets directory:
   ```bash
   docker exec thaliumx-backend ls -la /app/.secrets
   ```

## Best Practices

1. **Always use volumes** for persistent data
2. **Run migrations automatically** on startup (production)
3. **Use singleton pattern** for services (OPA, cache, etc.)
4. **Store cache in Redis** for persistence
5. **Verify after rebuild** using `verify:persistence` script
6. **Backup volumes** before major changes:
   ```bash
   docker run --rm -v thaliumx-postgres-data:/data -v $(pwd):/backup \
     alpine tar czf /backup/postgres-backup.tar.gz /data
   ```

## Summary

✅ **All updates persist across rebuilds and restarts:**
- Database migrations: Automatic on startup
- Docker volumes: Configured for all data
- Environment variables: Loaded from multiple sources
- OPA services: Singleton pattern with Redis caching
- Service initialization: Automatic on startup
- Configuration: Included in Docker image

**Verification**: Run `npm run verify:persistence` after any rebuild or restart.
