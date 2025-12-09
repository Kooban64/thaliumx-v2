# Thaliumx Vault Configuration

Production-ready HashiCorp Vault setup for secrets management.

## Overview

This Vault configuration provides:
- **Raft Storage**: Integrated storage backend for high availability
- **KV Secrets Engine v2**: Versioned key-value secrets storage
- **Transit Engine**: Encryption as a service
- **Database Engine**: Dynamic database credentials
- **AppRole Auth**: Service authentication
- **Audit Logging**: Complete audit trail

## Directory Structure

```
docker/vault/
├── compose.yaml              # Docker Compose configuration
├── README.md                 # This file
├── config/
│   └── vault.hcl             # Vault server configuration
├── policies/
│   ├── admin.hcl             # Admin policy (full access)
│   ├── thaliumx-backend.hcl  # Backend service policy
│   ├── thaliumx-trading.hcl  # Trading services policy
│   └── thaliumx-fintech.hcl  # Fintech services policy
└── scripts/
    ├── init-vault.sh         # Initialize and unseal Vault
    ├── unseal-vault.sh       # Unseal Vault after restart
    ├── setup-secrets.sh      # Configure secrets engines & policies
    └── configure-database.sh # Setup dynamic database credentials
```

## Quick Start

### 1. Start Vault

```bash
# Create network first
docker network create --driver bridge --subnet 172.28.0.0/16 thaliumx-net

# Start Vault
cd docker/vault
docker compose up -d
```

### 2. Initialize Vault (First Time Only)

```bash
# Enter the container
docker exec -it thaliumx-vault /bin/sh

# Run initialization script
/vault/scripts/init-vault.sh
```

This will:
- Initialize Vault with 5 key shares (3 required to unseal)
- Save keys to `/vault/data/init-keys.json`
- Unseal Vault
- Login with root token

**⚠️ IMPORTANT**: Securely store the unseal keys and root token!

### 3. Configure Secrets Engines

```bash
# Still inside the container
/vault/scripts/setup-secrets.sh
```

This will:
- Enable audit logging
- Enable KV secrets engine v2
- Enable Transit secrets engine
- Enable Database secrets engine
- Create all policies
- Configure AppRole authentication
- Generate service credentials

### 4. Configure Database (After PostgreSQL is Running)

```bash
/vault/scripts/configure-database.sh
```

## Architecture

### Secrets Engines

| Engine | Path | Purpose |
|--------|------|---------|
| KV v2 | `kv/` | Static secrets (API keys, configs) |
| Transit | `transit/` | Encryption/decryption operations |
| Database | `database/` | Dynamic database credentials |

### Secret Paths

```
kv/
└── thaliumx/
    ├── shared/          # Shared configuration
    ├── backend/         # Backend service secrets
    ├── trading/         # Trading service secrets
    ├── fintech/         # Fintech service secrets
    ├── api-keys/        # External API keys
    ├── jwt/             # JWT signing keys
    ├── oauth/           # OAuth configuration
    ├── messaging/       # Kafka credentials
    ├── cache/           # Redis credentials
    ├── kyc/             # KYC provider credentials
    ├── payments/        # Payment provider credentials
    ├── banking/         # Banking API credentials
    ├── compliance/      # Compliance service credentials
    ├── exchange-keys/   # Exchange API keys
    └── market-data/     # Market data provider credentials
```

### Policies

| Policy | Description |
|--------|-------------|
| `admin` | Full administrative access |
| `thaliumx-backend` | Backend service access |
| `thaliumx-trading` | Trading services access |
| `thaliumx-fintech` | Fintech services access |

### Authentication

**AppRole** is configured for service authentication:

| Role | Policy | TTL |
|------|--------|-----|
| `thaliumx-backend` | `thaliumx-backend` | 1h (max 4h) |
| `thaliumx-trading` | `thaliumx-trading` | 1h (max 4h) |
| `thaliumx-fintech` | `thaliumx-fintech` | 1h (max 4h) |

## Usage

### Storing Secrets

```bash
# Store a secret
vault kv put kv/thaliumx/backend/database \
    host="thaliumx-postgres" \
    port="5432" \
    username="app" \
    password="secret"

# Read a secret
vault kv get kv/thaliumx/backend/database

# List secrets
vault kv list kv/thaliumx/backend/
```

### Encryption with Transit

```bash
# Encrypt data
vault write transit/encrypt/thaliumx-backend \
    plaintext=$(echo "sensitive data" | base64)

# Decrypt data
vault write transit/decrypt/thaliumx-backend \
    ciphertext="vault:v1:..."
```

### Dynamic Database Credentials

```bash
# Get temporary database credentials
vault read database/creds/thaliumx-backend

# Output:
# Key                Value
# ---                -----
# lease_id           database/creds/thaliumx-backend/xxx
# lease_duration     1h
# username           v-approle-thaliumx-xxx
# password           xxx
```

### Service Authentication (AppRole)

```bash
# Get role ID
vault read auth/approle/role/thaliumx-backend/role-id

# Generate secret ID
vault write -f auth/approle/role/thaliumx-backend/secret-id

# Login with AppRole
vault write auth/approle/login \
    role_id="xxx" \
    secret_id="xxx"
```

## Application Integration

### Environment Variables

Services should use these environment variables:

```bash
VAULT_ADDR=http://thaliumx-vault:8200
VAULT_ROLE_ID=<from service-credentials.json>
VAULT_SECRET_ID=<from service-credentials.json>
```

### Example: Node.js Integration

```javascript
const vault = require('node-vault')({
  apiVersion: 'v1',
  endpoint: process.env.VAULT_ADDR
});

// Login with AppRole
const { auth } = await vault.approleLogin({
  role_id: process.env.VAULT_ROLE_ID,
  secret_id: process.env.VAULT_SECRET_ID
});

vault.token = auth.client_token;

// Read secrets
const { data } = await vault.read('kv/data/thaliumx/backend/config');
console.log(data.data);

// Get database credentials
const dbCreds = await vault.read('database/creds/thaliumx-backend');
console.log(dbCreds.data);
```

### Example: Python Integration

```python
import hvac

client = hvac.Client(url=os.environ['VAULT_ADDR'])

# Login with AppRole
client.auth.approle.login(
    role_id=os.environ['VAULT_ROLE_ID'],
    secret_id=os.environ['VAULT_SECRET_ID']
)

# Read secrets
secret = client.secrets.kv.v2.read_secret_version(
    path='thaliumx/backend/config'
)
print(secret['data']['data'])

# Get database credentials
db_creds = client.secrets.database.generate_credentials(
    name='thaliumx-backend'
)
print(db_creds['data'])
```

## Operations

### Unsealing After Restart

```bash
docker exec -it thaliumx-vault /vault/scripts/unseal-vault.sh
```

### Checking Status

```bash
docker exec -it thaliumx-vault vault status
```

### Viewing Audit Logs

```bash
docker exec -it thaliumx-vault cat /vault/logs/audit.log | jq
```

### Revoking a Token

```bash
vault token revoke <token>
```

### Rotating Encryption Keys

```bash
vault write -f transit/keys/thaliumx-backend/rotate
```

## Production Considerations

### 1. Enable TLS

Update `vault.hcl`:
```hcl
listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_cert_file = "/vault/certs/vault.crt"
  tls_key_file  = "/vault/certs/vault.key"
}
```

### 2. Configure Auto-Unseal

For production, use cloud KMS for auto-unseal:

**AWS KMS:**
```hcl
seal "awskms" {
  region     = "us-east-1"
  kms_key_id = "your-kms-key-id"
}
```

**Azure Key Vault:**
```hcl
seal "azurekeyvault" {
  tenant_id     = "your-tenant-id"
  client_id     = "your-client-id"
  client_secret = "your-client-secret"
  vault_name    = "your-vault-name"
  key_name      = "your-key-name"
}
```

### 3. High Availability

For HA, deploy multiple Vault nodes with Raft:

```hcl
storage "raft" {
  path    = "/vault/data"
  node_id = "vault-1"
  
  retry_join {
    leader_api_addr = "https://vault-2:8200"
  }
  retry_join {
    leader_api_addr = "https://vault-3:8200"
  }
}
```

### 4. Backup Strategy

```bash
# Create Raft snapshot
vault operator raft snapshot save backup.snap

# Restore from snapshot
vault operator raft snapshot restore backup.snap
```

### 5. Monitoring

Prometheus metrics are available at:
```
http://thaliumx-vault:8200/v1/sys/metrics?format=prometheus
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Enable TLS for all communications
- [ ] Configure auto-unseal with cloud KMS
- [ ] Distribute unseal keys to different people/locations
- [ ] Revoke root token after initial setup
- [ ] Enable audit logging
- [ ] Set up monitoring and alerting
- [ ] Regular backup of Raft snapshots
- [ ] Rotate encryption keys periodically
- [ ] Review and audit policies regularly

## Troubleshooting

### Vault is Sealed

```bash
# Check status
vault status

# Unseal
/vault/scripts/unseal-vault.sh
```

### Permission Denied

```bash
# Check current token capabilities
vault token capabilities <path>

# Check policy
vault policy read <policy-name>
```

### Database Connection Failed

```bash
# Test database connection
vault write database/config/thaliumx-postgres \
    connection_url="postgresql://..." \
    username="..." \
    password="..."

# Check connection
vault read database/config/thaliumx-postgres