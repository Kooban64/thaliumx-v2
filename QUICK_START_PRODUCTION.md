# 🚀 Quick Start - Production Mode

## Get Everything Running in Production

### Step 1: Start All Services

```bash
cd /home/ubuntu/thaliumx-v1
./docker/scripts/production-start.sh
```

This will:
- Build shared package and backend
- Start all 44 containers
- Use persistent volumes at `/opt/thaliumx/data/`
- Run in full production mode

### Step 2: Verify Services

```bash
# Check all containers
docker ps --filter "name=thaliumx-" --format "table {{.Names}}\t{{.Status}}"

# Should show 44 containers running
```

### Step 3: Run E2E Tests

```bash
# Run all Playwright E2E tests
./docker/scripts/run-e2e-tests.sh

# Or run specific suites
./docker/scripts/run-e2e-tests.sh auth
./docker/scripts/run-e2e-tests.sh trading
./docker/scripts/run-e2e-tests.sh presale
```

### Step 4: Run Load Tests

```bash
# Smoke test (light)
./docker/scripts/run-load-tests.sh smoke

# 100 users
./docker/scripts/run-load-tests.sh load 100

# 500 users
./docker/scripts/run-load-tests.sh load 500

# 1000 users (stress)
./docker/scripts/run-load-tests.sh stress 1000

# 2000 users (spike)
./docker/scripts/run-load-tests.sh spike 2000
```

## Service URLs

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3002
- **Keycloak**: http://localhost:8080
- **Grafana**: http://localhost:3000 (admin/changeme)
- **Prometheus**: http://localhost:9090

## Data Persistence

All data persists at `/opt/thaliumx/data/` - survives restarts and rebuilds!

## Troubleshooting

```bash
# View logs
docker compose -f docker/compose.yaml logs -f [service-name]

# Restart a service
docker compose -f docker/compose.yaml restart [service-name]

# Check health
docker compose -f docker/compose.yaml ps
```

## Full Documentation

See `PRODUCTION_READY_GUIDE.md` for complete details.

