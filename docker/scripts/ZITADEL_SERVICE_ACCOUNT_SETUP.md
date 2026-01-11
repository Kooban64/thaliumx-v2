# Zitadel Service Account Setup Guide

## Overview

The backend requires a Zitadel service account (API application) to authenticate with Zitadel's Management API for user management operations.

## Current Issue

The backend is currently using hardcoded "test" credentials which are invalid. A valid service account must be created in Zitadel and its credentials stored in Vault.

## Manual Setup Steps

### Option 1: Using Zitadel Console (Recommended)

1. **Access Zitadel Console**
   - URL: `https://auth.thaliumx.com`
   - Username: `root@auth.thaliumx.com`
   - Password: Check `.secrets/generated/zitadel-firstadmin-password`

2. **Create Service User**
   - Navigate to: **Service Users** > **New**
   - Username: `thaliumx-backend-service`
   - Display Name: `ThaliumX Backend Service Account`
   - Description: `Service account for backend API authentication`
   - Click **Create**

3. **Generate Client Secret**
   - In the service user's detail page, click **Actions** (top right)
   - Select **Generate Client Secret**
   - **IMPORTANT**: Copy the **Client ID** and **Client Secret** immediately
   - The secret will not be displayed again

4. **Grant Manager Role** (if needed for Management API access)
   - Navigate to your **Organization** detail page
   - Click the **"+"** button (top right)
   - Assign the **ORG_OWNER** or appropriate manager role to the service user

5. **Store Credentials in Vault**

   ```bash
   # Set Vault token (if not already set)
   export VAULT_TOKEN=your-vault-token
   export VAULT_ADDR=http://thaliumx-vault:8200
   
   # Store credentials
   ./docker/scripts/zitadel-store-credentials.sh \
     '<CLIENT_ID>' \
     '<CLIENT_SECRET>' \
     '<PROJECT_ID>' \
     '<ORG_ID>'
   ```

   Or manually using Vault CLI:
   ```bash
   vault kv put secret/thaliumx/zitadel \
     service_account_id="<CLIENT_ID>" \
     service_account_key="<CLIENT_SECRET>" \
     project_id="<PROJECT_ID>" \
     org_id="<ORG_ID>"
   ```

### Option 2: Using Zitadel CLI (if available)

If `zitadelctl` is available:

```bash
# Authenticate
zitadelctl login --instance auth.thaliumx.com

# Create service user
zitadelctl serviceuser create \
  --name "thaliumx-backend-service" \
  --description "Service account for backend API authentication"

# Generate client secret
zitadelctl serviceuser secret create \
  --user-id <SERVICE_USER_ID> \
  --expiration 2099-12-31T23:59:59Z
```

## Verification

After storing credentials in Vault:

1. **Restart Backend Container**
   ```bash
   docker restart thaliumx-backend
   ```

2. **Check Backend Logs**
   ```bash
   docker logs thaliumx-backend | grep -i "zitadel"
   ```
   
   Look for:
   - `✅ Zitadel credentials loaded from Vault (secure)`
   - No errors about "Zitadel service account credentials not configured"

3. **Test Login Flow**
   - Try registering a new user
   - Try logging in with an existing user
   - Check that Zitadel operations succeed

## Troubleshooting

### "client not found" Error

- **Cause**: Invalid service account credentials
- **Solution**: Verify credentials in Vault match the service account created in Zitadel

### "Failed to obtain Zitadel access token"

- **Cause**: Service account credentials are incorrect or service account doesn't have proper permissions
- **Solution**: 
  1. Verify credentials in Vault
  2. Check service user has manager role in Zitadel
  3. Verify client secret hasn't expired

### Vault Not Accessible

- **Cause**: Vault container not running or network issues
- **Solution**: 
  1. Check Vault container: `docker ps | grep vault`
  2. Check Vault health: `curl http://thaliumx-vault:8200/v1/sys/health`
  3. Use environment variables as fallback (see below)

### Fallback to Environment Variables

If Vault is not available, credentials can be set via environment variables in `docker/compose/prod-v1/applications.yml`:

```yaml
services:
  backend:
    environment:
      ZITADEL_SERVICE_ACCOUNT_ID: "<CLIENT_ID>"
      ZITADEL_SERVICE_ACCOUNT_KEY: "<CLIENT_SECRET>"
      ZITADEL_PROJECT_ID: "<PROJECT_ID>"
      ZITADEL_ORG_ID: "<ORG_ID>"
```

Then restart the backend container.

## Security Notes

- **Never commit credentials to git**
- **Always use Vault for production**
- **Rotate service account credentials regularly**
- **Use minimal permissions** (principle of least privilege)
- **Monitor access logs** for unauthorized usage
