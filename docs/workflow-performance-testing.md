# Workflow Orchestrator Performance Testing Guide

## Overview

This guide covers performance testing for the Workflow Orchestrator system, including load testing, stress testing, and database performance validation.

## Test Types

### 1. Load Testing (Artillery)

Load testing simulates normal to high production traffic to validate system performance under expected load.

**Run load tests:**
```bash
# From project root
./scripts/run-workflow-performance-tests.sh load

# Or directly with Artillery
cd tests/load
npx artillery run workflow-load-test.yml --output reports/workflow-load-report.json
```

**Test Scenarios:**
- Workflow start operations
- Workflow status queries
- Concurrent workflow operations
- User workflow listings
- Workflow retry/cancel operations

**Performance Targets:**
- 95th percentile response time: < 1s
- 99th percentile response time: < 2s
- Error rate: < 0.5%

### 2. Stress Testing

Stress testing pushes the system beyond normal capacity to identify breaking points and recovery behavior.

**Run stress tests:**
```bash
./scripts/run-workflow-performance-tests.sh stress
```

**Test Phases:**
- Initial ramp-up (10 → 50 req/s)
- Sustained high load (50 req/s)
- Spike test (200 req/s)
- Recovery phase
- Extended stress (100 req/s)

### 3. Smoke Testing

Quick smoke tests verify basic functionality under light load.

**Run smoke tests:**
```bash
./scripts/run-workflow-performance-tests.sh smoke
```

### 4. Unit Performance Tests (Jest)

Unit performance tests validate specific components and database operations.

**Run all performance tests:**
```bash
cd docker/backend
npm run test:performance:all
```

**Run specific tests:**
```bash
# Workflow orchestrator performance
npm run test:performance:workflow

# Database performance
npm run test:performance:database
```

## Performance Metrics

### Workflow Start Performance
- **Target:** Average < 500ms per workflow start
- **Concurrent:** Handle 50+ concurrent starts
- **Throughput:** 100+ workflows/second

### Workflow Status Queries
- **Target:** Average < 100ms per query
- **Concurrent:** Handle 100+ concurrent queries
- **Throughput:** 1000+ queries/second

### Database Operations
- **Insert:** Average < 50ms per insert
- **Query:** Average < 100ms per query
- **Update:** Average < 50ms per update
- **Batch Operations:** 1000+ records/second

### Memory Usage
- **Memory Leak Test:** < 100MB increase for 100 workflows
- **Garbage Collection:** Proper cleanup after workflow completion

## Test Configuration

### Environment Variables

```bash
# Target API URL
export TARGET_URL="http://localhost:3002"

# Test type
export TEST_TYPE="load"  # smoke, load, stress, all
```

### Artillery Configuration

Edit `tests/load/workflow-load-test.yml` to customize:
- Arrival rates
- Test duration
- Performance thresholds
- Test scenarios

## Monitoring During Tests

### Key Metrics to Monitor

1. **API Response Times**
   - P50, P95, P99 percentiles
   - Average response time
   - Maximum response time

2. **Error Rates**
   - HTTP error rates (4xx, 5xx)
   - Timeout rates
   - Failed workflow starts

3. **Database Performance**
   - Query execution times
   - Connection pool usage
   - Lock contention

4. **System Resources**
   - CPU usage
   - Memory usage
   - Database connections
   - Network I/O

### Monitoring Tools

```bash
# View real-time metrics
docker stats

# Database performance
docker exec -it postgres psql -U thaliumx -c "SELECT * FROM pg_stat_activity;"

# Application logs
docker logs -f backend
```

## Interpreting Results

### Good Performance Indicators
- ✅ P95 < 1s for workflow operations
- ✅ Error rate < 0.5%
- ✅ No memory leaks
- ✅ Database queries < 100ms
- ✅ System recovers after stress

### Performance Issues to Watch
- ⚠️ Response times increasing linearly with load
- ⚠️ Error rates > 1%
- ⚠️ Memory usage continuously increasing
- ⚠️ Database connection pool exhaustion
- ⚠️ Timeout errors

## Troubleshooting

### High Response Times
1. Check database query performance
2. Review workflow step execution times
3. Verify connection pool sizes
4. Check for N+1 query problems

### High Error Rates
1. Review application logs
2. Check database connection limits
3. Verify rate limiting configuration
4. Check for resource exhaustion

### Memory Issues
1. Review workflow state cleanup
2. Check for event listener leaks
3. Verify garbage collection
4. Review database connection pooling

## Continuous Performance Testing

### CI/CD Integration

Add to your CI/CD pipeline:

```yaml
- name: Run Performance Tests
  run: |
    ./scripts/run-workflow-performance-tests.sh smoke
```

### Scheduled Performance Tests

Run performance tests regularly:
- Daily smoke tests
- Weekly load tests
- Monthly stress tests

## Best Practices

1. **Baseline First:** Establish performance baselines before optimization
2. **Incremental Testing:** Start with smoke tests, then load, then stress
3. **Monitor Resources:** Watch system resources during all tests
4. **Document Results:** Keep performance test reports for trend analysis
5. **Automate:** Integrate performance tests into CI/CD pipeline
6. **Realistic Scenarios:** Test with realistic workflow patterns
7. **Cleanup:** Always clean up test data after tests

## Next Steps

After performance testing:
1. Review and analyze results
2. Identify bottlenecks
3. Optimize identified issues
4. Re-run tests to validate improvements
5. Document performance characteristics
6. Set up production monitoring
