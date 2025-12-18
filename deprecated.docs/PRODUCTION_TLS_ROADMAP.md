# Production TLS Enablement Roadmap
# =================================
# Complete TLS/SSL encryption across all ThaliumX services
# Updated: 2025-12-17T11:00:45.000Z

## Current TLS Status

### ✅ FULLY ENABLED
- **PostgreSQL**: SSL with certificate authentication
- **Vault**: TLS with production certificates
- **Infrastructure**: Certificate management system

### ⚠️ TEMPORARILY DISABLED (Known Issues)
- **Redis**: TLS config ready, health check issues
- **Citus Cluster**: SSL configs prepared, permission issues
- **TimescaleDB**: SSL configs prepared, permission issues
- **MongoDB**: SSL configs prepared, permission issues

### ❌ NOT CONFIGURED
- **Kafka/Zookeeper**: No TLS configuration
- **APISIX**: No TLS configuration
- **Keycloak**: No TLS configuration
- **Monitoring Stack**: No TLS configuration

---

## Critical Issues for Full Production TLS

### 1. Certificate Permission Issues
**Problem**: Docker containers cannot read private keys due to permission restrictions
**Current Workaround**: Disabled SSL on affected services
**Production Solution**:
```bash
# Fix certificate ownership in entrypoint scripts
RUN chown 999:999 /path/to/private.key && chmod 600 /path/to/private.key

# Or use Docker secrets with proper mounting
secrets:
  - source: service-key
    target: /certs/server.key
    uid: '999'
    gid: '999'
    mode: 0600
```

### 2. Health Check Authentication
**Problem**: Docker health checks cannot access secrets for TLS authentication
**Current Workaround**: Simplified or disabled health checks
**Production Solution**:
```yaml
# Use custom health check scripts
healthcheck:
  test: ["CMD", "/health-check.sh"]
  # Where health-check.sh contains proper authentication
```

### 3. Certificate Authority Trust
**Problem**: Services need to trust the internal CA
**Current Status**: CA certificates mounted but not all services configured
**Production Solution**:
- Configure trust stores in all containers
- Update Java trust stores for JVM-based services
- Configure CA trust in MongoDB, Redis, Kafka

### 4. Service-to-Service TLS
**Problem**: Internal service communication needs mutual TLS
**Current Status**: External TLS only
**Production Solution**:
- Enable mutual TLS authentication
- Configure client certificates for service communication
- Update connection strings with TLS parameters

---

## TLS Enablement Priority Matrix

### Phase 1: Critical Infrastructure (Week 1)
| Service | Priority | Complexity | Impact |
|---------|----------|------------|--------|
| PostgreSQL | ✅ Done | Low | High |
| Vault | ✅ Done | Low | High |
| Redis | 🔄 Next | Medium | High |
| MongoDB | 🔄 Next | Medium | High |

### Phase 2: Database Layer (Week 2)
| Service | Priority | Complexity | Impact |
|---------|----------|------------|--------|
| Citus Coordinator | High | High | High |
| Citus Workers | High | High | High |
| TimescaleDB | High | High | High |

### Phase 3: Application Layer (Week 3)
| Service | Priority | Complexity | Impact |
|---------|----------|------------|--------|
| Backend Services | Medium | Medium | High |
| API Gateway | Medium | Medium | High |
| Keycloak | Medium | High | High |

### Phase 4: Supporting Services (Week 4)
| Service | Priority | Complexity | Impact |
|---------|----------|------------|--------|
| Kafka/Zookeeper | Low | High | Medium |
| Monitoring Stack | Low | Medium | Low |

---

## Detailed Implementation Plan

### Redis TLS Enablement
```yaml
# Current config (non-TLS)
command: redis-server --requirepass-file /run/secrets/redis-password --port 6379

# Production config (TLS)
command: >
  redis-server
  --requirepass-file /run/secrets/redis-password
  --tls-port 6379
  --port 0
  --tls-cert-file /certs/server.crt
  --tls-key-file /certs/server.key
  --tls-ca-cert-file /certs/ca.crt
  --tls-auth-clients optional

# Health check fix
healthcheck:
  test: ["CMD", "/redis-health-check.sh"]
```

### MongoDB TLS Enablement
```yaml
# Current config (non-TLS)
command: mongod --auth --bind_ip_all

# Production config (TLS)
command: >
  mongod
  --tlsMode requireTLS
  --tlsCertificateKeyFile /certs/mongodb.pem
  --tlsCAFile /certs/ca.crt
  --auth
  --bind_ip_all

# Entrypoint fix needed
# RUN chown mongodb:mongodb /certs/mongodb.pem
```

### Citus/TimescaleDB TLS Enablement
```yaml
# Current config (non-TLS)
command: postgres -c shared_preload_libraries=citus

# Production config (TLS)
command: >
  postgres
  -c shared_preload_libraries=citus
  -c ssl=on
  -c ssl_cert_file=/var/lib/postgresql/certs/server.crt
  -c ssl_key_file=/var/lib/postgresql/certs/server.key
  -c ssl_ca_file=/var/lib/postgresql/ca.crt

# Entrypoint fix needed
# RUN chown postgres:postgres /var/lib/postgresql/certs/server.key
```

---

## Production Deployment Checklist

### Pre-Deployment Requirements
- [ ] Certificate Authority properly configured
- [ ] All private keys with correct permissions (600)
- [ ] Certificate trust stores updated
- [ ] Service entrypoint scripts updated
- [ ] Health check scripts created
- [ ] Mutual TLS certificates generated
- [ ] Load balancer TLS termination configured

### Deployment Steps
1. **Test TLS in staging environment**
   - Deploy with TLS enabled
   - Test all service interconnections
   - Verify certificate chains
   - Validate health checks

2. **Certificate rotation plan**
   - Automate certificate renewal
   - Zero-downtime rotation process
   - Backup and recovery procedures

3. **Monitoring and alerting**
   - TLS handshake monitoring
   - Certificate expiry alerts
   - Connection failure detection

### Rollback Plan
- **Immediate rollback**: Disable TLS flags
- **Certificate issues**: Replace with known good certificates
- **Service failures**: Revert to non-TLS configuration

---

## Risk Assessment

### High Risk Issues
1. **Certificate Permission Failures**: Services fail to start
2. **Health Check Failures**: False negatives cause unnecessary restarts
3. **Trust Store Issues**: Services cannot validate certificates
4. **Mutual TLS Problems**: Service-to-service communication breaks

### Mitigation Strategies
1. **Test in staging first**: Full TLS deployment testing
2. **Gradual rollout**: Enable TLS service-by-service
3. **Monitoring**: Comprehensive TLS monitoring
4. **Rollback procedures**: Documented and tested

---

## Success Metrics

### TLS Coverage Targets
- **Week 1**: 60% of services (infrastructure)
- **Week 2**: 80% of services (databases)
- **Week 3**: 95% of services (applications)
- **Week 4**: 100% of services (all remaining)

### Quality Gates
- [ ] All health checks passing
- [ ] Certificate validation working
- [ ] Service interconnections encrypted
- [ ] Performance impact < 5%
- [ ] Monitoring alerts configured

---

## Conclusion

**Full production TLS is achievable but requires systematic implementation:**

1. **Fix certificate permissions** in container entrypoints
2. **Implement proper health checks** with authentication
3. **Configure mutual TLS** for service communication
4. **Test thoroughly** in staging before production
5. **Monitor continuously** for certificate expiry and issues

**Timeline**: 4 weeks for complete TLS enablement
**Risk Level**: Medium (with proper testing)
**Business Impact**: Essential for production security compliance