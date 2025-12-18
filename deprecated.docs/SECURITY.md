# ThaliumX Security Documentation

This document describes the security measures implemented in the ThaliumX platform.

## Table of Contents

1. [Overview](#overview)
2. [Container Security](#container-security)
3. [Secrets Management](#secrets-management)
4. [Network Security](#network-security)
5. [Authentication & Authorization](#authentication--authorization)
6. [Security Monitoring](#security-monitoring)
7. [Best Practices](#best-practices)

---

## Overview

ThaliumX implements defense-in-depth security with multiple layers of protection:

```
┌─────────────────────────────────────────────────────────────────┐
│                     SECURITY LAYERS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Layer 1: Network Isolation                              │   │
│  │  - Dedicated bridge network (172.28.0.0/16)             │   │
│  │  - Service-to-service communication only                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Layer 2: Container Hardening                            │   │
│  │  - Non-root users (UID 1001)                            │   │
│  │  - Read-only filesystems                                 │   │
│  │  - Dropped capabilities                                  │   │
│  │  - No privilege escalation                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Layer 3: Secrets Management                             │   │
│  │  - HashiCorp Vault integration                          │   │
│  │  - Dynamic secrets                                       │   │
│  │  - Secret rotation                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Layer 4: Authentication & Authorization                 │   │
│  │  - Keycloak (OAuth 2.0 / OIDC)                          │   │
│  │  - OPA (Policy-based access control)                    │   │
│  │  - JWT token validation                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Layer 5: Security Monitoring                            │   │
│  │  - Wazuh SIEM/XDR                                       │   │
│  │  - Audit logging                                         │   │
│  │  - Intrusion detection                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Container Security

### Non-Root Execution

All application containers run as non-root users:

```yaml
# docker-compose.yaml
services:
  backend:
    user: "1001:1001"  # Run as UID/GID 1001
```

**Dockerfile Implementation:**
```dockerfile
# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs thaliumx

# Switch to non-root user
USER thaliumx
```

### Read-Only Filesystems

Containers use read-only root filesystems with tmpfs for writable directories:

```yaml
services:
  backend:
    read_only: true
    tmpfs:
      - /tmp:noexec,nosuid,nodev,size=100M,uid=1001,gid=1001,mode=1777
      - /app/logs:noexec,nosuid,nodev,size=100M,uid=1001,gid=1001,mode=0770
```

**Benefits:**
- Prevents runtime modification of application code
- Limits impact of container compromise
- Ensures container immutability

### Capability Dropping

All Linux capabilities are dropped:

```yaml
services:
  backend:
    cap_drop:
      - ALL
```

**Why this matters:**
- Removes ability to perform privileged operations
- Limits kernel attack surface
- Prevents container escape attempts

### Privilege Escalation Prevention

```yaml
services:
  backend:
    security_opt:
      - no-new-privileges:true
```

**This prevents:**
- setuid/setgid binaries from gaining privileges
- Exploitation of SUID vulnerabilities
- Privilege escalation attacks

### Signal Handling

Proper PID 1 handling with dumb-init:

```dockerfile
# Install dumb-init
RUN apk add --no-cache dumb-init

# Use as entrypoint
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

**Benefits:**
- Proper signal forwarding to child processes
- Zombie process reaping
- Graceful shutdown handling

### Resource Limits

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

---

## Secrets Management

### HashiCorp Vault Integration

ThaliumX uses HashiCorp Vault for centralized secrets management.

**Architecture:**
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Backend   │────▶│    Vault    │────▶│   Secrets   │
│   Service   │     │   Server    │     │   Storage   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │                   ▼
       │            ┌─────────────┐
       └───────────▶│   Cache     │
                    │  (in-memory)│
                    └─────────────┘
```

**Configuration:**
```typescript
// Environment variables
VAULT_ADDR=http://thaliumx-vault:8200
VAULT_TOKEN=${VAULT_TOKEN}
VAULT_MOUNT_PATH=secret
```

### Secret Paths

Secrets are organized under the `thaliumx/` path:

| Path | Contents |
|------|----------|
| `thaliumx/database` | Database credentials |
| `thaliumx/redis` | Redis password |
| `thaliumx/jwt` | JWT signing keys |
| `thaliumx/keycloak` | Keycloak client secrets |
| `thaliumx/kafka` | Kafka credentials |
| `thaliumx/mongodb` | MongoDB credentials |
| `thaliumx/encryption` | Encryption keys |
| `thaliumx/api-keys` | External API keys |

### Secret Caching

The backend implements secret caching to reduce Vault load:

```typescript
interface CachedSecret {
  value: string;
  expiresAt: number;
}

// Default TTL: 5 minutes
const CACHE_TTL = 5 * 60 * 1000;
```

### Authentication Methods

**Token-based (Development):**
```bash
VAULT_TOKEN=<VAULT_TOKEN>
```

**AppRole (Production):**
```bash
VAULT_ROLE_ID=<role-id>
VAULT_SECRET_ID=<secret-id>
```

---

## Network Security

### Network Isolation

All services run on a dedicated Docker bridge network:

```bash
docker network create --driver bridge --subnet 172.28.0.0/16 thaliumx-net
```

**Benefits:**
- Services isolated from host network
- Inter-service communication via container names
- No direct external access to internal services

### Port Exposure

Only necessary ports are exposed to the host:

| Service | Internal Port | External Port | Purpose |
|---------|---------------|---------------|---------|
| Frontend | 3000 | 3001 | Web UI |
| Backend | 3002 | 3002 | API |
| Grafana | 3000 | 3000 | Monitoring |
| Keycloak | 8080 | 8080 | IAM |
| Vault | 8200 | 8200 | Secrets |

### Service Communication

Services communicate internally using container hostnames:

```yaml
environment:
  - DB_HOST=thaliumx-postgres
  - REDIS_HOST=thaliumx-redis
  - VAULT_ADDR=http://thaliumx-vault:8200
```

---

## Authentication & Authorization

### Keycloak (Identity Provider)

**Features:**
- OAuth 2.0 / OpenID Connect
- Single Sign-On (SSO)
- Multi-Factor Authentication (MFA)
- User Federation (LDAP/AD)
- Social Login

**Configuration:**
```yaml
environment:
  - KEYCLOAK_URL=http://thaliumx-keycloak:8080
  - KEYCLOAK_REALM=thaliumx
  - KEYCLOAK_CLIENT_ID=thaliumx-backend
  - KEYCLOAK_CLIENT_SECRET=${KEYCLOAK_CLIENT_SECRET}
```

### OPA (Policy Engine)

Open Policy Agent provides fine-grained authorization:

```rego
# Example policy
package thaliumx.authz

default allow = false

allow {
    input.method == "GET"
    input.path == ["api", "public"]
}

allow {
    input.user.role == "admin"
}
```

### JWT Token Validation

```typescript
// Token validation middleware
const validateToken = async (token: string) => {
  const decoded = jwt.verify(token, await getJWTSecret());
  return decoded;
};
```

---

## Security Monitoring

### Wazuh SIEM/XDR

**Components:**
- **Wazuh Indexer**: OpenSearch-based log storage
- **Wazuh Manager**: Security event processing
- **Wazuh Dashboard**: Security visualization

**Capabilities:**
- Log analysis and correlation
- Intrusion detection
- File integrity monitoring
- Vulnerability detection
- Compliance reporting (PCI-DSS, GDPR, HIPAA)

**Access:**
```
URL: https://localhost:5601
Username: admin
Password: SecretPassword
```

### Audit Logging

All security-relevant events are logged:

```typescript
// Audit log example
LoggerService.info('User authentication', {
  event: 'AUTH_SUCCESS',
  userId: user.id,
  ip: request.ip,
  userAgent: request.headers['user-agent']
});
```

### Metrics & Alerting

Prometheus collects security metrics:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'backend'
    static_configs:
      - targets: ['thaliumx-backend:3002']
```

---

## Best Practices

### Environment Variables

**DO:**
```yaml
environment:
  - DB_PASSWORD=${DB_PASSWORD}  # From .env file
```

**DON'T:**
```yaml
environment:
  - DB_PASSWORD=hardcoded_password  # Never hardcode!
```

### Secret Rotation

Implement regular secret rotation:

```bash
# Rotate database password
vault kv put secret/thaliumx/database \
  username=thaliumx \
  password=$(openssl rand -base64 32)
```

### Container Updates

Keep base images updated:

```dockerfile
# Always update packages
RUN apk update && \
    apk upgrade --no-cache
```

### Logging Best Practices

**DO log:**
- Authentication attempts
- Authorization failures
- Configuration changes
- Error conditions

**DON'T log:**
- Passwords or secrets
- Full credit card numbers
- Personal identification numbers
- Session tokens

### Network Policies

Restrict inter-service communication:

```yaml
# Only allow necessary connections
services:
  backend:
    networks:
      - thaliumx-net
    depends_on:
      - postgres
      - redis
```

---

## Security Checklist

### Pre-Deployment

- [ ] All secrets stored in Vault
- [ ] Non-root users configured
- [ ] Read-only filesystems enabled
- [ ] Capabilities dropped
- [ ] Resource limits set
- [ ] Network isolation configured
- [ ] TLS certificates valid
- [ ] Wazuh agents deployed

### Post-Deployment

- [ ] Security scans completed
- [ ] Penetration testing done
- [ ] Audit logging verified
- [ ] Alerting configured
- [ ] Backup procedures tested
- [ ] Incident response plan ready

---

## Incident Response

### Security Incident Procedure

1. **Detect**: Monitor Wazuh alerts and logs
2. **Contain**: Isolate affected containers
3. **Investigate**: Analyze logs and traces
4. **Remediate**: Apply fixes and patches
5. **Recover**: Restore services
6. **Review**: Post-incident analysis

### Emergency Contacts

| Role | Contact |
|------|---------|
| Security Team | security@thaliumx.com |
| DevOps Team | devops@thaliumx.com |
| On-Call | oncall@thaliumx.com |

---

## References

- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [HashiCorp Vault Documentation](https://www.vaultproject.io/docs)
- [Keycloak Security](https://www.keycloak.org/docs/latest/server_admin/)
- [OPA Documentation](https://www.openpolicyagent.org/docs/latest/)
- [Wazuh Documentation](https://documentation.wazuh.com/)
- [OWASP Container Security](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)