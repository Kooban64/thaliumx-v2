# Workflow Orchestrator Production Deployment Guide

## Overview

This guide covers deploying the Workflow Orchestrator to production with proper monitoring, scaling, and reliability configurations.

## Prerequisites

- ✅ All workflow files implemented (52 workflows)
- ✅ Database migrations completed
- ✅ Performance tests passed
- ✅ Production environment configured
- ✅ Monitoring infrastructure ready

## Pre-Deployment Checklist

### Database Setup
- [ ] `workflow_states` table created with migrations
- [ ] Database indexes created and optimized
- [ ] Connection pool configured appropriately
- [ ] Backup strategy in place

### Service Configuration
- [ ] Workflow orchestrator service initialized
- [ ] All workflows registered
- [ ] Kafka consumer configured
- [ ] Event streaming service connected
- [ ] Redis service available for state caching

### Monitoring Setup
- [ ] Prometheus metrics endpoint configured
- [ ] Grafana dashboards created
- [ ] Alert rules configured
- [ ] Log aggregation configured

## Deployment Steps

### 1. Database Migration

```bash
cd docker/backend
npm run migrate
```

Verify migration:
```bash
# Check workflow_states table exists
docker exec -it postgres psql -U thaliumx -d thaliumx -c "\d workflow_states"
```

### 2. Build Backend

```bash
cd docker/backend
npm install
npm run build
npm run typecheck
```

### 3. Environment Configuration

Ensure these environment variables are set in production:

```bash
# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/thaliumx
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<secure-password>

# Kafka
KAFKA_BROKERS=kafka:9092
KAFKA_CLIENT_ID=workflow-orchestrator

# Workflow Configuration
WORKFLOW_MAX_RETRIES=3
WORKFLOW_RETRY_DELAY=1000
WORKFLOW_TIMEOUT=300000
WORKFLOW_ENABLE_COMPENSATION=true

# Monitoring
METRICS_ENABLED=true
METRICS_PORT=9091
```

### 4. Deploy Backend Service

```bash
# Using existing production deployment script
cd /home/ubuntu/thaliumx
./docker/scripts/deploy-production.sh

# Or manually
cd docker
docker compose -f compose.yaml up -d backend
```

### 5. Verify Deployment

```bash
# Check service health
curl http://localhost:3002/api/workflows/health

# Check workflow registration
curl http://localhost:3002/api/workflows/types

# Test workflow start
curl -X POST http://localhost:3002/api/workflows/start \
  -H "Content-Type: application/json" \
  -d '{
    "workflowType": "password_reset",
    "data": {
      "email": "test@example.com"
    }
  }'
```

## Monitoring Configuration

### Prometheus Metrics

The workflow orchestrator exposes metrics at `/metrics`:

- `workflow_started_total` - Total workflows started
- `workflow_completed_total` - Total workflows completed
- `workflow_failed_total` - Total workflows failed
- `workflow_duration_seconds` - Workflow execution duration
- `workflow_steps_total` - Total steps executed
- `workflow_retries_total` - Total step retries
- `workflow_compensations_total` - Total compensations executed

### Grafana Dashboard

Create a dashboard with these panels:

1. **Workflow Throughput**
   - Workflows started per minute
   - Workflows completed per minute
   - Workflow success rate

2. **Workflow Performance**
   - Average workflow duration
   - P95/P99 workflow duration
   - Step execution time

3. **Error Rates**
   - Failed workflows
   - Step failures
   - Compensation executions

4. **Database Performance**
   - Query execution time
   - Connection pool usage
   - Active workflows

### Alert Rules

Configure alerts for:

```yaml
# High error rate
- alert: HighWorkflowErrorRate
  expr: rate(workflow_failed_total[5m]) > 0.1
  for: 5m
  annotations:
    summary: "High workflow error rate detected"

# Slow workflows
- alert: SlowWorkflowExecution
  expr: histogram_quantile(0.95, workflow_duration_seconds) > 30
  for: 10m
  annotations:
    summary: "Workflows taking longer than expected"

# Database connection issues
- alert: DatabaseConnectionPoolExhausted
  expr: database_connections_active / database_connections_max > 0.9
  for: 5m
  annotations:
    summary: "Database connection pool nearly exhausted"
```

## Scaling Configuration

### Horizontal Scaling

The workflow orchestrator is stateless and can be scaled horizontally:

```yaml
# docker-compose.yml
services:
  backend:
    deploy:
      replicas: 3
    environment:
      - WORKFLOW_INSTANCE_ID=${HOSTNAME}
```

### Database Connection Pooling

Configure appropriate pool sizes:

```typescript
// Based on: (number_of_instances * pool_max) < database_max_connections
// Example: 3 instances * 20 max = 60 connections < 100 max
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20
```

### Kafka Consumer Groups

Each instance should use the same consumer group for load balancing:

```typescript
KAFKA_CONSUMER_GROUP=workflow-orchestrator
```

## High Availability

### Database Replication

Ensure PostgreSQL is configured with:
- Primary-replica replication
- Automatic failover
- Connection pooling with read replicas

### Redis High Availability

Configure Redis with:
- Redis Sentinel for failover
- Redis Cluster for sharding
- Persistent storage for workflow state cache

### Workflow State Persistence

Workflow states are persisted to PostgreSQL:
- Automatic state saving after each step
- State recovery on service restart
- Compensation support for failed workflows

## Backup and Recovery

### Database Backups

```bash
# Daily backup of workflow_states table
pg_dump -U thaliumx -d thaliumx -t workflow_states > workflow_states_backup_$(date +%Y%m%d).sql
```

### Workflow State Recovery

In case of service failure:
1. Workflow states are persisted in database
2. Service restart will recover in-progress workflows
3. Failed workflows can be retried via API

## Performance Tuning

### Database Optimization

```sql
-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_workflow_states_user_id ON workflow_states(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_states_status ON workflow_states(status);
CREATE INDEX IF NOT EXISTS idx_workflow_states_type ON workflow_states(workflow_type);
CREATE INDEX IF NOT EXISTS idx_workflow_states_created_at ON workflow_states(created_at);

-- Analyze tables regularly
ANALYZE workflow_states;
```

### Connection Pool Tuning

```typescript
// Adjust based on load
DATABASE_POOL_MIN=10      // Minimum connections
DATABASE_POOL_MAX=50      // Maximum connections
DATABASE_POOL_IDLE=10000  // Idle timeout (ms)
```

### Workflow Timeout Configuration

```typescript
// Set appropriate timeouts per workflow type
WORKFLOW_TIMEOUT=300000  // 5 minutes default
WORKFLOW_STEP_TIMEOUT=60000  // 1 minute per step
```

## Troubleshooting

### Common Issues

**1. Workflows not starting**
- Check database connection
- Verify workflow registration
- Review application logs

**2. High database load**
- Review query performance
- Check connection pool usage
- Optimize indexes

**3. Workflow timeouts**
- Increase timeout values
- Review step execution times
- Check for deadlocks

**4. Memory leaks**
- Monitor memory usage
- Review workflow state cleanup
- Check event listener cleanup

### Debug Commands

```bash
# Check workflow status
curl http://localhost:3002/api/workflows/{workflowId}/status

# List active workflows
curl http://localhost:3002/api/workflows/user/{userId}

# Check service health
curl http://localhost:3002/api/workflows/health

# View logs
docker logs -f backend | grep -i workflow

# Database queries
docker exec -it postgres psql -U thaliumx -d thaliumx -c "SELECT COUNT(*) FROM workflow_states WHERE status = 'in_progress';"
```

## Post-Deployment Verification

### Functional Tests

```bash
# Run smoke tests
./scripts/run-workflow-performance-tests.sh smoke

# Test workflow start
curl -X POST http://localhost:3002/api/workflows/start \
  -H "Content-Type: application/json" \
  -d '{"workflowType": "password_reset", "data": {"email": "test@example.com"}}'

# Verify workflow execution
# Check logs and database for workflow completion
```

### Performance Tests

```bash
# Run load tests
./scripts/run-workflow-performance-tests.sh load

# Monitor metrics during test
# Check Grafana dashboard for performance metrics
```

### Monitoring Verification

- [ ] Prometheus scraping metrics
- [ ] Grafana dashboards displaying data
- [ ] Alerts configured and tested
- [ ] Log aggregation working

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review error rates and performance metrics
   - Check database query performance
   - Review workflow completion rates

2. **Monthly**
   - Analyze workflow patterns
   - Optimize slow workflows
   - Review and update timeouts
   - Database maintenance (VACUUM, ANALYZE)

3. **Quarterly**
   - Performance testing
   - Capacity planning
   - Security audit
   - Backup restoration test

## Rollback Procedure

If issues are detected:

```bash
# 1. Stop new workflow starts (via feature flag or API)
# 2. Wait for in-progress workflows to complete
# 3. Rollback deployment
cd docker
docker compose -f compose.yaml down backend
docker compose -f compose.yaml up -d backend:<previous-version>

# 4. Verify service health
curl http://localhost:3002/api/workflows/health
```

## Support and Documentation

- **API Documentation**: `/api/docs`
- **Workflow Types**: `/api/workflows/types`
- **Health Check**: `/api/workflows/health`
- **Performance Guide**: `docs/workflow-performance-testing.md`

## Next Steps

After successful deployment:

1. Monitor for 24-48 hours
2. Review performance metrics
3. Adjust scaling based on load
4. Document any issues and resolutions
5. Schedule regular performance reviews
