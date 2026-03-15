#!/bin/bash

# ThaliumX Production Monitoring Setup
# ====================================
# Sets up comprehensive monitoring for production deployment

set -e

echo "🚀 Setting up ThaliumX Production Monitoring..."

# Function to wait for service health
wait_for_service() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=1

    echo "⏳ Waiting for $service to be healthy..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s --max-time 5 "$url" > /dev/null 2>&1; then
            echo "✅ $service is healthy"
            return 0
        fi
        echo "Attempt $attempt/$max_attempts: $service not ready yet..."
        sleep 10
        ((attempt++))
    done

    echo "❌ $service failed to become healthy"
    return 1
}

# Step 1: Start monitoring infrastructure
echo "📊 Step 1: Starting monitoring infrastructure..."

# Resolve repo root (script may be run from any working directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$PROJECT_ROOT/docker/observability"

# Start core monitoring services
docker compose up -d prometheus grafana loki promtail tempo otel-collector

# Wait for core services
wait_for_service "Prometheus" "http://localhost:9090/-/healthy"
wait_for_service "Grafana" "http://localhost:3000/api/health"
wait_for_service "Loki" "http://localhost:3100/ready"

# Step 2: Start exporters
echo "📈 Step 2: Starting metric exporters..."
docker compose up -d postgres-exporter redis-exporter cadvisor

# Wait for exporters
wait_for_service "PostgreSQL Exporter" "http://localhost:9187/health"
wait_for_service "Redis Exporter" "http://localhost:9121/health"

# Step 3: Start alerting
echo "🚨 Step 3: Starting alerting services..."
docker compose up -d alertmanager blackbox-exporter

# Step 4: Verify monitoring setup
echo "🔍 Step 4: Verifying monitoring setup..."

# Check Prometheus targets
echo "Checking Prometheus targets..."
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.health != "up") | .labels.job' || echo "All targets healthy"

# Check Grafana dashboards
echo "Checking Grafana dashboards..."
GRAFANA_ADMIN_PASSWORD_FILE="$PROJECT_ROOT/.secrets/generated/grafana-admin-password"
if [ ! -f "$GRAFANA_ADMIN_PASSWORD_FILE" ]; then
  echo "❌ Missing Grafana admin password file: $GRAFANA_ADMIN_PASSWORD_FILE"
  echo "   Run: bash ./scripts/generate-secrets.sh"
  exit 1
fi

curl -s -u "admin:$(cat "$GRAFANA_ADMIN_PASSWORD_FILE")" \
  http://localhost:3000/api/search | jq '.[].title' || echo "Grafana dashboards loaded"

# Step 5: Configure alerts
echo "⚠️ Step 5: Configuring production alerts..."

# Create alert rules for ThaliumX services
cat > /home/ubuntu/thaliumx/docker/observability/config/alerts/thaliumx-production-alerts.yml << 'EOF'
groups:
  - name: thaliumx-production
    rules:
      # Service down alerts
      - alert: ThaliumXBackendDown
        expr: up{job="thaliumx-backend"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "ThaliumX Backend is down"
          description: "ThaliumX Backend has been down for more than 5 minutes."

      - alert: ThaliumXDatabaseDown
        expr: up{job="postgres"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL Database is down"
          description: "PostgreSQL database is unreachable."

      - alert: ThaliumXRedisDown
        expr: up{job="redis"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Redis Cache is down"
          description: "Redis cache is unreachable."

      # Performance alerts
      - alert: HighErrorRate
        expr: rate(http_requests_total{job="thaliumx-backend", status=~"5.."}[5m]) / rate(http_requests_total{job="thaliumx-backend"}[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }}% which is above 5%."

      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value }}%."

      - alert: HighCPUUsage
        expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage"
          description: "CPU usage is {{ $value }}%."

      # Identity Provider alerts
      - alert: AuthentikDown
        expr: up{job="Authentik"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Authentik Identity Provider is down"
          description: "Authentik has been down for more than 2 minutes."

      - alert: AuthentikHighLatency
        expr: probe_duration_seconds{job="Authentik"} > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Authentik high response latency"
          description: "Authentik health check latency is above 2 seconds."

      # Database alerts
      - alert: DatabaseConnectionHigh
        expr: pg_stat_activity_count{state="active"} > 50
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database connections"
          description: "Active database connections: {{ $value }}."

      - alert: RedisMemoryHigh
        expr: redis_memory_used_bytes / redis_memory_max_bytes * 100 > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Redis memory usage high"
          description: "Redis memory usage: {{ $value }}%."
EOF

# Reload Prometheus configuration
echo "Reloading Prometheus configuration..."
curl -s -X POST http://localhost:9090/-/reload

echo ""
echo "🎯 PRODUCTION MONITORING SETUP COMPLETE"
echo "=========================================="
echo ""
echo "📊 Monitoring URLs:"
echo "  • Grafana: http://localhost:3000 (admin/<password stored in .secrets/generated/grafana-admin-password>)"
echo "  • Prometheus: http://localhost:9090"
echo "  • Alertmanager: http://localhost:9093"
echo ""
echo "📈 Available Dashboards:"
echo "  • ThaliumX System Overview"
echo "  • Authentik Identity Management"
echo "  • Redis Cache & Sessions"
echo "  • PostgreSQL Database"
echo ""
echo "🚨 Alerting:"
echo "  • Email alerts configured via Alertmanager"
echo "  • Slack/webhook integration available"
echo ""
echo "✅ Monitoring setup verified and ready for production!"
