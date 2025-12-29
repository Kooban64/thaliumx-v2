# ThaliumX Production Deployment Guide

**Version:** 2.0  
**Updated:** 2025-12-07  
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Detailed Deployment Steps](#detailed-deployment-steps)
5. [TLS Certificate Setup](#tls-certificate-setup)
6. [Vault Configuration](#vault-configuration)
7. [Keycloak Production Build](#keycloak-production-build)
8. [Auto-Unseal Options](#auto-unseal-options)
9. [Backup Configuration](#backup-configuration)
10. [Monitoring & Maintenance](#monitoring--maintenance)
11. [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers the complete production deployment of ThaliumX, including:

- **38 Docker services** across multiple categories
- **TLS encryption** for all security services
- **Vault** with file-based storage (no cloud dependencies)
- **Keycloak** with optimized production build
- **Automated backups** with cron scheduling
- **Optional auto-unseal** using Transit seal (no cloud providers required)

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ThaliumX Platform                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   APISIX    │  │  Frontend   │  │   Backend   │              │
│  │  (Gateway)  │  │  (Next.js)  │  │  (Node.js)  │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
├─────────┴────────────────┴────────────────┴─────────────────────┤
│                      Security Layer                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │    Vault    │  │  Keycloak   │  │     OPA     │              │
│  │  (Secrets)  │  │   (Auth)    │  │  (Policy)   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│                      Data Layer                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │PostgreSQL│ │ MongoDB  │ │  Redis   │ │  Kafka   │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
├─────────────────────────────────────────────────────────────────┤
│                    Observability                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │Prometheus│ │ Grafana  │ │   Loki   │ │  Wazuh   │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 8 cores | 16 cores |
| RAM | 32 GB | 64 GB |
| Storage | 100 GB SSD | 500 GB NVMe |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### Software Requirements

```bash
# Docker (24.0+)
docker --version

# Docker Compose (v2.20+)
docker compose version

# OpenSSL (for TLS certificates)
openssl version

# jq (for JSON processing)
jq --version
```

### Install Prerequisites (Ubuntu)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install jq
sudo apt install -y jq

# Logout and login for group changes
```

---

## Quick Start

For a complete automated deployment:

```bash
# Clone repository
cd /opt
git clone https://github.com/thaliumx/thaliumx.git
cd thaliumx/docker

# Run full production deployment
./scripts/deploy-production.sh full
```

This will:
1. Generate TLS certificates
2. Build optimized Keycloak image
3. Start all infrastructure services
4. Initialize and configure Vault
5. Start all application services
6. Set up automated backups

---

## Detailed Deployment Steps

### Step 1: Generate TLS Certificates

```bash
cd docker/security/scripts
chmod +x setup-production-tls.sh
./setup-production-tls.sh
```

This generates:
- CA certificate and key
- Vault server certificate
- Keycloak server certificate

**For production:** Replace self-signed certificates with certificates from a trusted CA.

### Step 2: Build Optimized Keycloak Image

```bash
cd docker/security
docker build -f Dockerfile.keycloak -t thaliumx/keycloak:24.0-optimized .
```

The optimized image:
- Pre-compiles Quarkus application
- Faster startup time (~50% improvement)
- Smaller runtime footprint

### Step 3: Create Docker Network

```bash
docker network create thaliumx-net
```

### Step 4: Start Database Services

```bash
cd docker
docker compose -f databases/compose.yaml up -d

# Wait for PostgreSQL
docker exec thaliumx-postgres pg_isready -U thaliumx
```

### Step 5: Start Security Services (Production Mode)

```bash
cd docker
docker compose -f security/compose.production.yaml up -d
```

### Step 6: Initialize Vault

```bash
cd docker/security/scripts
chmod +x vault-production-init.sh
./vault-production-init.sh
```

**CRITICAL:** Save the unseal keys and root token securely!

### Step 7: Start Remaining Services

```bash
cd docker

# API Gateway
docker compose -f apisix/compose.yaml up -d

# Trading services
docker compose -f trading/compose.yaml up -d

# Fintech services
docker compose -f fintech/compose.yaml up -d

# Observability
docker compose -f observability/compose.yaml up -d

# Wazuh SIEM
docker compose -f wazuh/compose.yaml up -d
```

### Step 8: Set Up Automated Backups

```bash
cd docker/scripts
chmod +x setup-backup-cron.sh
./setup-backup-cron.sh install
```

---

## TLS Certificate Setup

### Self-Signed Certificates (Development/Testing)

```bash
./docker/security/scripts/setup-production-tls.sh
```

Generated files:
```
docker/security/config/
├── ca.crt                    # CA certificate
├── ca.key                    # CA private key (PROTECT THIS!)
├── vault/tls/
│   ├── vault.crt            # Vault certificate
│   ├── vault.key            # Vault private key
│   └── ca.crt               # CA certificate copy
└── keycloak/tls/
    ├── tls.crt              # Keycloak certificate
    ├── tls.key              # Keycloak private key
    └── ca.crt               # CA certificate copy
```

### Production Certificates (Let's Encrypt / Commercial CA)

1. Obtain certificates from your CA
2. Replace the generated certificates:

```bash
# Vault
cp /path/to/vault.crt docker/security/config/vault/tls/vault.crt
cp /path/to/vault.key docker/security/config/vault/tls/vault.key

# Keycloak
cp /path/to/keycloak.crt docker/security/config/keycloak/tls/tls.crt
cp /path/to/keycloak.key docker/security/config/keycloak/tls/tls.key
```

### Certificate Renewal

Set up automatic renewal with certbot or your CA's tools:

```bash
# Example with certbot
certbot renew --deploy-hook "/opt/thaliumx/docker/scripts/reload-certs.sh"
```

---

## Vault Configuration

### Storage Backend

Vault uses **file-based storage** - no external dependencies required:

```hcl
storage "file" {
  path = "/vault/data"
}
```

Data is persisted in Docker volume `thaliumx-vault-data`.

### Seal Options

#### Option 1: Shamir Seal (Default)

- **Pros:** No external dependencies, highest security
- **Cons:** Manual unseal required after restart
- **Best for:** High-security environments with 24/7 operations team

```bash
# After restart, unseal with 3 of 5 keys:
vault operator unseal <key1>
vault operator unseal <key2>
vault operator unseal <key3>
```

#### Option 2: Transit Auto-Unseal (No Cloud Dependencies)

Uses a secondary Vault instance for auto-unseal:

```bash
# Set up Transit auto-unseal
cd docker/security/scripts
chmod +x setup-transit-autounseal.sh
./setup-transit-autounseal.sh
```

Architecture:
```
┌─────────────────┐     Transit Seal      ┌─────────────────┐
│  vault-unseal   │ ◄──────────────────── │  vault (main)   │
│  (port 8210)    │                       │  (port 8200)    │
│  Manual unseal  │                       │  Auto-unseal    │
└─────────────────┘                       └─────────────────┘
```

- `vault-unseal`: Manually unsealed (one-time after restart)
- `vault`: Auto-unseals using transit key from vault-unseal

#### Option 3: HSM Seal (Hardware Security Module)

For highest security without cloud dependencies:

```hcl
seal "pkcs11" {
  lib            = "/usr/lib/softhsm/libsofthsm2.so"
  slot           = "0"
  pin            = "PKCS11_PIN"
  key_label      = "vault-hsm-key"
}
```

Requires PKCS#11 compatible HSM hardware.

---

## Keycloak Production Build

### Why Optimized Build?

| Aspect | Dev Mode | Production Mode |
|--------|----------|-----------------|
| Startup Time | ~60s | ~30s |
| Memory Usage | Higher | Optimized |
| Configuration | Runtime | Build-time |
| Security | Relaxed | Hardened |

### Build Command

```bash
docker build -f docker/security/Dockerfile.keycloak \
  -t thaliumx/keycloak:24.0-optimized \
  docker/security/
```

### Configuration

Production Keycloak uses:
- HTTPS only (port 8443)
- PostgreSQL database
- Token exchange enabled
- Fine-grained authorization
- JSON logging

---

## Auto-Unseal Options

### Comparison Matrix

| Method | Cloud Dependency | Complexity | Security | Auto-Unseal |
|--------|-----------------|------------|----------|-------------|
| Shamir | None | Low | Highest | No |
| Transit | None | Medium | High | Yes* |
| HSM | None | High | Highest | Yes |
| AWS KMS | AWS | Low | High | Yes |
| Azure KV | Azure | Low | High | Yes |
| GCP KMS | GCP | Low | High | Yes |

*Transit requires vault-unseal to be manually unsealed first

### Recommended: Transit Auto-Unseal

For production without cloud dependencies:

1. **Initial Setup:**
   ```bash
   ./docker/security/scripts/setup-transit-autounseal.sh
   ```

2. **After System Restart:**
   ```bash
   # Unseal vault-unseal (manual, one-time)
   vault operator unseal -address=https://localhost:8210 <key1>
   vault operator unseal -address=https://localhost:8210 <key2>
   vault operator unseal -address=https://localhost:8210 <key3>
   
   # Main vault auto-unseals automatically!
   ```

3. **Key Distribution:**
   - Distribute 5 unseal keys to 5 different administrators
   - Require 3 administrators to unseal
   - Store keys in separate secure locations

---

## Backup Configuration

### Automated Backups

```bash
# Install backup cron job (daily at 2 AM)
./docker/scripts/setup-backup-cron.sh install

# Custom schedule (every 6 hours)
CRON_SCHEDULE='0 */6 * * *' ./docker/scripts/setup-backup-cron.sh install

# Check status
./docker/scripts/setup-backup-cron.sh status

# Run manual backup
./docker/scripts/backup-all.sh
```

### What's Backed Up

| Service | Backup Method | Data |
|---------|--------------|------|
| PostgreSQL | pg_dump | All databases |
| MongoDB | mongodump | All collections |
| Redis | RDB snapshot | Cache data |
| Vault | File copy | Encrypted data |
| Kafka | Volume backup | Topics/messages |
| Grafana | Volume backup | Dashboards |
| Wazuh | File copy | Logs/config |

### Backup Retention

- Default: 7 days
- Location: `/opt/thaliumx/backups/`
- Format: `thaliumx_backup_YYYYMMDD_HHMMSS.tar.gz`

### Restore from Backup

```bash
./docker/scripts/restore-backup.sh /opt/thaliumx/backups/thaliumx_backup_20251207_020000.tar.gz
```

---

## Monitoring & Maintenance

### Health Check Endpoints

| Service | URL | Expected |
|---------|-----|----------|
| Vault | https://localhost:8200/v1/sys/health | 200 OK |
| Keycloak | https://localhost:8443/health/ready | UP |
| Grafana | http://localhost:3001/api/health | ok |
| Prometheus | http://localhost:9090/-/healthy | Healthy |

### Check System Status

```bash
# Quick status
./docker/scripts/deploy-production.sh status

# Detailed container status
docker ps --filter "name=thaliumx" --format "table {{.Names}}\t{{.Status}}"

# Check logs
docker logs thaliumx-vault
docker logs thaliumx-keycloak
```

### Grafana Dashboards

Access Grafana at http://localhost:3001

Pre-configured dashboards:
- System Overview
- Vault Metrics
- Keycloak Metrics
- Database Performance
- API Gateway Stats

### Alerting

Configure alerts in `docker/observability/config/alertmanager.yml`:

```yaml
receivers:
  - name: 'slack'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#alerts'
```

---

## Troubleshooting

### Vault Issues

**Vault is sealed after restart:**
```bash
# Check seal status
vault status -address=https://localhost:8200

# Unseal (need 3 of 5 keys)
vault operator unseal -address=https://localhost:8200 <key>
```

**TLS certificate errors:**
```bash
# Verify certificate
openssl x509 -in docker/security/config/vault/tls/vault.crt -text -noout

# Check certificate chain
openssl verify -CAfile docker/security/config/ca.crt \
  docker/security/config/vault/tls/vault.crt
```

### Keycloak Issues

**Keycloak won't start:**
```bash
# Check logs
docker logs thaliumx-keycloak

# Verify database connection
docker exec thaliumx-postgres psql -U thaliumx -c "SELECT 1"
```

**HTTPS not working:**
```bash
# Verify certificates exist
ls -la docker/security/config/keycloak/tls/

# Check certificate permissions
chmod 644 docker/security/config/keycloak/tls/tls.crt
chmod 600 docker/security/config/keycloak/tls/tls.key
```

### Database Issues

**PostgreSQL connection refused:**
```bash
# Check if running
docker ps | grep postgres

# Check logs
docker logs thaliumx-postgres

# Test connection
docker exec thaliumx-postgres pg_isready -U thaliumx
```

### Backup Issues

**Backup fails:**
```bash
# Check backup logs
cat /var/log/thaliumx/backup_*.log | tail -50

# Run manual backup with verbose output
BACKUP_BASE_DIR=/opt/thaliumx/backups ./docker/scripts/backup-all.sh
```

---

## Security Checklist

Before going to production:

- [ ] Replace self-signed TLS certificates with CA-signed certificates
- [ ] Change all default passwords in `.env`
- [ ] Distribute Vault unseal keys to separate administrators
- [ ] Enable Vault audit logging
- [ ] Configure firewall rules
- [ ] Set up monitoring alerts
- [ ] Test backup and restore procedures
- [ ] Document emergency procedures
- [ ] Set up log rotation
- [ ] Configure rate limiting in APISIX

---

## Support

### Log Locations

- Container logs: `docker logs <container-name>`
- Backup logs: `/var/log/thaliumx/backup_*.log`
- Vault audit: `/vault/logs/audit.log`

### Useful Commands

```bash
# Restart all services
docker compose -f docker/security/compose.production.yaml restart

# View resource usage
docker stats --filter "name=thaliumx"

# Clean up unused resources
docker system prune -f
```

---

## Appendix: File Structure

```
docker/
├── scripts/
│   ├── deploy-production.sh      # Main deployment script
│   ├── backup-all.sh             # Backup script
│   ├── restore-backup.sh         # Restore script
│   ├── setup-backup-cron.sh      # Backup automation
│   └── sync-passwords.sh         # Password sync utility
├── security/
│   ├── compose.production.yaml   # Production security services
│   ├── Dockerfile.keycloak       # Optimized Keycloak build
│   ├── config/
│   │   ├── vault/
│   │   │   ├── vault-production.hcl
│   │   │   ├── vault-transit-seal.hcl
│   │   │   └── tls/
│   │   ├── vault-unseal/
│   │   │   └── vault-unseal.hcl
│   │   └── keycloak/
│   │       ├── realm/
│   │       └── tls/
│   └── scripts/
│       ├── setup-production-tls.sh
│       ├── vault-production-init.sh
│       └── setup-transit-autounseal.sh
├── databases/
├── apisix/
├── trading/
├── fintech/
├── observability/
└── wazuh/