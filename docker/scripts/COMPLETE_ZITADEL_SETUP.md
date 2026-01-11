# Complete Zitadel Setup - Step by Step Programmatic Procedure

## Overview

This guide provides a complete step-by-step procedure to create a Zitadel OIDC application programmatically, without manual console access.

## Prerequisites

- Zitadel running at `http://localhost:8080`
- Instance ID: `353322233650741272`
- Project ID: `353322233650937880`
- Root user: `root@localhost`
- Root password: See `.secrets/generated/zitadel-firstadmin-password`

## The Challenge

Zitadel v2 requires authentication to use the Management API. To authenticate, we need:
- A service account (client ID + secret), OR
- A Personal Access Token (PAT)

But to create a service account, we need authentication (chicken-and-egg problem).

## Solution: Step-by-Step Procedure

### Step 1: Get Initial Authentication

We need to get a PAT or create a service account. Here are the options:

#### Option A: Use Zitadel CLI (Recommended)

```bash
# Download Zitadel CLI
curl -L "https://github.com/zitadel/zitadel/releases/download/v2.43.11/zitadelctl_2.43.11_linux_amd64.tar.gz" \
  -o /tmp/zitadelctl.tar.gz
tar -xzf /tmp/zitadelctl.tar.gz -C /tmp
chmod +x /tmp/zitadelctl

# Login to Zitadel
/tmp/zitadelctl login --instance http://localhost:8080
# Username: root@localhost
# Password: <from .secrets/generated/zitadel-firstadmin-password>
```

#### Option B: Create Service Account via CLI

```bash
# Create a service account
/tmp/zitadelctl user machine create \
  --name "thaliumx-backend-service" \
  --description "Service account for backend API"

# Generate client secret
/tmp/zitadelctl user machine secret create \
  --user-id <USER_ID_FROM_PREVIOUS_STEP>
```

#### Option C: Use Management API with Root User (if password grant works)

```bash
# Try to get token with root user (may not work)
curl -X POST "http://localhost:8080/oauth/v2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=353322236855189528@zitadel" \
  -d "username=root@localhost" \
  -d "password=<ROOT_PASSWORD>" \
  -d "scope=openid profile email urn:zitadel:iam:org:project:id:zitadel:aud"
```

### Step 2: Create Service Account (if not done in Step 1)

If you have a PAT from Step 1, create a service account:

```bash
# Create service account via Management API
curl -X POST "http://localhost:8080/management/v1/users/machine" \
  -H "Authorization: Bearer <PAT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "userName": "thaliumx-backend-service",
    "name": "ThaliumX Backend Service Account",
    "description": "Service account for backend API authentication"
  }'

# Generate client secret (get the userId from previous response)
curl -X POST "http://localhost:8080/management/v1/users/machine/<USER_ID>/secret" \
  -H "Authorization: Bearer <PAT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "expirationDate": "2099-12-31T23:59:59Z"
  }'
```

Save the `clientId` and `clientSecret` from the response.

### Step 3: Get Access Token Using Service Account

```bash
# Get access token using service account credentials
curl -X POST "http://localhost:8080/oauth/v2/token" \
  -u "<SERVICE_ACCOUNT_CLIENT_ID>:<SERVICE_ACCOUNT_CLIENT_SECRET>" \
  -d "grant_type=client_credentials" \
  -d "scope=urn:zitadel:iam:org:project:id:zitadel:management"
```

Save the `access_token` from the response.

### Step 4: Create OIDC Application

```bash
# Create OIDC app using the access token
curl -X POST "http://localhost:8080/management/v1/projects/353322233650937880/apps/oidc" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "appName": "thaliumx-backend-local",
    "redirectUris": ["http://localhost:3000/callback"],
    "responseTypes": ["TOKEN"],
    "grantTypes": ["PASSWORD", "CLIENT_CREDENTIALS"],
    "authMethodType": "CLIENT_SECRET_BASIC",
    "accessTokenType": "ACCESS_TOKEN_TYPE_BEARER",
    "devMode": true
  }'
```

Save the `clientId` and `clientSecret` from the response.

### Step 5: Update Backend Configuration

Update `docker/core/compose.yaml` or set environment variables:

```yaml
environment:
  - ZITADEL_ISSUER=http://thaliumx-zitadel:8080
  - ZITADEL_JWKS_URI=http://thaliumx-zitadel:8080/oauth/v2/keys
  - ZITADEL_SERVICE_ACCOUNT_ID=<OIDC_CLIENT_ID>
  - ZITADEL_SERVICE_ACCOUNT_KEY=<OIDC_CLIENT_SECRET>
  - ZITADEL_OIDC_CLIENT_ID=<OIDC_CLIENT_ID>
  - ZITADEL_OIDC_CLIENT_SECRET=<OIDC_CLIENT_SECRET>
```

### Step 6: Restart Backend

```bash
docker restart thaliumx-backend
```

## Automated Scripts

We've created helper scripts to automate parts of this process:

1. **`docker/scripts/create-oidc-app-with-service-account.js`**
   - Creates OIDC app using service account credentials
   - Usage: `node docker/scripts/create-oidc-app-with-service-account.js <CLIENT_ID> <CLIENT_SECRET>`

2. **`docker/scripts/create-zitadel-oidc-app-programmatic.sh`**
   - Main script that orchestrates the process
   - Run: `docker/scripts/create-zitadel-oidc-app-programmatic.sh`

## Complete Automated Solution

For a fully automated solution, you would need to:

1. Modify Zitadel init steps to create a service account automatically
2. Store the service account credentials securely
3. Use those credentials to create the OIDC app on first startup

However, Zitadel v2's init steps don't directly support service account creation,
so we need at least one manual step or use of the CLI.

## Alternative: Use Zitadel CLI for Everything

The easiest fully programmatic approach is to use Zitadel CLI:

```bash
# 1. Login
/tmp/zitadelctl login --instance http://localhost:8080

# 2. Create service account
SERVICE_ACCOUNT_ID=$(/tmp/zitadelctl user machine create \
  --name "thaliumx-backend-service" \
  --output json | jq -r '.userId')

# 3. Generate secret
/tmp/zitadelctl user machine secret create \
  --user-id "$SERVICE_ACCOUNT_ID" \
  --output json > /tmp/service-account-credentials.json

# 4. Extract credentials
CLIENT_ID=$(jq -r '.clientId' /tmp/service-account-credentials.json)
CLIENT_SECRET=$(jq -r '.clientSecret' /tmp/service-account-credentials.json)

# 5. Create OIDC app using the service account
node docker/scripts/create-oidc-app-with-service-account.js \
  "$CLIENT_ID" \
  "$CLIENT_SECRET"
```

## Troubleshooting

### "client not found" Error
- Verify service account credentials are correct
- Check that the service account exists in Zitadel

### "password not supported" Error
- Password grant is not enabled by default
- You need to create an OIDC app with password grant enabled first
- This is why we're creating the OIDC app programmatically

### "redirect_uri is http and is not allowed"
- Enable dev mode for the OIDC app
- Or configure proper HTTPS redirect URIs

## Summary

The complete programmatic setup requires:
1. ✅ Zitadel running (DONE)
2. ⏳ Get initial authentication (PAT or create service account via CLI)
3. ⏳ Create service account (if not done in step 2)
4. ⏳ Get access token using service account
5. ⏳ Create OIDC app using Management API
6. ⏳ Update backend configuration
7. ⏳ Restart backend

The main blocker is step 2 - getting initial authentication. The Zitadel CLI is the most reliable way to do this programmatically.
