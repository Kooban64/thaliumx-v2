# Authentik Service Account Credentials - Vault Setup Guide

## Overview

Authentik service account credentials are now loaded from HashiCorp Vault for secure storage. This ensures credentials are never exposed in environment variables or logs.

## Current Implementation

The `AuthentikApiService` automatically loads credentials from Vault with the following priority:
1. **Vault** (secure) - Primary source
2. **Environment Variables** - Fallback for development/testing

## Vault Secret Path

Credentials are stored in Vault at:
```
thaliumx/Authentik
```

With the following keys:
- `service_account_id` - Authentik service account client ID
- `service_account_key` - Authentik service account client secret
- `project_id` - Authentik project ID (optional)
- `org_id` - Authentik organization ID (optional)

## Setting Up Vault Secrets

### Using Vault CLI

```bash
# Set Vault address
export VAULT_ADDR=http://thaliumx-vault:8200
export VAULT_TOKEN=your-vault-token

# Store Authentik credentials
vault kv put secret/thaliumx/Authentik \
  service_account_id="your-service-account-id" \
  service_account_key="your-service-account-key" \
  project_id="your-project-id" \
  org_id="your-org-id"
```

### Using Vault API

```bash
curl \
  --header "X-Vault-Token: your-vault-token" \
  --request POST \
  --data @payload.json \
  http://thaliumx-vault:8200/v1/secret/data/thaliumx/Authentik
```

Where `payload.json` contains:
```json
{
  "data": {
    "service_account_id": "your-service-account-id",
    "service_account_key": "your-service-account-key",
    "project_id": "your-project-id",
    "org_id": "your-org-id"
  }
}
```

## Vault Configuration

The backend automatically connects to Vault if configured via environment variables:

```bash
VAULT_ADDR=http://thaliumx-vault:8200
VAULT_TOKEN=your-vault-token
# OR use AppRole:
VAULT_ROLE_ID=your-role-id
VAULT_SECRET_ID=your-secret-id
VAULT_MOUNT_PATH=secret  # Default: secret
```

## Fallback Behavior

If Vault is not available or credentials are not found in Vault, the system falls back to environment variables:

```bash
AUTHENTIK_SERVICE_ACCOUNT_ID=your-id
AUTHENTIK_SERVICE_ACCOUNT_KEY=your-key
AUTHENTIK_PROJECT_ID=your-project-id
AUTHENTIK_ORG_ID=your-org-id
```

## Security Best Practices

1. **Production**: Always use Vault for credential storage
2. **Development**: Environment variables are acceptable for local development
3. **Rotation**: Rotate service account credentials regularly
4. **Access Control**: Use Vault policies to restrict access to Authentik secrets
5. **Audit**: Enable Vault audit logging for credential access

## Verification

Check logs for credential loading status:
- `✅ Authentik credentials loaded from Vault (secure)` - Successfully loaded from Vault
- `Vault not available, using environment variables` - Using fallback
- `Failed to load Authentik credentials from Vault` - Vault error, using fallback

## Troubleshooting

### Credentials Not Loading from Vault

1. Check Vault connection:
   ```bash
   vault status
   ```

2. Verify secret exists:
   ```bash
   vault kv get secret/thaliumx/Authentik
   ```

3. Check Vault token permissions:
   ```bash
   vault token capabilities secret/data/thaliumx/Authentik
   ```

4. Review backend logs for Vault connection errors

### Using Environment Variables as Fallback

If Vault is unavailable, ensure environment variables are set:
```bash
export AUTHENTIK_SERVICE_ACCOUNT_ID=your-id
export AUTHENTIK_SERVICE_ACCOUNT_KEY=your-key
```

The system will automatically use these if Vault is not available.
