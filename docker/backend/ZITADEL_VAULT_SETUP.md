# Zitadel Service Account Credentials - Vault Setup Guide

## Overview

Zitadel service account credentials are now loaded from HashiCorp Vault for secure storage. This ensures credentials are never exposed in environment variables or logs.

## Current Implementation

The `ZitadelApiService` automatically loads credentials from Vault with the following priority:
1. **Vault** (secure) - Primary source
2. **Environment Variables** - Fallback for development/testing

## Vault Secret Path

Credentials are stored in Vault at:
```
thaliumx/zitadel
```

With the following keys:
- `service_account_id` - Zitadel service account client ID
- `service_account_key` - Zitadel service account client secret
- `project_id` - Zitadel project ID (optional)
- `org_id` - Zitadel organization ID (optional)

## Setting Up Vault Secrets

### Using Vault CLI

```bash
# Set Vault address
export VAULT_ADDR=http://thaliumx-vault:8200
export VAULT_TOKEN=your-vault-token

# Store Zitadel credentials
vault kv put secret/thaliumx/zitadel \
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
  http://thaliumx-vault:8200/v1/secret/data/thaliumx/zitadel
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
ZITADEL_SERVICE_ACCOUNT_ID=your-id
ZITADEL_SERVICE_ACCOUNT_KEY=your-key
ZITADEL_PROJECT_ID=your-project-id
ZITADEL_ORG_ID=your-org-id
```

## Security Best Practices

1. **Production**: Always use Vault for credential storage
2. **Development**: Environment variables are acceptable for local development
3. **Rotation**: Rotate service account credentials regularly
4. **Access Control**: Use Vault policies to restrict access to Zitadel secrets
5. **Audit**: Enable Vault audit logging for credential access

## Verification

Check logs for credential loading status:
- `✅ Zitadel credentials loaded from Vault (secure)` - Successfully loaded from Vault
- `Vault not available, using environment variables` - Using fallback
- `Failed to load Zitadel credentials from Vault` - Vault error, using fallback

## Troubleshooting

### Credentials Not Loading from Vault

1. Check Vault connection:
   ```bash
   vault status
   ```

2. Verify secret exists:
   ```bash
   vault kv get secret/thaliumx/zitadel
   ```

3. Check Vault token permissions:
   ```bash
   vault token capabilities secret/data/thaliumx/zitadel
   ```

4. Review backend logs for Vault connection errors

### Using Environment Variables as Fallback

If Vault is unavailable, ensure environment variables are set:
```bash
export ZITADEL_SERVICE_ACCOUNT_ID=your-id
export ZITADEL_SERVICE_ACCOUNT_KEY=your-key
```

The system will automatically use these if Vault is not available.
