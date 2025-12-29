# ThaliumX Production Ready Guide
**Status:** Full Production Mode with Persistence & Testing

## 🚀 Quick Start - Production Mode

### 1. Initial Setup (One-time)

```bash
# Run production setup (creates volumes, builds, starts all services)
cd /home/ubuntu/thaliumx-v1
./docker/scripts/production-setup.sh
```

This script will:
- ✅ Create all persistent data directories at `/opt/thaliumx/data/`
- ✅ Create Docker network
- ✅ Build all 44 containers
- ✅ Start all services in correct order
- ✅ Wait for services to be healthy

### 2. Verify All Services Are Running

```bash
# Check all containers
docker ps --filter "name=thaliumx-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Check service health
cd docker && docker compose -f compose.yaml ps

# View logs
docker compose -f compose.yaml logs -f [service-name]
```

### 3. Access Services

| Service | URL | Port | Credentials |
|---------|-----|------|-------------|
| Frontend | http://localhost:3001 | 3001 | - |
| Backend API | http://localhost:3002 | 3002 | - |
| Keycloak | http://localhost:8080 | 8080 | admin / (see core.env) |
| Grafana | http://localhost:3000 | 3000 | admin / changeme |
| Prometheus | http://localhost:9090 | 9090 | - |
| Wazuh Dashboard | https://localhost:5601 | 5601 | admin / (see wazuh config) |

## 📊 Running E2E Tests (Playwright)

### Basic E2E Test Run

```bash
# Run all E2E tests
./docker/scripts/run-e2e-tests.sh

# Run specific test suites
./docker/scripts/run-e2e-tests.sh auth        # Authentication tests only
./docker/scripts/run-e2e-tests.sh trading     # Trading tests only
./docker/scripts/run-e2e-tests.sh presale    # Presale tests only

# Run with visible browser (for debugging)
./docker/scripts/run-e2e-tests.sh headed

# Run in interactive UI mode
./docker/scripts/run-e2e-tests.sh ui

# Run in debug mode
./docker/scripts/run-e2e-tests.sh debug

# Run with more workers (parallel execution)
./docker/scripts/run-e2e-tests.sh all 8
```

### View Test Results

```bash
cd docker/frontend
npx playwright show-report
```

## 🔥 Load Testing (100s/1000s of Users)

### Quick Load Tests

```bash
# Smoke test (light load)
./docker/scripts/run-load-tests.sh smoke

# Load test with 100 users
./docker/scripts/run-load-tests.sh load 100

# Load test with 500 users
./docker/scripts/run-load-tests.sh load 500

# Stress test with 1000 users
./docker/scripts/run-load-tests.sh stress 1000

# Spike test with 2000 users
./docker/scripts/run-load-tests.sh spike 2000
```

### Advanced Load Testing

```bash
cd tests/load

# Run custom load test
npx artillery run load-test.yml \
  --overrides '{"config":{"phases":[{"duration":600,"arrivalRate":100,"rampTo":500}]}}' \
  --output reports/custom-report.json

# View report
npx artillery report reports/custom-report.json --output reports/report.html
```

### Load Test Scenarios

The load tests include:
- Health checks
- User registration
- User login
- Market data retrieval
- Trading pair queries
- Order book requests
- Token sale operations

## 💾 Data Persistence

All data is persisted to `/opt/thaliumx/data/`:

```
/opt/thaliumx/data/
├── postgres/              # PostgreSQL data
├── redis/                 # Redis data
├── mongodb/               # MongoDB data
├── vault/                 # Vault data
├── keycloak/              # Keycloak data
├── kafka/                 # Kafka data
├── timescaledb/           # TimescaleDB (trading data)
├── citus-coordinator/     # Citus coordinator
├── citus-worker1/         # Citus worker 1
├── citus-worker2/         # Citus worker 2
├── dingir/                # Dingir trading engine
├── liquibook/             # Liquibook orderbook
├── quantlib/              # QuantLib data
├── prometheus/            # Prometheus metrics
├── grafana/               # Grafana dashboards
├── loki/                  # Loki logs
└── [all other services]
```

**Important:** Data persists across:
- Container restarts
- Docker Compose down/up
- System reboots (if `/opt/thaliumx` is on persistent storage)

## 🔄 Restarting Services

### Restart All Services

```bash
cd docker
docker compose -f compose.yaml restart
```

### Restart Specific Service

```bash
docker compose -f compose.yaml restart [service-name]
```

### Stop All Services (Data Preserved)

```bash
cd docker
docker compose -f compose.yaml down
```

### Start All Services (Data Preserved)

```bash
cd docker
docker compose -f compose.yaml up -d
```

## 🛠️ Production Configuration

### Environment Variables

Production environment is set via:
- `docker/core/core.env` - Core services
- `docker/trading/trading.env` - Trading services
- `docker/compose.yaml` - Main orchestration

### Key Production Settings

- **NODE_ENV=production** - All services run in production mode
- **Persistence** - All volumes use bind mounts to `/opt/thaliumx/data/`
- **Health Checks** - All services have health checks enabled
- **Restart Policy** - All services use `unless-stopped`
- **Resource Limits** - Services have CPU/memory limits configured

## 📈 Monitoring & Observability

### Prometheus Metrics
- URL: http://localhost:9090
- Scrapes metrics from all services

### Grafana Dashboards
- URL: http://localhost:3000
- Default credentials: admin / changeme
- Pre-configured dashboards for all services

### Loki Logs
- URL: http://localhost:3100
- Aggregates logs from all containers

### Wazuh Security Monitoring
- URL: https://localhost:5601
- SIEM/XDR for security monitoring

## 🔍 Troubleshooting

### Service Not Starting

```bash
# Check logs
docker logs [container-name]

# Check service status
docker inspect [container-name]

# Check network connectivity
docker exec [container-name] ping [other-service]
```

### Database Connection Issues

```bash
# Check database is running
docker ps | grep postgres

# Test connection
docker exec thaliumx-postgres psql -U thaliumx -d thaliumx -c "SELECT 1;"
```

### Port Conflicts

```bash
# Check what's using a port
sudo lsof -i :3002

# Change port in docker/core/compose.yaml
```

### Out of Memory

```bash
# Check container resource usage
docker stats

# Increase limits in compose files
```

## 🧪 Testing Checklist

Before going live, run:

- [ ] All E2E tests pass: `./docker/scripts/run-e2e-tests.sh`
- [ ] Smoke test passes: `./docker/scripts/run-load-tests.sh smoke`
- [ ] Load test with 100 users: `./docker/scripts/run-load-tests.sh load 100`
- [ ] Stress test with 500 users: `./docker/scripts/run-load-tests.sh stress 500`
- [ ] All services healthy: `docker compose -f docker/compose.yaml ps`
- [ ] Database connections working
- [ ] Keycloak authentication working
- [ ] Trading services responding
- [ ] Compliance services responding
- [ ] Observability stack collecting data

## 📝 Next Steps

1. **Run Production Setup**: `./docker/scripts/production-setup.sh`
2. **Verify Services**: Check all containers are running
3. **Run E2E Tests**: `./docker/scripts/run-e2e-tests.sh`
4. **Run Load Tests**: Start with smoke, then scale up
5. **Monitor Performance**: Check Grafana dashboards
6. **Review Logs**: Check for any errors or warnings

## 🆘 Need Help?

- Check service logs: `docker compose -f docker/compose.yaml logs [service]`
- Check audit report: `AUDIT_REPORT.md`
- Check container status: `docker ps --filter "name=thaliumx-"`
- Review health checks: `docker inspect [container] | grep -A 10 Healthcheck`

---

**All 44 containers are configured for production with full persistence!**

